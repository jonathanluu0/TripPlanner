import { useEffect, useState } from 'react';
import { backendKind } from '../../backend';
import { getReceiptImageUrl, uploadReceiptImage } from '../../backend/supabase/storage';
import type { Receipt } from '../../types';

/**
 * Where a receipt photo comes from:
 *  - `imageDataUrl`: the photo this browser just uploaded (shown immediately);
 *  - `imagePath`: the copy in Supabase Storage, which is how everyone else sees it.
 * Storage needs a temporary signed URL, so that part is async.
 */
export function useReceiptImageUrl(receipt: Receipt | undefined): string | undefined {
  const [storageUrl, setStorageUrl] = useState<string>();
  const path = receipt?.imagePath;

  useEffect(() => {
    setStorageUrl(undefined);
    if (!path || backendKind !== 'supabase') return;
    let cancelled = false;
    getReceiptImageUrl(path)
      .then((url) => !cancelled && url && setStorageUrl(url))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [path]);

  return receipt?.imageDataUrl ?? storageUrl;
}

/**
 * Puts a receipt photo where the rest of the group can see it (Supabase mode).
 * Returns the storage path, or undefined in local mode or if the upload fails —
 * the receipt still works, it just won't show a photo on other devices.
 */
export async function storeReceiptImage(
  tripId: string,
  receiptId: string,
  file: Blob,
): Promise<string | undefined> {
  if (backendKind !== 'supabase') return undefined;
  try {
    return await uploadReceiptImage(tripId, receiptId, file);
  } catch (err) {
    console.error('Could not upload the receipt photo:', err);
    return undefined;
  }
}
