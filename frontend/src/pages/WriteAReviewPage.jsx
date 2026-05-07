import { Search, Star, X, ChevronLeft, Loader2, ImagePlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { compressImageFile } from '../lib/imageCompression.js';
import { resolveRestaurantCardImageUrl, REVIEW_STORAGE_BUCKET } from '../lib/restaurantImages';

const MIN_REVIEW_CHARS = 50;
const MAX_REVIEW_IMAGES = 3;
const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024;

function reviewLengthErrorMessage(errMessage) {
  const msg = String(errMessage || '');
  if (/at least 50 characters|review body must be at least 50 characters/i.test(msg)) {
    return `Please write at least ${MIN_REVIEW_CHARS} characters.`;
  }
  return msg || 'Unable to submit review right now.';
}

/** Matches `review_images.mime_type` CHECK in schema / migration. */
const REVIEW_IMAGE_MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/heic-sequence': 'heic',
};

const REVIEW_IMAGE_EXT_TO_META = {
  jpg: { ext: 'jpg', mime: 'image/jpeg' },
  jpeg: { ext: 'jpg', mime: 'image/jpeg' },
  png: { ext: 'png', mime: 'image/png' },
  webp: { ext: 'webp', mime: 'image/webp' },
  heic: { ext: 'heic', mime: 'image/heic' },
  heif: { ext: 'heif', mime: 'image/heif' },
};

/** Resolve storage extension + DB mime (filename fallback when `file.type` is empty, e.g. some HEIC picks). */
function getReviewImageMeta(file) {
  if (!file) return null;
  if (file.type && REVIEW_IMAGE_MIME_TO_EXT[file.type]) {
    const ext = REVIEW_IMAGE_MIME_TO_EXT[file.type];
    let mime = file.type;
    if (mime === 'image/jpg' || mime === 'image/pjpeg') mime = 'image/jpeg';
    if (mime === 'image/heic-sequence') mime = 'image/heic';
    return { ext, mime };
  }
  const m = /\.([a-z0-9]+)$/i.exec(file.name ?? '');
  const raw = m ? m[1].toLowerCase() : '';
  return REVIEW_IMAGE_EXT_TO_META[raw] ?? null;
}

function getInitialRatingFromNavigateState(state) {
  const r = state?.initialRating;
  if (typeof r === 'number' && r >= 1 && r <= 5) return r;
  return 0;
}

