// Client-side downscale + re-encode to stay under a byte budget (e.g. Supabase bucket limits).

/** Default output cap (matches common Storage bucket limits). */
export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

const DEFAULT_MAX_EDGE = 2560;
const MIN_EDGE = 480;
const JPEG_QUALITIES = [0.92, 0.85, 0.78, 0.7, 0.62, 0.55, 0.5];
const WEBP_QUALITIES = [0.92, 0.85, 0.78, 0.7, 0.62, 0.55, 0.5];

/** Reject absurd inputs before decode (avoids tab hangs / OOM). */
export const MAX_DECODE_INPUT_BYTES = 80 * 1024 * 1024;

const MIN_ALLOWED_MAX_BYTES = 50 * 1024;
const MAX_ALLOWED_MAX_BYTES = 50 * 1024 * 1024;
const MAX_FILENAME_BASE_LENGTH = 120;
const EXIF_ORIENTATION_TAG = 0x0112;

function clampInt(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(x)));
}

function formatMaxSizeLabel(maxBytes) {
  const mb = maxBytes / (1024 * 1024);
  const rounded = mb >= 1 ? Math.round(mb * 10) / 10 : Math.round(maxBytes / 1024);
  return mb >= 1 ? `${rounded} MB` : `${rounded} KB`;
}

/**
 * Safe base name for `File` objects (storage paths, logs). Matches profile upload style.
 * @param {string} name Original file name
 * @returns {string}
 */
export function sanitizeImageFileBaseName(name) {
  const base = String(name || 'image').replace(/\.[^/.]+$/, '');
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  const trimmed = cleaned.slice(0, MAX_FILENAME_BASE_LENGTH);
  return trimmed || 'image';
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error('Could not encode image data.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function readFileChunkAsArrayBuffer(blob, start, end) {
  const chunk = blob.slice(start, end);
  return chunk.arrayBuffer();
}

/**
 * Reads EXIF orientation from JPEG APP1 metadata.
 * Returns 1 when not available/invalid.
 */
async function readJpegExifOrientation(file) {
  const mime = String(file?.type || '').toLowerCase();
  const looksJpeg = mime === 'image/jpeg' || mime === 'image/jpg' || /\.jpe?g$/i.test(file?.name || '');
  if (!looksJpeg) return 1;
  try {
    const buf = await readFileChunkAsArrayBuffer(file, 0, Math.min(file.size, 256 * 1024));
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1; // SOI

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffda || marker === 0xffd9) break; // SOS/EOI
      if ((marker & 0xff00) !== 0xff00) break;
      const segmentLength = view.getUint16(offset, false);
      if (segmentLength < 2 || offset + segmentLength > view.byteLength) break;
      if (marker === 0xffe1 && segmentLength >= 8) {
        const tiffStart = offset + 2;
        const exifHeader =
          view.getUint32(tiffStart, false) === 0x45786966 && view.getUint16(tiffStart + 4, false) === 0;
        if (!exifHeader) return 1;
        const tiffOffset = tiffStart + 6;
        if (tiffOffset + 8 > view.byteLength) return 1;
        const byteOrder = view.getUint16(tiffOffset, false);
        const little = byteOrder === 0x4949;
        if (!little && byteOrder !== 0x4d4d) return 1;
        const ifd0Offset = view.getUint32(tiffOffset + 4, little);
        let ifdOffset = tiffOffset + ifd0Offset;
        if (ifdOffset + 2 > view.byteLength) return 1;
        const entryCount = view.getUint16(ifdOffset, little);
        ifdOffset += 2;
        for (let i = 0; i < entryCount; i++) {
          const entryOffset = ifdOffset + i * 12;
          if (entryOffset + 12 > view.byteLength) return 1;
          const tag = view.getUint16(entryOffset, little);
          if (tag !== EXIF_ORIENTATION_TAG) continue;
          const type = view.getUint16(entryOffset + 2, little);
          const count = view.getUint32(entryOffset + 4, little);
          if (type !== 3 || count !== 1) return 1; // SHORT x1
          const orientation = view.getUint16(entryOffset + 8, little);
          return orientation >= 1 && orientation <= 8 ? orientation : 1;
        }
        return 1;
      }
      offset += segmentLength;
    }
  } catch {
    // Orientation is a best-effort enhancement.
  }
  return 1;
}

function loadHtmlImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_DECODE'));
    };
    img.src = url;
  });
}

/** HEIC/HEIF often lack `<img>`/canvas support outside Safari; match review upload types + filename. */
export function isHeicLike(file) {
  if (!file) return false;
  const t = String(file.type || '').toLowerCase();
  if (t === 'image/heic' || t === 'image/heif' || t === 'image/heic-sequence') return true;
  const n = String(file.name || '').toLowerCase();
  return n.endsWith('.heic') || n.endsWith('.heif');
}

