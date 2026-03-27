const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'Resturant-logos';
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

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

export function getRestaurantImageCandidates(restaurant) {
  const candidates = [];
  const id = String(restaurant?.establishment_id ?? '').trim();

  if (id) {
    // Match uploaded naming in Supabase Storage bucket root:
    // <establishment_id>_1.(ext) => logo
    // <establishment_id>_2.(ext) => establishment image
    for (const ext of IMAGE_EXTENSIONS) {
      candidates.push(`${id}_2.${ext}`);
      candidates.push(`${id}_1.${ext}`);
      // Backward compatibility if a plain "<id>.<ext>" object exists.
      candidates.push(`${id}.${ext}`);
    }
  }

  return [...new Set(candidates)].map(toImageSrc);
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

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Prefer `_2` (venue photo), then `_1`, then other numbered, then plain `id.ext`. */
function sortFileNamesForCarouselPrimary(names, establishmentId) {
  const id = String(establishmentId ?? '').trim();
  const idLower = id.toLowerCase();
  return [...names].sort((a, b) => {
    const oa = carouselFileOrder(a, idLower);
    const ob = carouselFileOrder(b, idLower);
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });
}

function carouselFileOrder(name, idLower) {
  const nl = name.toLowerCase();
  if (!nl.startsWith(idLower)) return 9999;
  const m = name.match(new RegExp(`^${escapeRegex(idLower)}_(\\d+)\\.`, 'i'));
  if (m) {
    const n = parseInt(m[1], 10);
    if (n === 2) return 0;
    if (n === 1) return 1;
    return 10 + n;
  }
  if (new RegExp(`^${escapeRegex(idLower)}\\.[^.]+$`, 'i').test(name)) return 200;
  return 500;
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

  const imageRe = /\.(png|jpg|jpeg|webp)$/i;
  const { data: files, error } = await supabase.storage.from(bucket).list('', {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error || !Array.isArray(files) || files.length === 0) {
    return fetchCarouselSlidesByProbing(establishments);
  }

  const slides = [];
  for (const e of establishments) {
    if (slides.length >= MAX_HOME_CAROUSEL_SLIDES) break;
    const id = String(e?.establishment_id ?? '').trim();
    if (!id) continue;

    const matched = files.filter(
      (f) =>
        f.name &&
        !f.name.includes('/') &&
        imageRe.test(f.name) &&
        f.name.toLowerCase().startsWith(id.toLowerCase()),
    );
    if (matched.length === 0) continue;

    const sortedNames = sortFileNamesForCarouselPrimary(
      matched.map((f) => f.name),
      id,
    );
    const fileName = sortedNames[0];
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(fileName);
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

/** Max photos per establishment detail page (carousel has a start and end, not infinite). */
export const MAX_ESTABLISHMENT_GALLERY_IMAGES = 9;

/** Distinct storage paths for establishment detail collage (hero + extras). */
function getEstablishmentStorageGalleryPaths(restaurant) {
  const id = String(restaurant?.establishment_id ?? '').trim();
  if (!id) return [];

  const paths = [];
  for (const ext of IMAGE_EXTENSIONS) {
    for (const suffix of ['_8', '_7', '_6', '_5', '_4', '_3', '_2', '_1', '']) {
      paths.push(suffix ? `${id}${suffix}.${ext}` : `${id}.${ext}`);
    }
  }
  return [...new Set(paths)];
}

/**
 * Ordered candidate URLs (not verified). Used as probe order when storage listing fails.
 * Includes header_image when set, then Supabase public paths for _8…_1 and plain id.
 * Capped at {@link MAX_ESTABLISHMENT_GALLERY_IMAGES}.
 */
export function getEstablishmentGalleryUrls(establishment) {
  const urls = [];
  const push = (u) => {
    if (u && typeof u === 'string' && !urls.includes(u)) urls.push(u);
  };

  push(establishment?.header_image);

  for (const p of getEstablishmentStorageGalleryPaths(establishment)) {
    push(toImageSrc(p));
  }

  return urls.slice(0, MAX_ESTABLISHMENT_GALLERY_IMAGES);
}

/** Sort storage filenames for full gallery: `_1`, `_2`, … then plain `id.ext`. */
export function sortEstablishmentFileNamesForGallery(names, establishmentId) {
  const id = String(establishmentId ?? '').trim();
  const idLower = id.toLowerCase();
  return [...names].sort((a, b) => {
    const oa = galleryFileOrder(a, idLower);
    const ob = galleryFileOrder(b, idLower);
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });
}

function galleryFileOrder(name, idLower) {
  const nl = name.toLowerCase();
  if (!nl.startsWith(idLower)) return 9999;
  const m = name.match(new RegExp(`^${escapeRegex(idLower)}_(\\d+)\\.`, 'i'));
  if (m) return parseInt(m[1], 10);
  if (new RegExp(`^${escapeRegex(idLower)}\\.[^.]+$`, 'i').test(name)) return 10000;
  return 500;
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
    const hi = establishment?.header_image;
    if (hi && (await probePublicImageUrl(hi))) return [hi].slice(0, max);
    return [];
  }

  const imageRe = /\.(png|jpg|jpeg|webp)$/i;
  const { data: files, error } = await supabase.storage.from(bucket).list('', {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });

  let urls = [];

  if (!error && Array.isArray(files) && files.length > 0) {
    const idLower = id.toLowerCase();
    const matched = files.filter(
      (f) =>
        f.name &&
        !f.name.includes('/') &&
        imageRe.test(f.name) &&
        f.name.toLowerCase().startsWith(idLower),
    );
    if (matched.length > 0) {
      const sortedNames = sortEstablishmentFileNamesForGallery(
        matched.map((f) => f.name),
        id,
      );
      for (const name of sortedNames) {
        if (urls.length >= max) break;
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(name);
        const url = pub?.publicUrl;
        if (url && !urls.includes(url)) urls.push(url);
      }
    }
  }

  const hi = establishment.header_image;
  if (hi && typeof hi === 'string') {
    const already = urls.includes(hi);
    if (!already && (await probePublicImageUrl(hi))) {
      urls = [hi, ...urls].filter((u, i, a) => a.indexOf(u) === i).slice(0, max);
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
