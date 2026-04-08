const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'Resturant-logos'; // logos + hero images
export const REVIEW_STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_REVIEW_STORAGE_BUCKET || 'review-media'; // review uploads
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'];
const HEROES_FOLDER = 'heroes';
const LOGOS_FOLDER = 'logos';
const IMAGES_FOLDER = 'images';

const supabasePublicStorageBase = STORAGE_BUCKET && SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}`
  : null;

function encodeObjectPath(objectPath) {
  return String(objectPath ?? '').split('/').map((s) => encodeURIComponent(s)).join('/');
}

function toImageSrc(objectPath) {
  if (!supabasePublicStorageBase) return '';
  return `${supabasePublicStorageBase}/${encodeObjectPath(objectPath)}`;
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value ?? '').trim());
}

/** Absolute URLs in `review_images.storage_url` must be our project Storage (not random pages). */
function isTrustedSupabaseStorageHttpUrl(url) {
  const s = String(url ?? '').trim();
  if (!isAbsoluteHttpUrl(s) || !SUPABASE_URL) return false;
  try {
    const u = new URL(s);
    const base = new URL(SUPABASE_URL);
    if (u.origin !== base.origin) return false;
    return u.pathname.includes('/storage/v1/object/');
  } catch {
    return false;
  }
}

// Trim; strip leading slashes (object keys have no leading /).
function normalizeStorageObjectPath(path) {
  return String(path ?? '').trim().replace(/^\/+/, '');
}

function getPathOrUrlCandidateUrls(supabase, candidate) {
  const value = String(candidate ?? '').trim();
  if (!value) return [];
  if (isAbsoluteHttpUrl(value)) return [value];

  const urls = [];
  if (supabase && STORAGE_BUCKET) {
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(value);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }
  const direct = toImageSrc(value);
  if (direct && !urls.includes(direct)) urls.push(direct);
  return urls;
}

// Public URL for a review-media path. Useless if bucket is private.
export function getPrimaryReviewMediaUrl(supabase, storagePath) {
  const path = normalizeStorageObjectPath(storagePath);
  if (!path) return '';
  const candidates = getPathOrUrlCandidateUrlsForBucket(supabase, path, REVIEW_STORAGE_BUCKET);
  return candidates[0] ?? '';
}

const REVIEW_IMAGE_SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7; // 7d

// `<img src>` for review photos: signed URL first, else public URL.
export async function resolveReviewImageForDisplay(supabase, storagePath) {
  const path = normalizeStorageObjectPath(storagePath);
  if (!path) return '';
  if (isAbsoluteHttpUrl(path)) {
    return isTrustedSupabaseStorageHttpUrl(path) ? path : '';
  }

  if (!supabase?.storage || !REVIEW_STORAGE_BUCKET) {
    return getPrimaryReviewMediaUrl(supabase, path);
  }

  const { data, error } = await supabase.storage
    .from(REVIEW_STORAGE_BUCKET)
    .createSignedUrl(path, REVIEW_IMAGE_SIGNED_URL_TTL_SEC);

  if (!error && data?.signedUrl) return data.signedUrl;
  return getPrimaryReviewMediaUrl(supabase, path);
}

// Public URL candidates for `bucketName` + path, or pass through http(s) URLs.
function getPathOrUrlCandidateUrlsForBucket(supabase, candidate, bucketName) {
  const value = normalizeStorageObjectPath(candidate);
  if (!value) return [];
  if (isAbsoluteHttpUrl(value)) return [value];

  const urls = [];
  if (supabase && bucketName) {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(value);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }
  if (SUPABASE_URL && bucketName) {
    const direct = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${encodeObjectPath(value)}`;
    if (direct && !urls.includes(direct)) urls.push(direct);
  }
  return urls;
}

function getConventionalCandidatePathsById(id) {
  const paths = [];
  for (const ext of IMAGE_EXTENSIONS) {
    const fileName = `${id}.${ext}`;
    paths.push(`${HEROES_FOLDER}/${fileName}`);
    paths.push(`${LOGOS_FOLDER}/${fileName}`);
    paths.push(`${IMAGES_FOLDER}/${HEROES_FOLDER}/${fileName}`);
    paths.push(`${IMAGES_FOLDER}/${LOGOS_FOLDER}/${fileName}`);
    paths.push(`${HEROES_FOLDER}/${IMAGES_FOLDER}/${fileName}`);
    paths.push(`${LOGOS_FOLDER}/${IMAGES_FOLDER}/${fileName}`);
    paths.push(fileName); // legacy: file at bucket root
  }
  return [...new Set(paths)];
}

