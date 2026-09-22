import type { ReceiptParser } from './index';
import { parseReceiptText } from './heuristics';
import { isPreprocessingEnabled, preprocessReceiptImage } from '../preprocess';

/**
 * Client-default OCR parser. `tesseract.js` is dynamically imported so it never
 * lands in the main bundle — only fetched when a receipt actually needs scanning.
 */
export const tesseractParser: ReceiptParser = {
  name: 'tesseract',
  async parse(file, onProgress) {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', undefined, {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text' && typeof m.progress === 'number') {
          onProgress(Math.min(0.99, m.progress));
        }
      },
    });
    try {
      const image = await prepareImage(file);
      const { data } = await worker.recognize(image);
      onProgress?.(1);
      const parsed = parseReceiptText(data.text ?? '');
      return parsed;
    } finally {
      await worker.terminate();
    }
  },
};

/** Cleans up the photo before OCR; falls back to the original file if cleanup fails. */
async function prepareImage(file: File): Promise<File | HTMLCanvasElement> {
  if (!isPreprocessingEnabled()) return file;
  try {
    return await preprocessReceiptImage(file);
  } catch (err) {
    console.warn('Receipt preprocessing failed; using the original image.', err);
    return file;
  }
}
