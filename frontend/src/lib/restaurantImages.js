const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'Resturant-logos'; // logos + hero images
export const REVIEW_STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_REVIEW_STORAGE_BUCKET || 'review-media'; // review uploads
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'];
const HEROES_FOLDER = 'heroes';
const LOGOS_FOLDER = 'logos';
const IMAGES_FOLDER = 'images';

/** Bucket may use flat keys (`logos/id.ext`) or nested keys (`logos/logos/id.ext`, `logos/heroes/id.ext`) per Supabase folder layout. */
function brandSlotPathPrefixes(folder) {
  const f = String(folder ?? '').trim();
  if (f === LOGOS_FOLDER) return [`${LOGOS_FOLDER}`, `${LOGOS_FOLDER}/${LOGOS_FOLDER}`];
  if (f === HEROES_FOLDER) return [`${HEROES_FOLDER}`, `${LOGOS_FOLDER}/${HEROES_FOLDER}`];
  return [f];
}
const STORAGE_OBJECT_PATH_MARKER = '/storage/v1/object/';

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
    paths.push(`${LOGOS_FOLDER}/${LOGOS_FOLDER}/${fileName}`);
    paths.push(`${LOGOS_FOLDER}/${HEROES_FOLDER}/${fileName}`);
    paths.push(`${IMAGES_FOLDER}/${HEROES_FOLDER}/${fileName}`);
    paths.push(`${IMAGES_FOLDER}/${LOGOS_FOLDER}/${fileName}`);
    paths.push(`${HEROES_FOLDER}/${IMAGES_FOLDER}/${fileName}`);
    paths.push(`${LOGOS_FOLDER}/${IMAGES_FOLDER}/${fileName}`);
    paths.push(fileName); // legacy: file at bucket root
  }
  return [...new Set(paths)];
}

// Logos before heroes so a single brand slot in the collage tends to show the logo.
// Treat `logos/logos/` and `logos/heroes/` as logo vs hero slots (not generic `logos/*`).
function orderedBrandCandidatePathsForId(establishmentId) {
  const all = getConventionalCandidatePathsById(establishmentId);
  const nestedLogo = (p) => p.startsWith(`${LOGOS_FOLDER}/${LOGOS_FOLDER}/`);
  const nestedHero = (p) => p.startsWith(`${LOGOS_FOLDER}/${HEROES_FOLDER}/`);
  const flatLogo = (p) =>
    p.startsWith(`${LOGOS_FOLDER}/`) && !nestedLogo(p) && !nestedHero(p);
  const flatHero = (p) => p.startsWith(`${HEROES_FOLDER}/`);

  const logoPaths = all.filter((p) => nestedLogo(p) || flatLogo(p));
  const heroPaths = all.filter((p) => nestedHero(p) || flatHero(p));
  const rest = all.filter(
    (p) => !nestedLogo(p) && !flatLogo(p) && !nestedHero(p) && !flatHero(p),
  );
  return [...logoPaths, ...heroPaths, ...rest];
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

export function getRestaurantCardImageCandidates(restaurant, supabase = null) {
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
      candidates.push(`${LOGOS_FOLDER}/${LOGOS_FOLDER}/${fileName}`);
      candidates.push(`${HEROES_FOLDER}/${fileName}`);
      candidates.push(`${LOGOS_FOLDER}/${HEROES_FOLDER}/${fileName}`);
      candidates.push(`${IMAGES_FOLDER}/${LOGOS_FOLDER}/${fileName}`);
      candidates.push(`${IMAGES_FOLDER}/${HEROES_FOLDER}/${fileName}`);
      candidates.push(`${LOGOS_FOLDER}/${IMAGES_FOLDER}/${fileName}`);
      candidates.push(`${HEROES_FOLDER}/${IMAGES_FOLDER}/${fileName}`);
      candidates.push(fileName);
    }
  }

  const deduped = [...new Set(candidates)];
  return deduped.flatMap((candidate) => getPathOrUrlCandidateUrls(supabase, candidate));
}

/**
 * First card image URL that returns an image (bounded probes; avoids broken `<img>` on grids).
 * @returns {Promise<string>} Public image URL or empty string.
 */
