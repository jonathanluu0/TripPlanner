import type { ParsedFee, ParsedReceipt, ParsedReceiptItem } from '../../../types';
import type { ReceiptParser } from './index';

/** Reads a File as a data URL and splits it into raw base64 + media type. */
function readFileAsBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected file reader result'));
        return;
      }
      const comma = result.indexOf(',');
      resolve({ base64: comma === -1 ? result : result.slice(comma + 1), mediaType: file.type || 'image/jpeg' });
    };
    reader.readAsDataURL(file);
  });
}

function toInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Coerces the server's loosely-typed JSON into a well-formed ParsedReceipt. */
function coerceParsedReceipt(raw: unknown): ParsedReceipt {
  const obj = asRecord(raw);

  const items: ParsedReceiptItem[] = Array.isArray(obj.items)
    ? obj.items.map((entry) => {
        const i = asRecord(entry);
        return {
          name: typeof i.name === 'string' && i.name.trim() ? i.name : 'Item',
          basePrice: toInt(i.basePrice),
          quantity: Math.max(1, toInt(i.quantity, 1)),
        };
      })
    : [];

  const fees: ParsedFee[] = Array.isArray(obj.fees)
    ? obj.fees.map((entry) => {
        const f = asRecord(entry);
        return {
          label: typeof f.label === 'string' && f.label.trim() ? f.label : 'Fee',
          amount: toInt(f.amount),
        };
      })
    : [];

  return {
    merchant: typeof obj.merchant === 'string' && obj.merchant.trim() ? obj.merchant : 'Unknown merchant',
    date: typeof obj.date === 'string' && obj.date.trim() ? obj.date : undefined,
    items,
    tax: toInt(obj.tax),
    tip: toInt(obj.tip),
    fees,
    total: toInt(obj.total),
    confidence: typeof obj.confidence === 'number' ? Math.min(1, Math.max(0, obj.confidence)) : 0.8,
  };
}

/** POSTs the image to `VITE_RECEIPT_API_URL` (see server/parse-receipt) for Claude-vision extraction. */
export const claudeParser: ReceiptParser = {
  name: 'claude',
  async parse(file, onProgress) {
    const url = import.meta.env.VITE_RECEIPT_API_URL;
    if (!url) throw new Error('VITE_RECEIPT_API_URL is not configured');

    onProgress?.(0.1);
    const { base64, mediaType } = await readFileAsBase64(file);
    onProgress?.(0.35);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mediaType }),
    });
    onProgress?.(0.85);

    if (!res.ok) {
      throw new Error(`Receipt parsing service responded with ${res.status}`);
    }
    const json = await res.json();
    onProgress?.(1);
    return coerceParsedReceipt(json);
  },
};
