import { createGrayImage, type GrayImage } from '../grayImage';

/**
 * Step: adaptive threshold (to pure black & white).
 *
 * A single global cutoff fails on photos with shadows: the shadowed paper is
 * darker than the text in the bright area. Instead, each pixel is compared to
 * the average brightness of its own neighborhood (Bradley–Roth method):
 * it becomes black only if it's clearly darker than what's around it.
 *
 * An "integral image" (running 2-D sum) lets us get any window's sum with
 * 4 lookups, so this is fast even with large windows.
 */
const WINDOW_FRACTION = 1 / 16; // neighborhood size relative to image width
const DARKER_BY = 0.15; // must be 15% darker than the local average to count as ink

export function adaptiveThreshold(img: GrayImage): GrayImage {
  const { width, height, data } = img;
  const integral = buildIntegralImage(img);
  const half = Math.max(8, Math.round((width * WINDOW_FRACTION) / 2));
  const out = createGrayImage(width, height);

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height - 1, y + half);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const windowSum = sumOfWindow(integral, width, x0, y0, x1, y1);
      const localAverage = windowSum / area;
      out.data[y * width + x] = data[y * width + x] < localAverage * (1 - DARKER_BY) ? 0 : 255;
    }
  }
  return out;
}

/**
 * integral[(y+1)*(w+1) + (x+1)] = sum of all pixels above and left of (x, y), inclusive.
 * The extra zero row/column avoids edge checks.
 */
function buildIntegralImage({ width, height, data }: GrayImage): Float64Array {
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += data[y * width + x];
      integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + rowSum;
    }
  }
  return integral;
}

function sumOfWindow(integral: Float64Array, width: number, x0: number, y0: number, x1: number, y1: number): number {
  const stride = width + 1;
  return (
    integral[(y1 + 1) * stride + (x1 + 1)] -
    integral[y0 * stride + (x1 + 1)] -
    integral[(y1 + 1) * stride + x0] +
    integral[y0 * stride + x0]
  );
}