export async function resolveRestaurantCardImageUrl(supabase, restaurant) {
  if (!supabase?.storage || !STORAGE_BUCKET || !SUPABASE_URL) return '';

  const brandSlots = await fetchEstablishmentGalleryUrls(supabase, restaurant);
  if (brandSlots.length > 0) return brandSlots[0];

  const candidates = getRestaurantCardImageCandidates(restaurant, supabase);
  const probed = await probePublicImageUrlsInOrder(candidates, 1);
  return probed[0] ?? '';
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

const PROBE_FETCH_TIMEOUT_MS = 10_000;
/** Avoid opening dozens of simultaneous connections to Storage / CDNs. */
const PROBE_MAX_CONCURRENT = 8;

function isImageContentType(headerValue) {
  return /^image\//i.test(String(headerValue ?? '').trim());
}

/** True for this project's Storage object URLs only (same origin as `VITE_SUPABASE_URL`). */
function isSupabaseStorageObjectUrl(url) {
  try {
    const u = new URL(url);
    if (!SUPABASE_URL) return false;
    if (!u.pathname.includes(STORAGE_OBJECT_PATH_MARKER)) return false;
    const base = new URL(SUPABASE_URL);
    return u.origin === base.origin;
  } catch {
    return false;
  }
}

/** Drop the body after headers are read so ranged GET does not retain large payloads when Range is ignored. */
function cancelResponseBody(res) {
  try {
    const body = res.body;
    if (body && typeof body.cancel === 'function') {
      void body.cancel();
    }
  } catch {
    /* ignore */
  }
}

function responseLooksLikeImage(res) {
  if (res.status === 404) return false;
  const okStatus =
    res.ok || res.status === 200 || res.status === 206 || res.status === 304;
  if (!okStatus) return false;
  return isImageContentType(res.headers.get('content-type'));
}

/**
 * True if the URL responds with an image Content-Type. Avoids `new Image()` (CORB on error bodies).
 * For Supabase Storage we skip HEAD (many projects return 400) and use GET + Range: bytes=0-0.
 */
async function probePublicImageUrl(url) {
  if (!url) return false;
  // Never probe arbitrary absolute URLs (e.g. `logo_path`); only this project's Storage.
  if (isAbsoluteHttpUrl(url) && !isTrustedSupabaseStorageHttpUrl(url)) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_FETCH_TIMEOUT_MS);

  const fetchRangedGet = () =>
    fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
    });

  const fetchPlainGet = () =>
    fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });

  try {
    let res;
    if (isSupabaseStorageObjectUrl(url)) {
      res = await fetchRangedGet();
      // Some objects / gateways return 400 or 416 for Range; plain GET still returns headers + we cancel the body.
      if (res.status === 400 || res.status === 416) {
        cancelResponseBody(res);
        res = await fetchPlainGet();
      }
      const ok = responseLooksLikeImage(res);
      cancelResponseBody(res);
      return ok;
    }

    res = await fetch(url, {
      method: 'HEAD',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (res.status === 400 || res.status === 405 || res.status === 501) {
      res = await fetchRangedGet();
      const ok = responseLooksLikeImage(res);
      cancelResponseBody(res);
      return ok;
    }

    return responseLooksLikeImage(res);
  } catch (err) {
    if (import.meta.env.DEV && err?.name !== 'AbortError') {
      console.warn('[restaurantImages] probePublicImageUrl:', url.slice(0, 120), err);
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Run async work on `items` with at most `limit` in flight (stable order for indexing).
 */
async function runWithConcurrency(items, limit, worker) {
  if (items.length === 0) return;
  const n = Math.min(Math.max(1, limit), items.length);
  let index = 0;

  async function runWorker() {
    for (;;) {
      const i = index;
      index += 1;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: n }, runWorker));
}

/** Probe ordered URLs with bounded concurrency; return up to `max` hits, preserving order (deduped). */
async function probePublicImageUrlsInOrder(urls, max) {
  const list = urls.filter(Boolean);
  if (list.length === 0 || max <= 0) return [];
  const unique = [...new Set(list)];
  const okByUrl = new Map();

  await runWithConcurrency(unique, PROBE_MAX_CONCURRENT, async (u) => {
    okByUrl.set(u, await probePublicImageUrl(u));
  });

  const out = [];
  const seen = new Set();
  for (const u of list) {
    if (out.length >= max) break;
    if (!okByUrl.get(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export const MAX_HOME_CAROUSEL_SLIDES = 24; // home carousel slide limit

/** How many establishments to resolve in parallel for the home carousel (each does several probes). */
const CAROUSEL_RESOLVE_CONCURRENCY = 5;

// One slide per place: primary image is logo, else hero; bounded parallelism for production loads.
export async function fetchCarouselSlidesFromStorage(supabase, establishments) {
  if (!supabase?.storage || !STORAGE_BUCKET || !SUPABASE_URL || !Array.isArray(establishments) || establishments.length === 0) {
    return [];
  }

  const list = establishments.filter((e) => String(e?.establishment_id ?? '').trim());
  if (list.length === 0) return [];

  const maxScan = Math.min(list.length, MAX_HOME_CAROUSEL_SLIDES * 4);
  const toScan = list.slice(0, maxScan);
  const resolved = new Array(toScan.length);

  await runWithConcurrency(toScan, CAROUSEL_RESOLVE_CONCURRENCY, async (e, i) => {
    const id = String(e.establishment_id).trim();
    const urls = await fetchEstablishmentGalleryUrls(supabase, e);
    if (urls.length === 0) {
      resolved[i] = null;
      return;
    }
    const rawName = e?.name != null ? String(e.name) : '';
    resolved[i] = {
      key: id,
      imageSrc: urls[0],
      alt: rawName ? rawName.slice(0, 200) : 'Restaurant photo',
    };
  });

  return resolved.filter(Boolean).slice(0, MAX_HOME_CAROUSEL_SLIDES);
}


export const MAX_ESTABLISHMENT_GALLERY_IMAGES = 50; // establishment page gallery cap

// Conventional hero/logo path guesses for one establishment.
function getEstablishmentStorageGalleryPaths(restaurant) {
  const id = String(restaurant?.establishment_id ?? '').trim();
  if (!id) return [];

  return getConventionalCandidatePathsById(id);
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

const BRAND_SLOT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

/** First public URL for a brand slot (logo or hero) that returns an image — tries flat then nested paths. */
async function resolveExistingBrandSlotUrl(supabase, folder, establishmentId) {
  const id = String(establishmentId ?? '').trim();
  if (!id || !supabase?.storage || !STORAGE_BUCKET || !SUPABASE_URL) return null;
  for (const prefix of brandSlotPathPrefixes(folder)) {
    for (const ext of BRAND_SLOT_EXTENSIONS) {
      const path = `${prefix}/${id}.${ext}`;
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const url = data?.publicUrl;
      if (url && (await probePublicImageUrl(url))) return url;
    }
  }
  return null;
}

/**
 * Public logo/hero URLs for carousel and cards. Order is always **logo first, then hero** when both exist;
 * callers should use `urls[0]` for a single “primary” image (logo, or hero if no logo).
 * @returns {Promise<string[]>} Empty if `VITE_SUPABASE_*` / client is not configured or establishment has no id.
 */
export async function fetchEstablishmentGalleryUrls(supabase, establishment) {
  if (!supabase?.storage || !STORAGE_BUCKET || !SUPABASE_URL) return [];
  const id = establishment?.establishment_id;
  if (id == null || String(id).trim() === '') return [];

  const [logoUrl, heroUrl] = await Promise.all([
    resolveExistingBrandSlotUrl(supabase, LOGOS_FOLDER, id),
    resolveExistingBrandSlotUrl(supabase, HEROES_FOLDER, id),
  ]);

  const urls = [];
  if (logoUrl && heroUrl) {
    urls.push(logoUrl, heroUrl, logoUrl);
  } else if (logoUrl && !heroUrl) {
    urls.push(logoUrl, logoUrl, logoUrl);
  } else if (heroUrl && !logoUrl) {
    urls.push(heroUrl, heroUrl, heroUrl);
  }
  return urls;
}
