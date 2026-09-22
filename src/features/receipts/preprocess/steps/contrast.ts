import { createGrayImage, type GrayImage } from '../grayImage';

/**
 * Step: stretch contrast.
 *
 * Faded thermal paper often uses only a narrow band of grays (e.g. 90–200).
 * We find the darkest and lightest 1% of pixels and stretch that range to the
 * full 0–255, so faint text becomes dark and gray paper becomes white.
 * Using percentiles (not the absolute min/max) ignores a few stray specks.
 */
const CLIP_PERCENT = 0.01;

export function stretchContrast(img: GrayImage): GrayImage {
  const histogram = new Array<number>(256).fill(0);
  for (const v of img.data) histogram[v]++;

  const clipCount = img.data.length * CLIP_PERCENT;
  const low = findPercentile(histogram, clipCount, 'fromDark');
  const high = findPercentile(histogram, clipCount, 'fromLight');
  if (high - low < 10) return img; // flat image — nothing sensible to stretch

  const out = createGrayImage(img.width, img.height, 0);
  const scale = 255 / (high - low);
  for (let i = 0; i < img.data.length; i++) {
    out.data[i] = (img.data[i] - low) * scale; // Uint8ClampedArray clamps to 0..255
  }
  return out;
}

function findPercentile(histogram: number[], clipCount: number, direction: 'fromDark' | 'fromLight'): number {
  let seen = 0;
  for (let step = 0; step < 256; step++) {
    const value = direction === 'fromDark' ? step : 255 - step;
    seen += histogram[value];
    if (seen > clipCount) return value;
  }
  return direction === 'fromDark' ? 0 : 255;
}
