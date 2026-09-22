import { createGrayImage, sampleBilinear, type GrayImage } from '../grayImage';
import { adaptiveThreshold } from './threshold';

/**
 * Step: straighten (deskew).
 *
 * Idea: when text lines are perfectly horizontal, the dark pixels pile up into
 * a few rows (the lines of text) with empty rows between them. When the image
 * is tilted, they smear across many rows. So we try a range of angles, and for
 * each one count dark pixels per row ("projection profile"). The angle whose
 * profile is the most peaky (highest sum of squares) is the text's tilt.
 * We then rotate the image by the opposite angle.
 */
const MAX_ANGLE_DEG = 10;
const ANGLE_STEP_DEG = 0.25;
const MIN_CORRECTION_DEG = 0.3; // smaller tilts don't hurt OCR; skip the resample
const ANALYSIS_WIDTH = 500; // estimate on a small copy — much faster, same answer

export function deskew(img: GrayImage): GrayImage {
  const angle = estimateSkewDegrees(img);
  if (Math.abs(angle) < MIN_CORRECTION_DEG) return img;
  return rotate(img, -angle);
}

/** Returns the text tilt in degrees (positive = text slopes down to the right). */
export function estimateSkewDegrees(img: GrayImage): number {
  const darkPixels = collectDarkPixels(img);
  if (darkPixels.length < 50) return 0;

  let bestAngle = 0;
  let bestScore = -1;
  for (let deg = -MAX_ANGLE_DEG; deg <= MAX_ANGLE_DEG; deg += ANGLE_STEP_DEG) {
    const score = profileScore(darkPixels, deg);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = deg;
    }
  }
  return bestAngle;
}

/**
 * Ink-pixel coordinates from a downsampled copy, as a flat [x0, y0, x1, y1, ...] list.
 * "Ink" = darker than its surroundings (adaptive threshold), so a dark table or
 * shadow around the receipt isn't mistaken for text.
 */
function collectDarkPixels(img: GrayImage): number[] {
  const small = shrink(img, Math.max(1, Math.floor(img.width / ANALYSIS_WIDTH)));
  const ink = adaptiveThreshold(small);
  const points: number[] = [];
  for (let y = 0; y < ink.height; y++) {
    for (let x = 0; x < ink.width; x++) {
      if (ink.data[y * ink.width + x] === 0) points.push(x, y);
    }
  }
  return points;
}

/** Keeps every `step`-th pixel in each direction (fast, good enough for measuring angles). */
function shrink(img: GrayImage, step: number): GrayImage {
  if (step === 1) return img;
  const width = Math.floor(img.width / step);
  const height = Math.floor(img.height / step);
  const out = createGrayImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) out.data[y * width + x] = img.data[y * step * img.width + x * step];
  }
  return out;
}

/** How "peaky" the row histogram is if we undo a tilt of `deg` degrees. */
function profileScore(points: number[], deg: number): number {
  const rad = (deg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const rows = new Map<number, number>();
  for (let i = 0; i < points.length; i += 2) {
    const row = Math.round(points[i + 1] * cos - points[i] * sin);
    rows.set(row, (rows.get(row) ?? 0) + 1);
  }
  let score = 0;
  for (const n of rows.values()) score += n * n;
  return score;
}

/** Rotates around the center by `deg` degrees; uncovered corners become white. */
export function rotate(img: GrayImage, deg: number): GrayImage {
  const rad = (deg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const cx = img.width / 2;
  const cy = img.height / 2;
  const out = createGrayImage(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      // For each output pixel, look up where it came from in the source (inverse rotation).
      const dx = x - cx;
      const dy = y - cy;
      const srcX = dx * cos + dy * sin + cx;
      const srcY = -dx * sin + dy * cos + cy;
      out.data[y * img.width + x] = sampleBilinear(img, srcX, srcY);
    }
  }
  return out;
}
