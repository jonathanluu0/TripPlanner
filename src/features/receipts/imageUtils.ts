/** Reads a File into a data URL. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Reads `file` and, if it's an oversized image, downscales it (preserving aspect
 * ratio) to at most `maxDim` px on the long edge and re-encodes as JPEG — keeps
 * receipt photos from bloating localStorage. Falls back to the original data URL
 * if canvas re-encoding isn't available or fails for any reason.
 */
export async function fileToDataUrl(file: File, maxDim = 1600): Promise<string> {
  const original = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/')) return original;
  try {
    const img = await loadImage(original);
    const { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height || (width <= maxDim && height <= maxDim)) return original;
    const scale = maxDim / Math.max(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return original;
  }
}
