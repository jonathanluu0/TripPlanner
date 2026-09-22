import { fromRgba, toRgba, type GrayImage } from './grayImage';

/**
 * The only file in this module that touches browser APIs (Image, canvas).
 * Everything else is plain array math.
 */

/** Decodes an image file and converts it to grayscale. */
export async function loadFileAsGray(file: File): Promise<GrayImage> {
  const bitmap = await createImageBitmap(file); // also applies the photo's EXIF rotation
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = getContext(canvas);
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return fromRgba(data, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** Draws a grayscale image onto a new canvas (which the OCR engine accepts directly). */
export function grayToCanvas(gray: GrayImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = gray.width;
  canvas.height = gray.height;
  getContext(canvas).putImageData(new ImageData(toRgba(gray), gray.width, gray.height), 0, 0);
  return canvas;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available');
  return ctx;
}
