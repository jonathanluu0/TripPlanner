import { getSupabase } from './client';

/**
 * Receipt photos live in the private `receipts` bucket at
 * `<trip id>/<receipt id>.jpg`. The trip id in the path is what the storage
 * rules check, so only that trip's participants can read or write the file.
 *
 * Reading needs a signed (temporary) URL, which we cache until shortly before
 * it expires so re-renders don't re-request it.
 */
const BUCKET = 'receipts';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const REFRESH_MARGIN_MS = 60_000;

const signedUrls = new Map<string, { url: string; expiresAt: number }>();

export function receiptImagePath(tripId: string, receiptId: string): string {
  return `${tripId}/${receiptId}.jpg`;
}

/** Uploads (or replaces) a receipt photo and returns its storage path. */
export async function uploadReceiptImage(tripId: string, receiptId: string, file: Blob): Promise<string> {
  const path = receiptImagePath(tripId, receiptId);
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true });
  if (error) throw error;
  signedUrls.delete(path);
  return path;
}

/** A temporary URL for displaying a stored photo. */
export async function getReceiptImageUrl(path: string): Promise<string | null> {
  const cached = signedUrls.get(path);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.url;

  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  signedUrls.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 });
  return data.signedUrl;
}

export async function deleteReceiptImage(path: string): Promise<void> {
  await getSupabase().storage.from(BUCKET).remove([path]);
  signedUrls.delete(path);
}
