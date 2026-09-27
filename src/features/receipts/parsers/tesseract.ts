import type { ParsedReceipt } from '../../../types';
import type { ReceiptParser } from './index';
import { parseReceiptText } from './heuristics';
import { isPreprocessingEnabled, preprocessReceiptImage } from '../preprocess';

/**
 * Client-default OCR parser. `tesseract.js` is dynamically imported so it never
 * lands in the main bundle — only fetched when a receipt actually needs scanning.
 *
 * Two passes:
 *  1. the whole receipt, which gets the items;
 *  2. if that found no printed total, the bottom section magnified — where the
 *     totals live, in the smallest, densest print on the page. On a long
 *     supermarket receipt the first pass often can't read those lines at all.
 */
const TAIL_FRACTION = 0.3; // how much of the bottom to re-read
const TAIL_ZOOM = 2;
const TAIL_PAGE_MODE = 6 as unknown as import('tesseract.js').PSM; // PSM.SINGLE_BLOCK — suits a receipt footer

export const tesseractParser: ReceiptParser = {
  name: 'tesseract',
  async parse(file, onProgress) {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', undefined, {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text' && typeof m.progress === 'number') {
          onProgress(Math.min(0.95, m.progress));
        }
      },
    });
    try {
      const image = await prepareImage(file);
      const { data } = await worker.recognize(image);
      const parsed = parseReceiptText(data.text ?? '');

      if (parsed.totalSource === 'printed' || !(image instanceof HTMLCanvasElement)) {
        onProgress?.(1);
        return parsed;
      }

      // Second pass over the footer, looking for the total we missed.
      await worker.setParameters({ tessedit_pageseg_mode: TAIL_PAGE_MODE });
      const { data: tailData } = await worker.recognize(magnifyBottom(image));
      onProgress?.(1);
      return mergeFooter(parsed, parseReceiptText(tailData.text ?? ''));
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

/** The bottom slice of the receipt, scaled up so small print becomes readable. */
function magnifyBottom(source: HTMLCanvasElement): HTMLCanvasElement {
  const sliceHeight = Math.round(source.height * TAIL_FRACTION);
  const canvas = document.createElement('canvas');
  canvas.width = source.width * TAIL_ZOOM;
  canvas.height = sliceHeight * TAIL_ZOOM;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    source,
    0, source.height - sliceHeight, source.width, sliceHeight,
    0, 0, canvas.width, canvas.height,
  );
  return canvas;
}

/**
 * Keeps the items from the full-page pass and takes the money totals from the
 * footer pass, which only sees the bottom and reads it far more reliably.
 */
function mergeFooter(main: ParsedReceipt, footer: ParsedReceipt): ParsedReceipt {
  if (footer.totalSource !== 'printed') return main;

  const itemsSum = main.items.reduce((sum, item) => sum + item.basePrice * item.quantity, 0);
  const tax = footer.tax || main.tax;
  const tip = footer.tip || main.tip;
  const fees = footer.fees.length > 0 ? footer.fees : main.fees;
  const feesSum = fees.reduce((sum, fee) => sum + fee.amount, 0);
  const reconciles = Math.abs(itemsSum + tax + tip + feesSum - footer.total) <= Math.max(50, footer.total * 0.03);

  return {
    ...main,
    tax,
    tip,
    fees,
    total: footer.total,
    totalSource: 'printed',
    // The printed total is trustworthy; the items may still be patchy, and we
    // say so unless everything adds up.
    confidence: reconciles ? 0.9 : 0.55,
    rawText: `${main.rawText ?? ''}\n--- footer pass ---\n${footer.rawText ?? ''}`,
  };
}
