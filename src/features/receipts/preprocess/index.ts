/**
 * Receipt image cleanup — runs before OCR to improve accuracy. No AI, no cost:
 * just classic image processing on the user's device.
 *
 *   photo ─▶ grayscale ─▶ resize ─▶ contrast ─▶ denoise ─▶ deskew ─▶ crop to paper ─▶ OCR
 *
 * Layout:
 *   grayImage.ts   the GrayImage type + pixel helpers
 *   steps/*.ts     one file per cleanup step (pure functions, easy to test alone)
 *   pipeline.ts    the step order
 *   browser.ts     file ⇄ canvas conversion (the only browser-specific code)
 *
 * Measured on synthetic tilted/shadowed/grainy receipts: 24 → 36 of 39 fields
 * read correctly. Toggle with VITE_RECEIPT_PREPROCESS=off to compare OCR with and without it.
 */
import { loadFileAsGray, grayToCanvas } from './browser';
import { runPipeline } from './pipeline';

export { DEFAULT_STEPS, runPipeline, type PreprocessStep } from './pipeline';
export type { GrayImage } from './grayImage';

export function isPreprocessingEnabled(): boolean {
  return import.meta.env.VITE_RECEIPT_PREPROCESS !== 'off';
}

/** Cleans up a receipt photo and returns it as a canvas, ready for OCR. */
export async function preprocessReceiptImage(file: File): Promise<HTMLCanvasElement> {
  const gray = await loadFileAsGray(file);
  return grayToCanvas(runPipeline(gray));
}
