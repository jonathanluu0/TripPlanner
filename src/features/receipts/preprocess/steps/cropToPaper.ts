import type { GrayImage } from '../grayImage';

/**
 * Step: crop to the receipt paper.
 *
 * Phone photos usually include the table around the receipt, which the OCR
 * engine tries (and fails) to read as text. The paper is the biggest bright
 * area, so we:
 *   1. shrink the image to a coarse grid (fast, and ignores the text itself),
 *   2. split cells into bright/dark with Otsu's method (an automatic cutoff),
 *   3. find the largest connected bright region = the paper,
 *   4. crop the full image to that region's bounding box.
 * Screenshots (already all paper) are left as they are.
 */
const GRID_WIDTH = 120;
const SKIP_IF_PAPER_COVERS = 0.85; // already tightly framed — nothing to crop

export function cropToPaper(img: GrayImage): GrayImage {
  const cell = Math.max(1, Math.floor(img.width / GRID_WIDTH));
  const grid = downsample(img, cell);
  const cutoff = otsuThreshold(grid.values);
  const box = largestBrightRegion(grid, cutoff);
  if (!box) return img;

  const boxArea = (box.right - box.left + 1) * (box.bottom - box.top + 1);
  if (boxArea >= grid.cols * grid.rows * SKIP_IF_PAPER_COVERS) return img;

  return crop(img, {
    left: box.left * cell,
    top: box.top * cell,
    right: Math.min(img.width - 1, (box.right + 1) * cell - 1),
    bottom: Math.min(img.height - 1, (box.bottom + 1) * cell - 1),
  });
}

interface Grid {
  cols: number;
  rows: number;
  values: number[]; // average brightness of each cell
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function downsample(img: GrayImage, cell: number): Grid {
  const cols = Math.floor(img.width / cell);
  const rows = Math.floor(img.height / cell);
  const values: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let y = r * cell; y < (r + 1) * cell; y++) {
        for (let x = c * cell; x < (c + 1) * cell; x++) sum += img.data[y * img.width + x];
      }
      values.push(sum / (cell * cell));
    }
  }
  return { cols, rows, values };
}

/** Otsu's method: the cutoff that best separates values into two groups (dark vs bright). */
function otsuThreshold(values: number[]): number {
  const histogram = new Array<number>(256).fill(0);
  for (const v of values) histogram[Math.round(v)]++;

  const total = values.length;
  const totalSum = histogram.reduce((sum, count, level) => sum + count * level, 0);
  let darkCount = 0;
  let darkSum = 0;
  let bestCutoff = 128;
  let bestSeparation = -1;
  for (let level = 0; level < 256; level++) {
    darkCount += histogram[level];
    darkSum += level * histogram[level];
    const brightCount = total - darkCount;
    if (darkCount === 0 || brightCount === 0) continue;
    const darkMean = darkSum / darkCount;
    const brightMean = (totalSum - darkSum) / brightCount;
    const separation = darkCount * brightCount * (darkMean - brightMean) ** 2;
    if (separation > bestSeparation) {
      bestSeparation = separation;
      bestCutoff = level;
    }
  }
  return bestCutoff;
}

/** Flood-fills bright cells and returns the bounding box of the biggest connected group. */
function largestBrightRegion({ cols, rows, values }: Grid, cutoff: number): Box | null {
  const visited = new Uint8Array(values.length);
  let best: { size: number; box: Box } | null = null;

  for (let start = 0; start < values.length; start++) {
    if (visited[start] || values[start] <= cutoff) continue;
    const box: Box = { left: cols, top: rows, right: -1, bottom: -1 };
    let size = 0;
    const stack = [start];
    visited[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      const c = i % cols;
      const r = Math.floor(i / cols);
      size++;
      box.left = Math.min(box.left, c);
      box.right = Math.max(box.right, c);
      box.top = Math.min(box.top, r);
      box.bottom = Math.max(box.bottom, r);
      for (const [nc, nr] of [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]) {
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const n = nr * cols + nc;
        if (!visited[n] && values[n] > cutoff) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    if (!best || size > best.size) best = { size, box };
  }
  return best?.box ?? null;
}

function crop(img: GrayImage, box: Box): GrayImage {
  const width = box.right - box.left + 1;
  const height = box.bottom - box.top + 1;
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const from = (box.top + y) * img.width + box.left;
    data.set(img.data.subarray(from, from + width), y * width);
  }
  return { width, height, data };
}