function cleanSlug(text) {
  return String(text ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function formatReviewDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function RatingStars({ rating, className = 'h-4 w-4' }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${className} ${i <= rating ? 'fill-[#ffbf3e] text-[#ffbf3e]' : 'fill-transparent text-current opacity-35'}`}
        />
      ))}
    </div>
  );
}

function EstablishmentCardImage({ establishment, dark }) {
  const [imageSrc, setImageSrc] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await resolveRestaurantCardImageUrl(supabase, establishment);
      if (!cancelled) setImageSrc(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [establishment?.establishment_id]);

  return (
    <div className="relative h-full min-h-[5rem] w-24 shrink-0 overflow-hidden sm:w-28">
      {imageSrc === undefined ? (
        <div className={`flex h-full w-full items-center justify-center ${dark ? 'bg-white/5' : 'bg-black/5'}`} aria-hidden>
          <Loader2 className="h-6 w-6 animate-spin text-[#ffbf3e]/70" />
        </div>
      ) : !imageSrc ? (
        <div className={`h-full w-full ${dark ? 'bg-white/5' : 'bg-black/5'}`} aria-hidden />
      ) : (
        <img alt="" src={imageSrc} className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function FindBusinessStep({
  dark,
  establishments,
  loading,
  errorMessage,
  navigate,
}) {
  const [query, setQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dismissed, setDismissed] = useState(() => new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const loc = locationFilter.trim().toLowerCase();
    return establishments.filter((e) => {
      const nameOk = !q || String(e.name ?? '').toLowerCase().includes(q);
      const address = [e.address, e.building_name].filter(Boolean).join(' ').toLowerCase();
      const locOk = !loc || address.includes(loc);
      return nameOk && locOk;
    });
  }, [establishments, query, locationFilter]);

  const suggestions = useMemo(() => {
    const avgRating = (e) => {
      const r = Number(e.average_rating ?? e.rating ?? 0);
      return Number.isFinite(r) ? r : 0;
    };
    const reviewCount = (e) => Number(e.total_reviews ?? 0) || 0;
    return [...filtered]
      .filter((e) => !dismissed.has(String(e.establishment_id)))
      .sort((a, b) => {
        const d = avgRating(b) - avgRating(a);
        if (d !== 0) return d;
        const rc = reviewCount(b) - reviewCount(a);
        if (rc !== 0) return rc;
        return String(a.name ?? '').localeCompare(String(b.name ?? ''));
      })
      .slice(0, 6);
  }, [filtered, dismissed]);

  const goToReview = (establishmentId, initialRating) => {
    navigate(`/writeareview/${establishmentId}`, {
      state: typeof initialRating === 'number' ? { initialRating } : undefined,
    });
  };

  const borderInput = dark ? 'border-white/15 bg-[#0f1219] text-white placeholder:text-white/45' : 'border-black/15 bg-white text-black placeholder:text-black/45';
  const cardBorder = dark ? 'border-white/10 bg-white/[0.03]' : 'border-black/10 bg-white shadow-sm';

  return (
    <div className="mx-auto max-w-5xl">
      <div className="min-w-0">
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">Find a place to review</h1>
        <p className={`mb-8 max-w-xl text-base ${dark ? 'text-white/70' : 'text-black/60'}`}>
          Review anything from your go-to dining hall to your favorite campus café.
        </p>

        <div className={`flex flex-col overflow-hidden rounded-xl border sm:flex-row ${dark ? 'border-white/15' : 'border-black/15'}`}>
          <label className="sr-only" htmlFor="write-search-what">
            Search businesses
          </label>
          <input
            id="write-search-what"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try dining hall, café, convenience"
            className={`min-w-0 flex-1 border-b px-4 py-3.5 text-[15px] outline-none sm:border-b-0 sm:border-r ${borderInput} ${dark ? 'sm:border-white/15' : 'sm:border-black/10'}`}
          />
          <label className="sr-only" htmlFor="write-search-where">
            Location
          </label>
          <input
            id="write-search-where"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder="Building or address"
            className={`min-w-0 flex-1 px-4 py-3.5 text-[15px] outline-none ${borderInput}`}
          />
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center bg-[#ffbf3e] px-5 py-3.5 text-black transition hover:bg-[#f5b635] sm:py-0"
            aria-label="Search"
          >
            <Search className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {errorMessage ? <p className="mt-6 text-sm font-semibold text-red-500">{errorMessage}</p> : null}

      {loading ? (
        <div className="mt-12 flex justify-center py-8">
          <Loader2 className="h-9 w-9 animate-spin text-[#ffbf3e]" />
        </div>
      ) : null}

      {!loading && suggestions.length > 0 ? (
        <section className="mt-14">
          <h2 className="mb-4 text-lg font-bold">Visited one of these recently?</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((e) => (
              <div
                key={e.establishment_id}
                className={`relative flex overflow-hidden rounded-xl border ${cardBorder}`}
              >
                <button
                  type="button"
                  className={`absolute right-2 top-2 z-10 rounded-full p-1 ${dark ? 'text-white/50 hover:bg-white/10 hover:text-white' : 'text-black/40 hover:bg-black/5 hover:text-black'}`}
                  aria-label={`Dismiss ${e.name}`}
                  onClick={() =>
                    setDismissed((prev) => new Set([...prev, String(e.establishment_id)]))
                  }
                >
                  <X className="h-4 w-4" />
                </button>
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex min-w-0 flex-1 cursor-pointer text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffbf3e] ${dark ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.02]'}`}
                  onClick={() => goToReview(e.establishment_id)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      goToReview(e.establishment_id);
                    }
                  }}
                >
                  <EstablishmentCardImage establishment={e} dark={dark} />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-4 pr-10">
                    <p className="truncate font-bold">{e.name}</p>
                    <p className={`text-sm ${dark ? 'text-white/60' : 'text-black/55'}`}>Do you recommend this place?</p>
                    <div className="flex gap-0.5" onClick={(ev) => ev.stopPropagation()}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button
                          key={i}
                          type="button"
                          className="rounded p-0.5 transition hover:scale-110"
                          aria-label={`Rate ${i} stars and write a review`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            goToReview(e.establishment_id, i);
                          }}
                        >
                          <Star className="h-6 w-6 fill-transparent text-[#ffbf3e] opacity-50 hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : !loading && filtered.length === 0 ? (
        <p className={`mt-12 ${dark ? 'text-white/60' : 'text-black/55'}`}>No places match your search.</p>
      ) : null}
    </div>
  );
}

