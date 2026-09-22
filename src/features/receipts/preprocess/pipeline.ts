import type { GrayImage } from './grayImage';
import { resizeForOcr } from './steps/resize';
import { stretchContrast } from './steps/contrast';
import { denoise } from './steps/denoise';
import { deskew } from './steps/deskew';
import { cropToPaper } from './steps/cropToPaper';

/** One cleanup step: takes a grayscale image, returns a new one. Pure — no browser APIs. */
export interface PreprocessStep {
  name: string;
  run: (img: GrayImage) => GrayImage;
}

/**
 * The default order matters:
 *  1. resize first, so every later step works at OCR resolution;
 *  2. contrast, so faint text is dark enough to measure;
 *  3. denoise before deskew/crop, so camera grain doesn't confuse them;
 *  4. deskew before crop, so the crop box fits the straightened paper.
 * (Grayscale conversion happens when the image is loaded — see browser.ts.)
 *
 * Deliberately NOT included (measured on test receipts, both lowered accuracy):
 *  - sharpening: amplifies camera grain;
 *  - a final black & white threshold: the OCR engine binarizes internally and does
 *    slightly better from clean grayscale. (steps/threshold.ts is still used by deskew.)
 */
export const DEFAULT_STEPS: PreprocessStep[] = [
  { name: 'resize', run: resizeForOcr },
  { name: 'contrast', run: stretchContrast },
  { name: 'denoise', run: denoise },
  { name: 'deskew', run: deskew },
  { name: 'cropToPaper', run: cropToPaper },
];

/** Runs the steps in order. `onStep` is handy for debugging/visualizing each stage. */
export function runPipeline(
  img: GrayImage,
  steps: PreprocessStep[] = DEFAULT_STEPS,
  onStep?: (name: string, result: GrayImage) => void,
): GrayImage {
  return steps.reduce((current, step) => {
    const result = step.run(current);
    onStep?.(step.name, result);
    return result;
  }, img);
}