async function convertHeicLikeToJpegFile(file) {
  let heic2any;
  try {
    ({ default: heic2any } = await import('heic2any'));
  } catch {
    throw new Error('Could not load HEIC support. Check your connection and try again.');
  }
  if (typeof heic2any !== 'function') {
    throw new Error('HEIC conversion is not available in this build.');
  }
  try {
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob || blob.size === 0) {
      throw new Error('HEIC conversion produced an empty file.');
    }
    const base = sanitizeImageFileBaseName(file.name);
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/memory|allocation|too large/i.test(msg)) {
      throw new Error('This HEIC image is too large to convert in the browser. Try a smaller photo or export as JPEG.');
    }
    if (/invalid|corrupt|parse|format/i.test(msg)) {
      throw new Error('This HEIC file could not be read. Try another photo or export as JPEG from your device.');
    }
    throw new Error('Could not convert HEIC/HEIF. Try exporting as JPEG or PNG from your device.');
  }
}

/**
 * Prefer createImageBitmap (broad decode in capable browsers), then HEIC via heic2any + Image, else Image.
 * @returns {{ draw: ImageBitmap | HTMLImageElement, close: () => void, orientation: number }}
 */
async function loadDrawable(file) {
  const orientation = await readJpegExifOrientation(file);
  try {
    const bitmap = await createImageBitmap(file);
    return {
      draw: bitmap,
      orientation,
      close: () => {
        try {
          bitmap.close();
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    /* fall through */
  }

  if (isHeicLike(file)) {
    const jpegFile = await convertHeicLikeToJpegFile(file);
    const img = await loadHtmlImage(jpegFile);
    return { draw: img, close: () => {}, orientation: 1 };
  }

  const img = await loadHtmlImage(file);
  return { draw: img, close: () => {}, orientation };
}

function drawableSize(draw) {
  if (draw instanceof ImageBitmap) {
    return { w: draw.width, h: draw.height };
  }
  const w = draw.naturalWidth || draw.width;
  const h = draw.naturalHeight || draw.height;
  return { w, h };
}

function orientedSize(width, height, orientation) {
  if (orientation >= 5 && orientation <= 8) {
    return { w: height, h: width };
  }
  return { w: width, h: height };
}

function drawWithOrientation(ctx, drawable, orientation, srcW, srcH, dstW, dstH) {
  if (orientation === 1) {
    ctx.drawImage(drawable, 0, 0, dstW, dstH);
    return;
  }
  ctx.save();
  switch (orientation) {
    case 2: // horizontal flip
      ctx.translate(dstW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(drawable, 0, 0, dstW, dstH);
      break;
    case 3: // 180
      ctx.translate(dstW, dstH);
      ctx.rotate(Math.PI);
      ctx.drawImage(drawable, 0, 0, dstW, dstH);
      break;
    case 4: // vertical flip
      ctx.translate(0, dstH);
      ctx.scale(1, -1);
      ctx.drawImage(drawable, 0, 0, dstW, dstH);
      break;
    case 5: // transpose
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      ctx.drawImage(drawable, 0, 0, dstH, dstW);
      break;
    case 6: // 90 CW
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -dstH);
      ctx.drawImage(drawable, 0, 0, dstH, dstW);
      break;
    case 7: // transverse
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(dstW, -dstH);
      ctx.scale(-1, 1);
      ctx.drawImage(drawable, 0, 0, dstH, dstW);
      break;
    case 8: // 270 CW
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-dstW, 0);
      ctx.drawImage(drawable, 0, 0, dstH, dstW);
      break;
    default:
      ctx.drawImage(drawable, 0, 0, dstW, dstH);
      break;
  }
  ctx.restore();
  // srcW/srcH kept for future crop-aware variants
  void srcW;
  void srcH;
}

/**
 * @param {File} file
 * @param {boolean | 'auto'} preservePng
 */
function shouldOutputPng(file, preservePng) {
  if (preservePng === true) return true;
  if (preservePng === false) return false;
  return file.type === 'image/png' || /\.png$/i.test(file.name || '');
}

/**
 * @param {File} file
 * @param {boolean | 'auto'} preserveWebp
 */
function shouldOutputWebp(file, preserveWebp) {
  if (preserveWebp === true) return true;
  if (preserveWebp === false) return false;
  return file.type === 'image/webp' || /\.webp$/i.test(file.name || '');
}

/**
 * Resize and re-encode an image so its byte size is at most `maxBytes`.
 * If the file is already smaller, returns it unchanged.
 * PNG inputs may stay PNG (transparency); other types become JPEG.
 *
 * @param {File} file
 * @param {{ maxBytes?: number, maxEdge?: number, preservePng?: boolean | 'auto', preserveWebp?: boolean | 'auto', force?: boolean }} [options]
 * @param {boolean} [options.force] If true, always decode and re-encode (fixes previews and guarantees size bound).
 * @returns {Promise<File>}
 */
export async function compressImageFile(file, options = {}) {
  if (typeof document === 'undefined') {
    throw new Error('Image compression is only available in the browser.');
  }
  const maxBytes = clampInt(
    options.maxBytes ?? DEFAULT_MAX_BYTES,
    MIN_ALLOWED_MAX_BYTES,
    MAX_ALLOWED_MAX_BYTES,
    DEFAULT_MAX_BYTES,
  );
  const maxEdge = clampInt(options.maxEdge ?? DEFAULT_MAX_EDGE, MIN_EDGE, 16384, DEFAULT_MAX_EDGE);
  const preservePngOpt = options.preservePng === undefined ? 'auto' : options.preservePng;
  const preserveWebpOpt = options.preserveWebp === undefined ? 'auto' : options.preserveWebp;
  const force = options.force === true;

  if (!file || !(file instanceof Blob) || file.size === 0) {
    throw new Error('Invalid image file.');
  }

  if (file.size > MAX_DECODE_INPUT_BYTES) {
    throw new Error(
      `This image is too large to process here (over ${formatMaxSizeLabel(MAX_DECODE_INPUT_BYTES)}). Try a smaller file or export a copy from your photos app.`,
    );
  }

  const skipEncode = !force && file.size <= maxBytes;
  if (skipEncode) {
    return file instanceof File ? file : new File([file], 'image.jpg', { type: file.type || 'image/jpeg' });
  }

  const safeBase = sanitizeImageFileBaseName(file.name);

  let releaseDrawable = () => {};
  try {
    let drawable;
    let orientation = 1;
    try {
      const loaded = await loadDrawable(file);
      drawable = loaded.draw;
      releaseDrawable = loaded.close;
      orientation = loaded.orientation || 1;
    } catch (err) {
      if (err instanceof Error && err.message !== 'IMAGE_DECODE') {
        throw err;
      }
      throw new Error(
        'This image could not be processed. Try a different photo or export as JPEG/PNG from your device.',
      );
    }

    const { w: srcW, h: srcH } = drawableSize(drawable);
    if (!srcW || !srcH) {
      throw new Error('Invalid image dimensions.');
    }
    const { w: nw, h: nh } = orientedSize(srcW, srcH, orientation);

    const isPng = shouldOutputPng(file, preservePngOpt);
    const isWebp = !isPng && shouldOutputWebp(file, preserveWebpOpt);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to process images in this browser.');
    }

    let edge = Math.min(maxEdge, Math.max(nw, nh));

    for (;;) {
      const scale = edge / Math.max(nw, nh);
      const w = Math.max(1, Math.round(nw * scale));
      const h = Math.max(1, Math.round(nh * scale));
      canvas.width = w;
      canvas.height = h;
      try {
        drawWithOrientation(ctx, drawable, orientation, srcW, srcH, w, h);
      } catch {
        throw new Error('Could not resize this image. It may be too large for this device.');
      }

      if (isPng) {
        try {
          const blob = await canvasToBlob(canvas, 'image/png');
          if (blob.size <= maxBytes) {
            return new File([blob], `${safeBase}.png`, { type: 'image/png' });
          }
        } catch {
          /* try smaller dimensions */
        }
      } else if (isWebp) {
        let webpSupported = true;
        for (const q of WEBP_QUALITIES) {
          try {
            const blob = await canvasToBlob(canvas, 'image/webp', q);
            if (blob.type !== 'image/webp') {
              webpSupported = false;
              break;
            }
            if (blob.size <= maxBytes) {
              return new File([blob], `${safeBase}.webp`, { type: 'image/webp' });
            }
          } catch {
            // Some browsers do not support WebP encode in canvas; fall back to JPEG below.
            webpSupported = false;
            break;
          }
        }
        if (!webpSupported) {
          for (const q of JPEG_QUALITIES) {
            try {
              const blob = await canvasToBlob(canvas, 'image/jpeg', q);
              if (blob.size <= maxBytes) {
                return new File([blob], `${safeBase}.jpg`, { type: 'image/jpeg' });
              }
            } catch {
              /* try next quality */
            }
          }
        }
      } else {
        for (const q of JPEG_QUALITIES) {
          try {
            const blob = await canvasToBlob(canvas, 'image/jpeg', q);
            if (blob.size <= maxBytes) {
              return new File([blob], `${safeBase}.jpg`, { type: 'image/jpeg' });
            }
          } catch {
            /* try next quality */
          }
        }
      }

      edge = Math.floor(edge * 0.82);
      if (edge < MIN_EDGE) {
        throw new Error(
          `Could not shrink this image under ${formatMaxSizeLabel(maxBytes)}. Try another photo or a smaller original.`,
        );
      }
    }
  } finally {
    releaseDrawable();
  }
}