// Logos before heroes so a single brand slot in the collage tends to show the logo.
function orderedBrandCandidatePathsForId(establishmentId) {
  const all = getConventionalCandidatePathsById(establishmentId);
  const logos = all.filter((p) => p.startsWith(`${LOGOS_FOLDER}/`));
  const heroes = all.filter((p) => p.startsWith(`${HEROES_FOLDER}/`));
  const rest = all.filter((p) => !logos.includes(p) && !heroes.includes(p));
  return [...logos, ...heroes, ...rest];
}

export function getRestaurantImageCandidates(restaurant) {
  const candidates = [];
  const id = String(restaurant?.establishment_id ?? '').trim();
  const explicitPaths = [restaurant?.header_image_path, restaurant?.logo_path, restaurant?.header_image];

  for (const path of explicitPaths) {
    if (path && typeof path === 'string') {
      candidates.push(path.trim());
    }
  }

  if (id) {
    candidates.push(...getConventionalCandidatePathsById(id));
  }

  const deduped = [...new Set(candidates)];
  return deduped.flatMap((candidate) => getPathOrUrlCandidateUrls(null, candidate));
}

export function getRestaurantCardImageCandidates(restaurant) {
  const candidates = [];
  const id = String(restaurant?.establishment_id ?? '').trim();
  const explicitPaths = [restaurant?.logo_path, restaurant?.header_image_path, restaurant?.header_image];

  for (const path of explicitPaths) {
    if (path && typeof path === 'string') {
      candidates.push(path.trim());
    }
  }

  if (id) {
    for (const ext of IMAGE_EXTENSIONS) {
      const fileName = `${id}.${ext}`;
      candidates.push(`${LOGOS_FOLDER}/${fileName}`); // logo before hero on cards
      candidates.push(`${HEROES_FOLDER}/${fileName}`);
      candidates.push(`${IMAGES_FOLDER}/${LOGOS_FOLDER}/${fileName}`);
      candidates.push(`${IMAGES_FOLDER}/${HEROES_FOLDER}/${fileName}`);
      candidates.push(`${LOGOS_FOLDER}/${IMAGES_FOLDER}/${fileName}`);
      candidates.push(`${HEROES_FOLDER}/${IMAGES_FOLDER}/${fileName}`);
      candidates.push(fileName);
    }
  }

  const deduped = [...new Set(candidates)];
  return deduped.flatMap((candidate) => getPathOrUrlCandidateUrls(null, candidate));
}

// First candidate URL only — often 404. Use fetchCarouselSlidesFromStorage.
export function getRestaurantCarouselSlides(restaurants = []) {
  return restaurants.map((restaurant) => {
    const candidates = getRestaurantImageCandidates(restaurant);
    const imageSrc = candidates[0] ?? '';
    return {
      key: String(restaurant?.establishment_id ?? imageSrc),
      imageSrc,
      alt: 'UMBC restaurant',
    };
  });
}

async function listImagePathsInFolder(supabase, bucket, folder) {
  const imageRe = /\.(png|jpg|jpeg|webp|heic|heif)$/i;
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error || !Array.isArray(data)) return [];
  return data
    .filter((f) => f?.name && imageRe.test(f.name))
    .map((f) => `${folder}/${f.name}`);
}

function getConventionalStoragePath(establishmentId, heroesSet, logosSet) {
  const id = String(establishmentId ?? '').trim();
  if (!id) return null;
  for (const p of getConventionalCandidatePathsById(id)) {
    // Only heroes/ and logos/ list() results are trustworthy here.
    if (p.startsWith(`${HEROES_FOLDER}/`) && heroesSet.has(p)) return p;
    if (p.startsWith(`${LOGOS_FOLDER}/`) && logosSet.has(p)) return p;
  }
  return null;
}

// True if the URL loads in an Image() (12s max).
function probePublicImageUrl(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    const t = setTimeout(() => resolve(false), 12000);
    img.onload = () => {
      clearTimeout(t);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(false);
    };
    img.src = url;
  });
}

export const MAX_HOME_CAROUSEL_SLIDES = 24; // home carousel slide limit

