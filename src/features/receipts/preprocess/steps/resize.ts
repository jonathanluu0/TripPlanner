import { createGrayImage, sampleBilinear, type GrayImage } from '../grayImage';

/**
 * Step: normalize size.
 *
 * The OCR engine reads best when characters are roughly 25–40 px tall. A typical
 * receipt is about 3 inches wide, so scaling it to ~1600 px wide lands text in
 * that range. Small screenshots get enlarged, huge phone photos get shrunk
 * (which also keeps the later steps fast).
 */
const TARGET_WIDTH = 1600;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

export function resizeForOcr(img: GrayImage): GrayImage {
  const scale = clamp(TARGET_WIDTH / img.width, MIN_SCALE, MAX_SCALE);
  if (Math.abs(scale - 1) < 0.05) return img;

  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  const out = createGrayImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out.data[y * width + x] = sampleBilinear(img, (x + 0.5) / scale - 0.5, (y + 0.5) / scale - 0.5);
    }
  }
  return out;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
