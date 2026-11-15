// Validates the images sent to the scam detectors (/api/analyze-scam-image and /api/detector-web).
// Vercel rejects request bodies above ~4.5 MB before the route runs, so these limits mostly turn a
// confusing platform error into a clear message, and keep non-image data away from the model.

export const SCAM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const MAX_SCAM_IMAGES = 5;
// Base64 characters across all images (~3.3 MB of files), under the Vercel body limit
export const MAX_SCAM_BASE64_TOTAL = 4_400_000;

export interface ScamImage {
  mimeType: string;
  data: string;
}

export type ScamImagesResult = { ok: true; images: ScamImage[] } | { ok: false; status: number; error: string };

// Accepts the new format ({ images: [...] }) and the old one ({ imageBase64, mediaType })
export function parseScamImages(body: unknown): ScamImagesResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const raw: unknown[] = Array.isArray(b.images)
    ? b.images
    : typeof b.imageBase64 === 'string'
      ? [{ base64: b.imageBase64, mediaType: b.mediaType }]
      : [];

  if (raw.length === 0) return { ok: false, status: 400, error: 'Falta al menos una imagen' };
  if (raw.length > MAX_SCAM_IMAGES) return { ok: false, status: 400, error: `Máximo ${MAX_SCAM_IMAGES} imágenes por análisis` };

  const images: ScamImage[] = [];
  let total = 0;
  for (const item of raw) {
    const img = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const mimeType = typeof img.mediaType === 'string' ? img.mediaType.toLowerCase() : '';
    const data = typeof img.base64 === 'string' ? img.base64.replace(/^data:[^;]+;base64,/, '') : '';
    if (!data || !SCAM_IMAGE_TYPES.includes(mimeType)) {
      return { ok: false, status: 400, error: 'Sube solo imágenes (JPG, PNG, WebP o HEIC).' };
    }
    total += data.length;
    if (total > MAX_SCAM_BASE64_TOTAL) {
      return { ok: false, status: 413, error: 'Las imágenes pesan demasiado. Sube menos imágenes o capturas más livianas.' };
    }
    images.push({ mimeType, data });
  }
  return { ok: true, images };
}