// One slide per place: list heroes/logos once, match by establishment id (or probe fallback).
export async function fetchCarouselSlidesFromStorage(supabase, establishments) {
  if (!supabase || !Array.isArray(establishments) || establishments.length === 0) return [];

  const bucket = STORAGE_BUCKET;
  if (!bucket) {
    return fetchCarouselSlidesByProbing(establishments);
  }

  const [heroPaths, logoPaths] = await Promise.all([
    listImagePathsInFolder(supabase, bucket, HEROES_FOLDER),
    listImagePathsInFolder(supabase, bucket, LOGOS_FOLDER),
  ]);
  const heroesSet = new Set(heroPaths);
  const logosSet = new Set(logoPaths);
  if (heroesSet.size === 0 && logosSet.size === 0) {
    return fetchCarouselSlidesByProbing(establishments);
  }

  const slides = [];
  for (const e of establishments) {
    if (slides.length >= MAX_HOME_CAROUSEL_SLIDES) break;
    const id = String(e?.establishment_id ?? '').trim();
    if (!id) continue;

    const explicitUrls = [
      ...getPathOrUrlCandidateUrls(supabase, e?.header_image_path),
      ...getPathOrUrlCandidateUrls(supabase, e?.logo_path),
      ...getPathOrUrlCandidateUrls(supabase, e?.header_image),
    ];
    if (explicitUrls.length > 0) {
      slides.push({
        key: id,
        imageSrc: explicitUrls[0],
        alt: e.name ? `${e.name}` : 'Restaurant photo',
      });
      continue;
    }

    const conventionalPath = getConventionalStoragePath(id, heroesSet, logosSet);
    if (!conventionalPath) continue;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(conventionalPath);
    const url = pub?.publicUrl;
    if (!url) continue;

    slides.push({
      key: id,
      imageSrc: url,
      alt: e.name ? `${e.name}` : 'Restaurant photo',
    });
  }

  return slides;
}

async function fetchCarouselSlidesByProbing(establishments) {
  const slides = [];
  for (const e of establishments) {
    if (slides.length >= MAX_HOME_CAROUSEL_SLIDES) break;
    const candidates = getRestaurantImageCandidates(e);
    for (const url of candidates) {
      if (!url) continue;
      if (await probePublicImageUrl(url)) {
        slides.push({
          key: String(e.establishment_id),
          imageSrc: url,
          alt: e.name ? `${e.name}` : 'Restaurant photo',
        });
        break;
      }
    }
  }
  return slides;
}

export const MAX_ESTABLISHMENT_GALLERY_IMAGES = 50; // establishment page gallery cap

// Conventional hero/logo path guesses for one establishment.
function getEstablishmentStorageGalleryPaths(restaurant) {
  const id = String(restaurant?.establishment_id ?? '').trim();
  if (!id) return [];

  return getConventionalCandidatePathsById(id);
}


// Sync URL list for establishment gallery (no Storage list; for fallback probing).
export function getEstablishmentGalleryUrls(establishment) {
  const urls = [];
  const push = (u) => {
    if (u && typeof u === 'string' && !urls.includes(u)) urls.push(u);
  };

  const explicitLogoCandidates = getPathOrUrlCandidateUrls(
    null,
    establishment?.logo_path,
  );
  for (const url of explicitLogoCandidates) push(url);

  const explicitPathCandidates = getPathOrUrlCandidateUrls(
    null,
    establishment?.header_image_path,
  );
  for (const url of explicitPathCandidates) push(url);

  push(establishment?.header_image);

  for (const p of getEstablishmentStorageGalleryPaths(establishment)) {
    push(toImageSrc(p));
  }

  return urls.slice(0, MAX_ESTABLISHMENT_GALLERY_IMAGES);
}

// Logos/heroes/header first, then review-media. Deduped, capped at max.
function mergeBrandThenReviewUrls(brandUrls, reviewUrls, max) {
  const out = [];
  const seen = new Set();
  const push = (u) => {
    if (!u || seen.has(u) || out.length >= max) return;
    seen.add(u);
    out.push(u);
  };
  for (const u of brandUrls) push(u);
  for (const u of reviewUrls) push(u);
  return out;
}

async function fetchReviewImageUrlsForEstablishment(supabase, establishmentId) {
  if (!supabase || !establishmentId) return [];
  const { data, error } = await supabase
    .from('review_images')
    .select('storage_url, display_order, reviews!inner(establishment_id)')
    .eq('reviews.establishment_id', establishmentId)
    .order('display_order', { ascending: true });

  if (error) {
    console.warn('fetchReviewImageUrlsForEstablishment:', error.message ?? error);
    return [];
  }
  if (!Array.isArray(data) || data.length === 0) return [];

  const urls = [];
  for (const row of data) {
    const u = await resolveReviewImageForDisplay(supabase, row?.storage_url);
    if (u && !urls.includes(u)) urls.push(u);
  }
  return urls;
}

