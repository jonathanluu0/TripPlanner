import type { ParsedReceipt, Receipt, ReceiptItem, Fee } from '../types';
import { newId } from './ids';

/**
 * Convert a parser result into Receipt fields, filling in ids.
 * Usage: addReceipt(tripId, { ...fromParsedReceipt(parsed), parser: 'tesseract', status: 'needs_review' })
 */
export function fromParsedReceipt(
  parsed: ParsedReceipt,
): Pick<Receipt, 'merchant' | 'date' | 'items' | 'tax' | 'tip' | 'fees' | 'total' | 'confidence'> {
  const items: ReceiptItem[] = parsed.items.map((it) => ({
    id: it.id ?? newId(),
    name: it.name,
    basePrice: it.basePrice,
    quantity: it.quantity || 1,
    extras: (it.extras ?? []).map((e) => ({ id: e.id ?? newId(), label: e.label, amount: e.amount })),
  }));
  const fees: Fee[] = parsed.fees.map((f) => ({ id: f.id ?? newId(), label: f.label, amount: f.amount }));
  return {
    merchant: parsed.merchant,
    date: parsed.date,
    items,
    tax: parsed.tax,
    tip: parsed.tip,
    fees,
    total: parsed.total,
    confidence: parsed.confidence,
  };
}
