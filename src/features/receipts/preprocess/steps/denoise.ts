import { createGrayImage, type GrayImage } from '../grayImage';

/**
 * Step: remove noise (3×3 median filter).
 *
 * Each pixel becomes the median of itself and its 8 neighbors. Random camera
 * grain (a single odd pixel) is outvoted by its neighbors and disappears, while
 * real edges survive — unlike a blur, a median doesn't smear letter shapes.
 */
export function denoise(img: GrayImage): GrayImage {
  const { width, height, data } = img;
  const out = createGrayImage(width, height, 0);
  const window = new Array<number>(9);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let i = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const py = Math.min(height - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const px = Math.min(width - 1, Math.max(0, x + dx));
          window[i++] = data[py * width + px];
        }
      }
      window.sort((a, b) => a - b);
      out.data[y * width + x] = window[4];
    }
  }
  return out;
}
