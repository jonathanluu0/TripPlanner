import type { ReceiptParser } from './index';
import { parseReceiptText } from './heuristics';

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
      const { data } = await worker.recognize(file);
      onProgress?.(1);
      const parsed = parseReceiptText(data.text ?? '');
      return parsed;
    } finally {
      await worker.terminate();
    }
  },
};
