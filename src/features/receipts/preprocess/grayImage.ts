/**
 * A single-channel (grayscale) image: one byte per pixel, 0 = black, 255 = white.
 *
 * Every cleanup step works on this simple shape instead of the browser's RGBA
 * `ImageData`, which keeps the steps small, fast and runnable outside a browser
 * (e.g. in tests).
 */
export interface GrayImage {
  width: number;
  height: number;
  /** Row-major pixels: the pixel at (x, y) is `data[y * width + x]`. */
  data: Uint8ClampedArray;
}

/** Creates a blank image, filled with `fill` (white by default). */
export function createGrayImage(width: number, height: number, fill = 255): GrayImage {
  const data = new Uint8ClampedArray(width * height);
  if (fill !== 0) data.fill(fill);
  return { width, height, data };
}

/** Converts browser RGBA pixels to grayscale using standard luminance weights. */
export function fromRgba(rgba: Uint8ClampedArray, width: number, height: number): GrayImage {
  const gray = createGrayImage(width, height, 0);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    gray.data[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/** Converts grayscale back to RGBA (opaque) so it can be drawn on a canvas. */
export function toRgba(gray: GrayImage): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(gray.width * gray.height * 4);
  for (let i = 0; i < gray.data.length; i++) {
    const v = gray.data[i];
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/**
 * Reads a pixel with bilinear interpolation at a fractional position.
 * Positions outside the image read as white (paper), not black.
 */
export function sampleBilinear(img: GrayImage, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (px: number, py: number) =>
    px < 0 || py < 0 || px >= img.width || py >= img.height ? 255 : img.data[py * img.width + px];
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}