function ReviewFormStep({
  dark,
  establishment,
  rating,
  setRating,
  hover,
  setHover,
  reviewText,
  setReviewText,
  reviewPhotos,
  setReviewPhotos,
  saving,
  errorMessage,
  successMessage,
  onSubmit,
  recentReviews,
  reviewsLoading,
  navigate,
  formLoading,
}) {
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [photoPickWorking, setPhotoPickWorking] = useState(false);
  const [photoPickNotice, setPhotoPickNotice] = useState('');

  useEffect(() => {
    const urls = reviewPhotos.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [reviewPhotos]);

  const locationLine = [establishment?.building_name, establishment?.address].filter(Boolean).join(' · ');
  const charCount = reviewText.trim().length;
  const meetsMin = charCount >= MIN_REVIEW_CHARS;
  const canPost = rating >= 1 && rating <= 5 && meetsMin && !saving;

  const borderInput = dark ? 'border-white/15 bg-[#0f1219] text-white placeholder:text-white/45' : 'border-black/15 bg-white text-black placeholder:text-black/45';

  const ratingFunByValue = {
    1: 'wasted my swipe',
    2: 'lowkey disappointing',
    3: 'mid at best',
    4: 'worth the swipe',
    5: 'no crumbs left',
  };
  const displayedRating = hover || rating;

  if (formLoading || !establishment) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ffbf3e]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <button
        type="button"
        onClick={() => navigate('/writeareview')}
        className={`mb-8 inline-flex items-center gap-1 text-sm font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-black/60 hover:text-black'}`}
      >
        <ChevronLeft className="h-4 w-4" />
        Find a different place
      </button>

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <form
            className="space-y-8"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <div className="min-w-0">
              <h1 className="break-words text-xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-2xl">{establishment?.name}</h1>
              {locationLine ? (
                <p className={`mt-1 break-words text-sm ${dark ? 'text-white/60' : 'text-black/55'}`}>{locationLine}</p>
              ) : null}
            </div>

            <div>
              <h2 className="text-lg font-bold">How would you rate your experience?</h2>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1" role="group" aria-label={rating ? `Rating: ${rating} out of 5` : 'Select star rating'}>
                  {[1, 2, 3, 4, 5].map((i) => {
                    const active = i <= (hover || rating);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRating(i)}
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(0)}
                        className="inline-flex items-center justify-center p-1"
                        aria-label={`Set rating to ${i} star: ${ratingFunByValue[i]}`}
                        aria-pressed={i === rating}
                      >
                        <Star
                          className={`h-9 w-9 cursor-pointer transition sm:h-10 sm:w-10 ${
                            active ? 'fill-[#ffbf3e] text-[#ffbf3e]' : 'fill-transparent text-current opacity-40'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <span className={`text-sm ${dark ? 'text-white/50' : 'text-black/45'}`}>
                  {displayedRating ? ratingFunByValue[displayedRating] : 'Select your rating'}
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold">Tell us about your experience</h2>
              <p className={`mt-1 text-sm ${dark ? 'text-white/50' : 'text-black/45'}`}>
                A few things to consider: food, service, value, atmosphere.
              </p>
              <textarea
                id="review"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={8}
                className={`mt-4 block w-full rounded-lg border px-4 py-3 text-[15px] leading-relaxed ${borderInput}`}
                placeholder="Start your review..."
              />
              <div className={`mt-2 flex items-center gap-2 text-sm ${meetsMin ? (dark ? 'text-emerald-400/90' : 'text-emerald-700') : dark ? 'text-white/45' : 'text-black/45'}`}>
                <span>
                  Reviews need to be at least {MIN_REVIEW_CHARS} characters ({charCount}/{MIN_REVIEW_CHARS}).
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold">Add photos (optional)</h2>
              <p className={`mt-1 text-sm ${dark ? 'text-white/50' : 'text-black/45'}`}>
                Up to {MAX_REVIEW_IMAGES} images — JPEG, PNG, WebP, or HEIC/HEIF. Large files are resized to
                about {Math.round(MAX_REVIEW_IMAGE_BYTES / (1024 * 1024))} MB or smaller when possible.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                    reviewPhotos.length >= MAX_REVIEW_IMAGES || photoPickWorking
                      ? dark
                        ? 'cursor-not-allowed border-white/10 text-white/35'
                        : 'cursor-not-allowed border-black/10 text-black/35'
                      : dark
                        ? 'border-white/15 text-white/90 hover:bg-white/10'
                        : 'border-black/15 text-black hover:bg-black/[0.04]'
                  }`}
                >
                  {photoPickWorking ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {reviewPhotos.length >= MAX_REVIEW_IMAGES
                    ? 'Photo limit reached'
                    : photoPickWorking
                      ? 'Processing…'
                      : 'Choose photos'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                    multiple
                    disabled={reviewPhotos.length >= MAX_REVIEW_IMAGES || photoPickWorking}
                    className="sr-only"
                    onChange={async (e) => {
                      const picked = Array.from(e.target.files || []);
                      e.target.value = '';
                      if (picked.length === 0) return;
                      setPhotoPickWorking(true);
                      setPhotoPickNotice('');
                      const errors = [];
                      let merged = [...reviewPhotos];
                      try {
                        for (const file of picked) {
                          if (merged.length >= MAX_REVIEW_IMAGES) break;
                          if (!getReviewImageMeta(file)) {
                            errors.push(`${file.name}: not a supported type.`);
                            continue;
                          }
                          try {
                            const out = await compressImageFile(file, {
                              maxBytes: MAX_REVIEW_IMAGE_BYTES,
                              preservePng: 'auto',
                            });
                            if (!getReviewImageMeta(out)) {
                              errors.push(`${file.name}: could not be prepared.`);
                              continue;
                            }
                            if (out.size > MAX_REVIEW_IMAGE_BYTES) {
                              errors.push(`${file.name}: still too large after compressing.`);
                              continue;
                            }
                            merged.push(out);
                          } catch (err) {
                            errors.push(`${file.name}: ${err?.message || 'could not process'}`);
                          }
                        }
                        setReviewPhotos(merged);
                        if (errors.length > 0) {
                          setPhotoPickNotice(
                            errors.slice(0, 2).join(' ') + (errors.length > 2 ? ` (+${errors.length - 2} more)` : ''),
                          );
                        }
                      } finally {
                        setPhotoPickWorking(false);
                      }
                    }}
                  />
                </label>
                <span className={`text-sm ${dark ? 'text-white/45' : 'text-black/45'}`}>
                  {reviewPhotos.length}/{MAX_REVIEW_IMAGES} added
                </span>
              </div>
              {photoPickNotice ? (
                <p className={`mt-2 text-sm ${dark ? 'text-amber-300/90' : 'text-amber-800'}`} role="status">
                  {photoPickNotice}
                </p>
              ) : null}
              {reviewPhotos.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-3">
                  {reviewPhotos.map((file, i) => (
                    <li
                      key={`${file.name}-${file.size}-${i}`}
                      className={`relative overflow-hidden rounded-lg ring-1 ${
                        dark ? 'ring-white/15' : 'ring-black/10'
                      }`}
                    >
                      {photoPreviews[i] ? (
                        <img
                          src={photoPreviews[i]}
                          alt=""
                          className="h-24 w-24 object-cover sm:h-28 sm:w-28"
                        />
                      ) : (
                        <div
                          className={`h-24 w-24 animate-pulse sm:h-28 sm:w-28 ${dark ? 'bg-white/10' : 'bg-black/5'}`}
                          aria-hidden
                        />
                      )}
                      <button
                        type="button"
                        aria-label={`Remove photo ${i + 1}`}
                        className={`absolute right-1 top-1 rounded-full p-1 shadow ${
                          dark ? 'bg-black/70 text-white hover:bg-black/90' : 'bg-white/90 text-black hover:bg-white'
                        }`}
                        onClick={() => setReviewPhotos((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {errorMessage ? <p className="text-sm font-semibold text-red-500">{errorMessage}</p> : null}
            {successMessage ? <p className="text-sm font-semibold text-green-500">{successMessage}</p> : null}

            <div>
              <button
                type="submit"
                disabled={!canPost}
                className="inline-flex w-full items-center justify-center rounded-lg bg-[#ffbf3e] px-8 py-3 text-base font-semibold text-black shadow-sm transition hover:bg-[#f5b635] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[200px]"
              >
                {saving ? 'Posting…' : 'Post Review'}
              </button>
            </div>
          </form>
        </div>

        <aside className={`lg:col-span-5 lg:border-l lg:pl-10 ${dark ? 'border-white/10' : 'border-black/10'}`}>
          <h3 className="mb-4 text-lg font-bold">Recent reviews</h3>
          {reviewsLoading ? (
            <div className="flex py-8">
              <Loader2 className="h-7 w-7 animate-spin text-[#ffbf3e]" />
            </div>
          ) : recentReviews.length === 0 ? (
            <p className={`text-sm ${dark ? 'text-white/50' : 'text-black/45'}`}>No reviews yet for this place.</p>
          ) : (
            <ul className="space-y-6">
              {recentReviews.map((row) => (
                <li key={row.review_id}>
                  <div className="flex gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        dark ? 'bg-white/10 text-white' : 'bg-black/10 text-black'
                      }`}
                    >
                      {(row.authorName || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{row.authorName || 'Member'}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <RatingStars rating={row.rating} />
                        <span className={`text-xs ${dark ? 'text-white/45' : 'text-black/40'}`}>
                          {formatReviewDate(row.created_at)}
                        </span>
                      </div>
                      <p className={`mt-2 line-clamp-4 break-words text-sm leading-relaxed [overflow-wrap:anywhere] ${dark ? 'text-white/75' : 'text-black/70'}`}>
                        {row.body || '—'}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

export function WriteAReviewPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { slug: establishmentSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [establishments, setEstablishments] = useState([]);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState('');
  const [rating, setRating] = useState(() => getInitialRatingFromNavigateState(location.state));
  const [hover, setHover] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewPhotos, setReviewPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [recentReviews, setRecentReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const isFinderStep = !establishmentSlug;

  const initialRatingFromNav = location.state?.initialRating;
  useEffect(() => {
    if (!establishmentSlug) return;
    const r = getInitialRatingFromNavigateState({ initialRating: initialRatingFromNav });
    queueMicrotask(() => {
      setRating(r);
      setReviewText('');
      setHover(0);
      setReviewPhotos([]);
    });
  }, [establishmentSlug, location.key, initialRatingFromNav]);

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
      }
      setUser(data.user ?? null);
    }
    loadUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadEstablishments() {
      setLoading(true);
      const { data, error } = await supabase
        .from('establishments_with_ratings')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching establishments:', error);
        if (mounted) setErrorMessage('Unable to load places right now.');
        if (mounted) setLoading(false);
        return;
      }

      const rows = data ?? [];
      if (mounted) {
        setEstablishments(rows);
        setLoading(false);
      }

      if (!mounted || rows.length === 0) return;
      if (establishmentSlug) {
        const matched = rows.find(
          (e) =>
            String(e.establishment_id) === String(establishmentSlug) ||
            cleanSlug(e.name) === cleanSlug(establishmentSlug),
        );
        if (matched) {
          setSelectedEstablishmentId(String(matched.establishment_id));
          return;
        }
      }
      if (!establishmentSlug) {
        setSelectedEstablishmentId('');
      }
    }
    loadEstablishments();
    return () => {
      mounted = false;
    };
  }, [establishmentSlug]);

  const selectedEstablishment = useMemo(
    () => establishments.find((e) => String(e.establishment_id) === String(selectedEstablishmentId)) ?? null,
    [establishments, selectedEstablishmentId],
  );

  useEffect(() => {
    if (!selectedEstablishment?.establishment_id || isFinderStep) {
      return;
    }
    let cancelled = false;
    async function loadRecentReviews() {
      setReviewsLoading(true);
      const { data: reviewRows, error } = await supabase
        .from('reviews')
        .select('review_id, user_id, rating, body, created_at')
        .eq('establishment_id', selectedEstablishment.establishment_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error loading reviews:', error);
        if (!cancelled) {
          setRecentReviews([]);
          setReviewsLoading(false);
        }
        return;
      }

      const rows = reviewRows ?? [];
      if (rows.length === 0) {
        if (!cancelled) {
          setRecentReviews([]);
          setReviewsLoading(false);
        }
        return;
      }

      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: usersData, error: usersError } = await supabase.from('users').select('user_id, display_name').in('user_id', userIds);

      if (usersError) {
        console.error('Error loading users for reviews:', usersError);
      }
      const nameById = new Map((usersData ?? []).map((u) => [String(u.user_id), u.display_name || 'Member']));

      const merged = rows.map((r) => ({
        ...r,
        authorName: nameById.get(String(r.user_id)) || 'Member',
      }));

      if (!cancelled) {
        setRecentReviews(merged);
        setReviewsLoading(false);
      }
    }
    loadRecentReviews();
    return () => {
      cancelled = true;
    };
  }, [selectedEstablishment?.establishment_id, isFinderStep]);

  async function handleSubmitReview() {
    if (!user?.id) {
      setErrorMessage('Please sign in to submit a review.');
      return;
    }
    if (!selectedEstablishmentId) {
      setErrorMessage('Please select a place first.');
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMessage('Please choose a rating from 1 to 5 stars.');
      return;
    }
    if (reviewText.trim().length < MIN_REVIEW_CHARS) {
      setErrorMessage(`Please write at least ${MIN_REVIEW_CHARS} characters.`);
      return;
    }

    const photosToUpload = reviewPhotos.slice(0, MAX_REVIEW_IMAGES);
    let photosReady = photosToUpload;
    try {
      photosReady = await Promise.all(
        photosToUpload.map((f) =>
          compressImageFile(f, {
            maxBytes: MAX_REVIEW_IMAGE_BYTES,
            preservePng: 'auto',
          }),
        ),
      );
    } catch (err) {
      setErrorMessage(err?.message || 'Could not prepare photos. Try different images or remove photos and submit again.');
      return;
    }
    for (const f of photosReady) {
      if (!getReviewImageMeta(f) || f.size > MAX_REVIEW_IMAGE_BYTES) {
        setErrorMessage(
          'Photos must be JPEG, PNG, WebP, or HEIC/HEIF and at most 5 MB each.',
        );
        return;
      }
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    const { data: reviewRow, error } = await supabase
      .from('reviews')
      .insert({
        user_id: user.id,
        establishment_id: selectedEstablishmentId,
        rating,
        body: reviewText.trim(),
        is_flagged: false,
      })
      .select('review_id')
      .single();

    if (error || !reviewRow?.review_id) {
      console.error('Error adding review to database:', error);
      setErrorMessage(reviewLengthErrorMessage(error?.message));
      setSaving(false);
      return;
    }

    const reviewId = reviewRow.review_id;
    const uploadedPaths = [];

    try {
      for (let i = 0; i < photosReady.length; i++) {
        const file = photosReady[i];
        const meta = getReviewImageMeta(file);
        const ext = meta.ext;
        const objectPath = `review-images/${reviewId}/${i + 1}.${ext}`;
        const { error: upErr } = await supabase.storage.from(REVIEW_STORAGE_BUCKET).upload(objectPath, file, {
          contentType: meta.mime,
          upsert: false,
        });
        if (upErr) throw upErr;
        uploadedPaths.push(objectPath);
      }

      if (uploadedPaths.length > 0) {
        const imageRows = photosReady.map((file, i) => ({
          review_id: reviewId,
          storage_url: uploadedPaths[i],
          display_order: i + 1,
          file_size_bytes: file.size,
          mime_type: getReviewImageMeta(file).mime,
        }));
        const { error: imgErr } = await supabase.from('review_images').insert(imageRows);
        if (imgErr) throw imgErr;
      }
    } catch (err) {
      console.error('Review image upload failed:', err);
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(REVIEW_STORAGE_BUCKET).remove(uploadedPaths);
      }
      await supabase.from('reviews').delete().eq('review_id', reviewId);
      const raw = err?.message || String(err);
      const sizeRejected = /exceeded the maximum allowed size|maximum allowed size/i.test(raw);
      setErrorMessage(
        sizeRejected
          ? 'Storage rejected a photo because the review-media bucket limit is too low. In the Supabase dashboard open Storage → review-media → increase the max file size to at least 5 MB (or run supabase/storage_review_media_bucket.sql).'
          : raw || 'Review was not saved because photo upload failed. Please try again without photos or check your connection.',
      );
      setSaving(false);
      return;
    }

    setSuccessMessage(`Review submitted for ${selectedEstablishment?.name ?? 'this place'}.`);
    setSaving(false);
    setReviewPhotos([]);
    navigate(`/restaurants/${selectedEstablishment?.establishment_id ?? selectedEstablishmentId}`);
  }

  const showNotFound = !isFinderStep && !loading && !selectedEstablishment;

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] ${dark ? 'text-white' : 'text-black'}`}>
      {dark ? (
        <>
          <div className="fixed inset-0 -z-10 bg-[#0f1219]" />
          <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
          <div className="fixed inset-0 -z-10 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      ) : (
        <>
          <div className="fixed inset-0 -z-10 bg-white" />
          <div className="fixed inset-0 -z-10 opacity-30 [background-image:radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      )}

      <main className="container mx-auto px-4 py-8 sm:px-6 sm:py-12">
        {showNotFound ? (
          <div className="mx-auto max-w-lg text-center">
            <h1 className="text-2xl font-bold">Place not found</h1>
            <p className={`mt-2 ${dark ? 'text-white/65' : 'text-black/55'}`}>We couldn’t find that establishment.</p>
            <Link
              to="/writeareview"
              className="mt-6 inline-block font-semibold text-[#ffbf3e] underline-offset-4 hover:underline"
            >
              Back to find a place
            </Link>
          </div>
        ) : isFinderStep ? (
          <FindBusinessStep
            dark={dark}
            establishments={establishments}
            loading={loading}
            errorMessage={errorMessage}
            navigate={navigate}
          />
        ) : (
          <ReviewFormStep
            dark={dark}
            establishment={selectedEstablishment}
            rating={rating}
            setRating={setRating}
            hover={hover}
            setHover={setHover}
            reviewText={reviewText}
            setReviewText={setReviewText}
            reviewPhotos={reviewPhotos}
            setReviewPhotos={setReviewPhotos}
            saving={saving}
            errorMessage={errorMessage}
            successMessage={successMessage}
            onSubmit={handleSubmitReview}
            recentReviews={recentReviews}
            reviewsLoading={reviewsLoading}
            navigate={navigate}
            formLoading={loading}
          />
        )}
      </main>
    </div>
  );
}
