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
 *  1. contrast, so faint text is dark enough for the later steps to measure;
 *  2. denoise before deskew/crop, so camera grain doesn't confuse them;
 *  3. deskew before crop, so the crop box fits the straightened paper;
 *  4. crop before resize — this is the important one. Scaling the whole photo
 *     first would leave the receipt itself smaller than the target width
 *     (a receipt filling two thirds of the frame ends up two thirds the size),
 *     and the small print at the bottom drops below what OCR can read.
 *     Cropping to the paper first means the paper is what gets scaled up.
 * (Grayscale conversion happens when the image is loaded — see browser.ts.)
 *
 * Deliberately NOT included (measured on test receipts, both lowered accuracy):
 *  - sharpening: amplifies camera grain;
 *  - a final black & white threshold: the OCR engine binarizes internally and does
 *    slightly better from clean grayscale. (steps/threshold.ts is still used by deskew.)
 */
export const DEFAULT_STEPS: PreprocessStep[] = [
  { name: 'contrast', run: stretchContrast },
  { name: 'denoise', run: denoise },
  { name: 'deskew', run: deskew },
  { name: 'cropToPaper', run: cropToPaper },
  { name: 'resize', run: resizeForOcr },
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
