import { Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

function normalizeDisplayRating(rawRating) {
  const numeric = Number(rawRating);
  if (!Number.isFinite(numeric)) return 1;
  if (numeric === 0) return 1;
  return Math.max(1, Math.min(5, Math.round(numeric)));
}

function RatingStars({ rating }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Rating: ${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const active = i < rating;
        return (
          <Star
            key={i}
            className={`h-4 w-4 ${active ? 'fill-[#ffbf3e] text-[#ffbf3e]' : 'fill-transparent text-current opacity-35'}`}
          />
        );
      })}
    </div>
  );
}

export function MyReviewsPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const dark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [draftRating, setDraftRating] = useState(1);
  const [draftBody, setDraftBody] = useState('');
  const [editError, setEditError] = useState('');
  const [savingReviewId, setSavingReviewId] = useState(null);
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteErrorReviewId, setDeleteErrorReviewId] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadMyReviews() {
      if (!user?.id) return;
      setLoading(true);
      const { data: reviewRows, error: reviewError } = await supabase
        .from('reviews')
        .select('review_id, establishment_id, rating, body, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (reviewError) {
        console.error('Error loading reviews:', reviewError);
        if (mounted) setLoadError(reviewError.message || 'Unable to load your reviews right now.');
        if (mounted) setReviews([]);
        if (mounted) setLoading(false);
        return;
      }
      if (mounted) setLoadError('');

      const establishmentIds = [...new Set((reviewRows ?? []).map((r) => r.establishment_id).filter(Boolean))];
      let nameByEstablishmentId = new Map();

      if (establishmentIds.length > 0) {
        const { data: establishments, error: establishmentError } = await supabase
          .from('establishments')
          .select('establishment_id, name, building_name')
          .in('establishment_id', establishmentIds);

        if (establishmentError) {
          console.error('Error loading establishment names:', establishmentError);
        } else {
          nameByEstablishmentId = new Map(
            (establishments ?? []).map((e) => [
              String(e.establishment_id),
              { name: e.name, buildingName: e.building_name },
            ]),
          );
        }
      }

      const mergedRows = (reviewRows ?? []).map((row) => {
        const establishment = nameByEstablishmentId.get(String(row.establishment_id));
        return {
          ...row,
          establishmentName: establishment?.name ?? 'Unknown establishment',
          establishmentBuilding: establishment?.buildingName ?? '',
        };
      });

      if (mounted) {
        setReviews(mergedRows);
        setLoading(false);
      }
    }

    loadMyReviews();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const reviewCountLabel = useMemo(() => {
    if (reviews.length === 1) return '1 review';
    return `${reviews.length} reviews`;
  }, [reviews.length]);

  function beginEditing(review) {
    setEditError('');
    setEditingReviewId(review.review_id);
    setDraftRating(normalizeDisplayRating(review.rating));
    setDraftBody(review.body ?? '');
  }

  function cancelEditing() {
    setEditError('');
    setEditingReviewId(null);
    setDraftRating(1);
    setDraftBody('');
  }

  async function saveReview(review) {
    setEditError('');
    setSavingReviewId(review.review_id);
    const bodyToSave = draftBody.trim();

    const { error } = await supabase
      .from('reviews')
      .update({
        rating: draftRating,
        body: bodyToSave,
        updated_at: new Date().toISOString(),
      })
      .eq('review_id', review.review_id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error saving review:', error);
      setEditError(error.message || 'Unable to save review right now.');
      setSavingReviewId(null);
      return;
    }

    setReviews((prev) =>
      prev.map((item) =>
        item.review_id === review.review_id
          ? {
              ...item,
              rating: draftRating,
              body: bodyToSave,
            }
          : item,
      ),
    );
    setSavingReviewId(null);
    cancelEditing();
  }

  async function deleteReview(review) {
    setDeleteError('');
    setDeleteErrorReviewId(null);
    const confirmed = window.confirm('Delete this review permanently?');
    if (!confirmed) return;

    setDeletingReviewId(review.review_id);
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('review_id', review.review_id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting review:', error);
      setDeleteError(error.message || 'Unable to delete review right now.');
      setDeleteErrorReviewId(review.review_id);
      setDeletingReviewId(null);
      return;
    }

    setReviews((prev) => prev.filter((item) => item.review_id !== review.review_id));
    if (editingReviewId === review.review_id) {
      cancelEditing();
    }
    setDeletingReviewId(null);
  }

  return (
    <div className={`relative min-h-[calc(100vh-3.5rem)] overflow-hidden ${dark ? 'bg-[#0f1219]' : 'bg-white'}`}>
      {dark ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,191,62,0.08),_transparent_35%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:18px_18px]" />
        </>
      ) : (
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
      )}

      <main className="relative z-10 container mx-auto px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-black tracking-tight">My Reviews</h1>
          <p className={`mt-2 text-sm ${dark ? 'text-white/65' : 'text-black/60'}`}>
            Your past ratings and written feedback for campus spots.
          </p>

          <section className="mt-8">
            {loading ? (
              <p className={`${dark ? 'text-white/70' : 'text-black/70'}`}>Loading your reviews...</p>
            ) : reviews.length === 0 ? (
              <div className="space-y-4">
                {loadError ? (
                  <p className="text-sm font-semibold text-red-500">{loadError}</p>
                ) : null}
                <p className={`${dark ? 'text-white/75' : 'text-black/75'}`}>
                  You have not posted any reviews yet.
                </p>
                <Link
                  to="/restaurants"
                  className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold transition ${
                    dark
                      ? 'bg-[#ffbf3e] text-black hover:bg-[#ffd15e]'
                      : 'bg-black text-white hover:bg-black/85'
                  }`}
                >
                  Browse Restaurants to Write One
                </Link>
              </div>
            ) : (
              <div>
                <div className={`mb-4 text-sm font-semibold ${dark ? 'text-white/70' : 'text-black/70'}`}>
                  {reviewCountLabel}
                </div>
                <div className={`${dark ? 'divide-y divide-white/10 border-y border-white/10' : 'divide-y divide-black/10 border-y border-black/10'}`}>
                {reviews.map((review) => {
                  const displayRating = normalizeDisplayRating(review.rating);
                  const isEditing = editingReviewId === review.review_id;
                  const isSaving = savingReviewId === review.review_id;
                  const isDeleting = deletingReviewId === review.review_id;
                  return (
                    <article key={review.review_id} className="py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold">{review.establishmentName}</h2>
                          {review.establishmentBuilding ? (
                            <p className={`text-sm ${dark ? 'text-white/55' : 'text-black/55'}`}>
                              {review.establishmentBuilding}
                            </p>
                          ) : null}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => {
                              const score = i + 1;
                              return (
                                <button
                                  key={score}
                                  type="button"
                                  onClick={() => setDraftRating(score)}
                                  className="inline-flex items-center justify-center"
                                  aria-label={`Set rating to ${score}`}
                                >
                                  <Star
                                    className={`h-5 w-5 ${
                                      score <= draftRating
                                        ? 'fill-[#ffbf3e] text-[#ffbf3e]'
                                        : 'fill-transparent text-current opacity-35'
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <RatingStars rating={displayRating} />
                            <span className={`text-xs font-semibold ${dark ? 'text-white/70' : 'text-black/70'}`}>
                              {displayRating}
                            </span>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="mt-3 space-y-3">
                          <textarea
                            value={draftBody}
                            onChange={(e) => setDraftBody(e.target.value)}
                            rows={4}
                            className={`block w-full rounded-lg border px-3 py-2 text-sm ${
                              dark
                                ? 'border-white/10 bg-[#0f1219] text-white placeholder:text-white/45'
                                : 'border-black/15 bg-white text-black placeholder:text-black/45'
                            }`}
                            placeholder="Update your review..."
                          />
                          {editError ? (
                            <p className="text-sm font-semibold text-red-500">{editError}</p>
                          ) : null}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => saveReview(review)}
                              disabled={isSaving}
                              className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-bold transition ${
                                dark
                                  ? 'bg-[#ffbf3e] text-black hover:bg-[#ffd15e] disabled:opacity-60'
                                  : 'bg-black text-white hover:bg-black/85 disabled:opacity-60'
                              }`}
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              disabled={isSaving || isDeleting}
                              className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                dark
                                  ? 'border-white/15 text-white/85 hover:bg-white/10 disabled:opacity-60'
                                  : 'border-black/15 text-black/85 hover:bg-black/5 disabled:opacity-60'
                              }`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className={`mt-3 leading-relaxed ${dark ? 'text-white/85' : 'text-black/80'}`}>
                            {review.body || 'No review text provided.'}
                          </p>
                          <div className="mt-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => beginEditing(review)}
                                disabled={isDeleting}
                                className={`inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                                  dark
                                    ? 'border-white/15 text-white/85 hover:bg-white/10 disabled:opacity-60'
                                    : 'border-black/15 text-black/85 hover:bg-black/5 disabled:opacity-60'
                                }`}
                              >
                                Edit Review
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteReview(review)}
                                disabled={isDeleting}
                                className={`inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                                  dark
                                    ? 'border-red-400/40 text-red-300 hover:bg-red-500/15 disabled:opacity-60'
                                    : 'border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60'
                                }`}
                              >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                            {deleteError && deleteErrorReviewId === review.review_id && deletingReviewId === null ? (
                              <p className="mt-2 text-sm font-semibold text-red-500">{deleteError}</p>
                            ) : null}
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