// Async gallery: restaurant-logos (heroes/logos + explicit/header) first, then review-media.
export async function fetchEstablishmentGalleryUrls(supabase, establishment) {
  const id = String(establishment?.establishment_id ?? '').trim();
  const bucket = STORAGE_BUCKET;
  const max = MAX_ESTABLISHMENT_GALLERY_IMAGES;

  const reviewUrls =
    establishment && supabase && id ? await fetchReviewImageUrlsForEstablishment(supabase, id) : [];

  if (!establishment || !supabase || !bucket || !id) {
    const brandEarly = [];
    const explicit = getPathOrUrlCandidateUrls(supabase, establishment?.header_image_path);
    if (explicit.length > 0 && (await probePublicImageUrl(explicit[0]))) {
      brandEarly.push(explicit[0]);
    }
    const hi = establishment?.header_image;
    if (hi && typeof hi === 'string' && !brandEarly.includes(hi) && (await probePublicImageUrl(hi))) {
      brandEarly.unshift(hi);
    }
    if (brandEarly.length > 0 || reviewUrls.length > 0) {
      return mergeBrandThenReviewUrls(brandEarly, reviewUrls, max);
    }
    return [];
  }

  const [heroPaths, logoPaths] = await Promise.all([
    listImagePathsInFolder(supabase, bucket, HEROES_FOLDER),
    listImagePathsInFolder(supabase, bucket, LOGOS_FOLDER),
  ]);
  const heroesSet = new Set(heroPaths);
  const logosSet = new Set(logoPaths);

  // Paths confirmed by list() — do not probe (CORS/timing often fails on valid Supabase URLs).
  const brandFromBucket = [];
  let listedMatchForThisPlace = false;
  for (const p of orderedBrandCandidatePathsForId(id)) {
    if (brandFromBucket.length >= max) break;
    const isHeroPath = p.startsWith(`${HEROES_FOLDER}/`);
    const isLogoPath = p.startsWith(`${LOGOS_FOLDER}/`);
    const exists = (isHeroPath && heroesSet.has(p)) || (isLogoPath && logosSet.has(p));
    if (!exists) continue;
    listedMatchForThisPlace = true;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(p);
    const url = pub?.publicUrl;
    if (url && !brandFromBucket.includes(url)) brandFromBucket.push(url);
  }

  // list() often returns [] without Storage SELECT policies — still try public object URLs.
  if (!listedMatchForThisPlace) {
    const extRe = new RegExp(`\\.(${IMAGE_EXTENSIONS.join('|')})$`, 'i');
    for (const p of orderedBrandCandidatePathsForId(id)) {
      if (brandFromBucket.length >= max) break;
      const inHeroOrLogo =
        p.startsWith(`${HEROES_FOLDER}/`) ||
        p.startsWith(`${LOGOS_FOLDER}/`) ||
        p.startsWith(`${IMAGES_FOLDER}/${HEROES_FOLDER}/`) ||
        p.startsWith(`${IMAGES_FOLDER}/${LOGOS_FOLDER}/`);
      const rootImage = !p.includes('/') && extRe.test(p);
      if (!inHeroOrLogo && !rootImage) continue;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(p);
      const url = pub?.publicUrl;
      if (!url || brandFromBucket.includes(url)) continue;
      if (await probePublicImageUrl(url)) brandFromBucket.push(url);
    }
  }

  const explicitLogo = getPathOrUrlCandidateUrls(supabase, establishment?.logo_path);
  const explicitHeader = getPathOrUrlCandidateUrls(supabase, establishment?.header_image_path);
  for (const url of [explicitLogo[0], explicitHeader[0]].filter(Boolean)) {
    if (brandFromBucket.length >= max) break;
    if (brandFromBucket.includes(url)) continue;
    if (await probePublicImageUrl(url)) brandFromBucket.push(url);
  }

  const hi = establishment.header_image;
  if (hi && typeof hi === 'string' && !brandFromBucket.includes(hi) && (await probePublicImageUrl(hi))) {
    brandFromBucket.unshift(hi);
  }

  const final = mergeBrandThenReviewUrls(brandFromBucket, reviewUrls, max);
  if (final.length > 0) {
    return final;
  }

  const candidates = getEstablishmentGalleryUrls(establishment);
  const brandFallback = [];
  for (const url of candidates) {
    if (brandFallback.length >= max) break;
    if (!url || brandFallback.includes(url)) continue;
    if (await probePublicImageUrl(url)) brandFallback.push(url);
  }
  return mergeBrandThenReviewUrls(brandFallback, reviewUrls, max);
}
