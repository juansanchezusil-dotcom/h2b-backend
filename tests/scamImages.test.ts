import { describe, expect, it } from 'vitest';
import { MAX_SCAM_BASE64_TOTAL, parseScamImages } from '../src/ai/scamImages';

const img = (base64: string, mediaType = 'image/jpeg') => ({ base64, mediaType });

describe('parseScamImages', () => {
  it('accepts the new format and strips the data URL prefix', () => {
    const r = parseScamImages({ images: [img('data:image/jpeg;base64,QUJD')] });
    expect(r).toEqual({ ok: true, images: [{ mimeType: 'image/jpeg', data: 'QUJD' }] });
  });

  it('accepts the old single-image format', () => {
    const r = parseScamImages({ imageBase64: 'QUJD', mediaType: 'image/png' });
    expect(r.ok && r.images[0].mimeType).toBe('image/png');
  });

  it('rejects an empty request and more than 5 images', () => {
    expect(parseScamImages({}).ok).toBe(false);
    expect(parseScamImages(null).ok).toBe(false);
    expect(parseScamImages({ images: Array(6).fill(img('QUJD')) }).ok).toBe(false);
  });

  it('rejects non-image types and missing data', () => {
    expect(parseScamImages({ images: [img('QUJD', 'application/pdf')] }).ok).toBe(false);
    expect(parseScamImages({ images: [img('QUJD', 'text/html')] }).ok).toBe(false);
    expect(parseScamImages({ images: [img('')] }).ok).toBe(false);
    expect(parseScamImages({ images: [{ base64: 123, mediaType: 'image/jpeg' }] }).ok).toBe(false);
  });

  it('rejects images whose total size passes the limit with 413', () => {
    const half = 'A'.repeat(MAX_SCAM_BASE64_TOTAL / 2 + 1);
    const r = parseScamImages({ images: [img(half), img(half)] });
    expect(r).toMatchObject({ ok: false, status: 413 });
  });
});
