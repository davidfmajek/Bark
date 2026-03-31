const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'Resturant-logos';
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
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
    // Legacy fallback for prior root-level naming.
    paths.push(fileName);
  }
  return [...new Set(paths)];
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
    // Current convention prefers folder paths over root-level files.
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
      // Cards should prioritize logo over hero.
      candidates.push(`${LOGOS_FOLDER}/${fileName}`);
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

/**
 * @deprecated Prefer {@link fetchCarouselSlidesFromStorage} — this used the first guessed URL per
 * restaurant without checking the object exists, which breaks the homepage carousel.
 */
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
  const imageRe = /\.(png|jpg|jpeg|webp)$/i;
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
    // list(folder) returns names relative to that folder, so only these two sets are reliable.
    if (p.startsWith(`${HEROES_FOLDER}/`) && heroesSet.has(p)) return p;
    if (p.startsWith(`${LOGOS_FOLDER}/`) && logosSet.has(p)) return p;
  }
  return null;
}

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

/** Safety cap for homepage background + hero carousels. */
export const MAX_HOME_CAROUSEL_SLIDES = 24;

/**
 * One slide per establishment that has at least one image in the storage bucket.
 * Lists the bucket once, then picks the best matching file per establishment.
 */
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

/** Max photos per establishment detail page (collage + modal). */
export const MAX_ESTABLISHMENT_GALLERY_IMAGES = 50;

/** Distinct storage paths for establishment detail collage (hero + extras). */
function getEstablishmentStorageGalleryPaths(restaurant) {
  const id = String(restaurant?.establishment_id ?? '').trim();
  if (!id) return [];

  return getConventionalCandidatePathsById(id);
}

/**
 * Ordered candidate URLs (not verified). Used as probe order when storage listing fails.
 * Includes explicit header image path when set, then conventional folder-based paths.
 * Capped at {@link MAX_ESTABLISHMENT_GALLERY_IMAGES}.
 */
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

async function fetchReviewImageUrlsForEstablishment(supabase, establishmentId) {
  if (!supabase || !establishmentId) return [];
  const { data, error } = await supabase
    .from('review_images')
    .select('storage_url, display_order, reviews!inner(establishment_id)')
    .eq('reviews.establishment_id', establishmentId)
    .order('display_order', { ascending: true });

  if (error || !Array.isArray(data) || data.length === 0) return [];

  const urls = [];
  for (const row of data) {
    const candidates = getPathOrUrlCandidateUrls(supabase, row?.storage_url);
    for (const url of candidates) {
      if (!urls.includes(url)) urls.push(url);
    }
  }
  return urls;
}

/**
 * Resolves only URLs for objects that exist in Storage (or loadable header_image).
 * Returns all matching files for this establishment, up to {@link MAX_ESTABLISHMENT_GALLERY_IMAGES}.
 */
export async function fetchEstablishmentGalleryUrls(supabase, establishment) {
  const id = String(establishment?.establishment_id ?? '').trim();
  const bucket = STORAGE_BUCKET;
  const max = MAX_ESTABLISHMENT_GALLERY_IMAGES;

  if (!establishment || !supabase || !bucket || !id) {
    const explicit = getPathOrUrlCandidateUrls(supabase, establishment?.header_image_path);
    if (explicit.length > 0 && (await probePublicImageUrl(explicit[0]))) {
      return [explicit[0]].slice(0, max);
    }
    const hi = establishment?.header_image;
    if (hi && (await probePublicImageUrl(hi))) return [hi].slice(0, max);
    return [];
  }

  const [heroPaths, logoPaths] = await Promise.all([
    listImagePathsInFolder(supabase, bucket, HEROES_FOLDER),
    listImagePathsInFolder(supabase, bucket, LOGOS_FOLDER),
  ]);
  const heroesSet = new Set(heroPaths);
  const logosSet = new Set(logoPaths);

  let urls = [];

  const explicitLogo = getPathOrUrlCandidateUrls(supabase, establishment?.logo_path);
  if (explicitLogo.length > 0) {
    urls.push(explicitLogo[0]);
  }

  const explicit = getPathOrUrlCandidateUrls(supabase, establishment?.header_image_path);
  if (explicit.length > 0) {
    urls.push(explicit[0]);
  }

  // Include both conventional hero/logo assets for this establishment if present.
  for (const p of getConventionalCandidatePathsById(id)) {
    if (urls.length >= max) break;
    const isHeroPath = p.startsWith(`${HEROES_FOLDER}/`);
    const isLogoPath = p.startsWith(`${LOGOS_FOLDER}/`);
    const exists = (isHeroPath && heroesSet.has(p)) || (isLogoPath && logosSet.has(p));
    if (!exists) continue;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(p);
    const url = pub?.publicUrl;
    if (url && !urls.includes(url)) urls.push(url);
  }

  const hi = establishment.header_image;
  if (hi && typeof hi === 'string') {
    const already = urls.includes(hi);
    if (!already && (await probePublicImageUrl(hi))) {
      urls = [hi, ...urls].filter((u, i, a) => a.indexOf(u) === i).slice(0, max);
    }
  }

  // Append all review images for this establishment.
  if (urls.length < max) {
    const reviewImageUrls = await fetchReviewImageUrlsForEstablishment(supabase, id);
    for (const reviewUrl of reviewImageUrls) {
      if (urls.length >= max) break;
      if (!reviewUrl || urls.includes(reviewUrl)) continue;
      urls.push(reviewUrl);
    }
  }

  if (urls.length > 0) {
    return urls.slice(0, max);
  }

  const candidates = getEstablishmentGalleryUrls(establishment);
  const verified = [];
  for (const url of candidates) {
    if (verified.length >= max) break;
    if (!url) continue;
    if (await probePublicImageUrl(url)) verified.push(url);
  }
  return verified;
}
