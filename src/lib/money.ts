import type { Cents, Receipt, ReceiptItem } from '../types';

const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 1234 -> "$12.34". Negative values render as "-$12.34". */
export function formatCents(cents: Cents): string {
  return formatter.format((cents || 0) / 100);
}

/**
 * Parse user / OCR input into integer cents.
 * Accepts "12.34", "$12.34", "1,234.5", "(3.00)" (negative), 12.34 (number, dollars).
 * Returns null when nothing numeric can be found.
 */
export function parseMoneyToCents(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  const trimmed = input.trim();
  if (!trimmed) return null;
  const negative = /^\(.*\)$/.test(trimmed) || /^-/.test(trimmed.replace(/^[^\d-]*/, ''));
  const cleaned = trimmed.replace(/[^\d.]/g, '');
  if (!cleaned || cleaned === '.') return null;
  // If there are multiple dots, treat only the last one as the decimal separator.
  const lastDot = cleaned.lastIndexOf('.');
  const normalized =
    lastDot === -1
      ? cleaned
      : cleaned.slice(0, lastDot).replace(/\./g, '') + '.' + cleaned.slice(lastDot + 1);
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

/**
 * Split `totalCents` into `n` integer parts that sum exactly to the total.
 * Remainder cents go to the first people: splitEven(1000, 3) -> [334, 333, 333].
 */
export function splitEven(totalCents: Cents, n: number): Cents[] {
  const count = Math.max(0, Math.floor(n));
  if (count === 0) return [];
  const sign = totalCents < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(totalCents));
  const base = Math.floor(abs / count);
  const remainder = abs - base * count;
  return Array.from({ length: count }, (_, i) => sign * (base + (i < remainder ? 1 : 0)));
}

/** (basePrice + Σextras) × quantity */
export function itemLineTotal(item: Pick<ReceiptItem, 'basePrice' | 'quantity' | 'extras'>): Cents {
  const extras = item.extras.reduce((sum, e) => sum + e.amount, 0);
  return (item.basePrice + extras) * item.quantity;
}

/** Σ line totals + tax + tip + Σfees */
export function receiptComputedTotal(
  receipt: Pick<Receipt, 'items' | 'tax' | 'tip' | 'fees'>,
): Cents {
  const lines = receipt.items.reduce((sum, it) => sum + itemLineTotal(it), 0);
  const fees = receipt.fees.reduce((sum, f) => sum + f.amount, 0);
  return lines + receipt.tax + receipt.tip + fees;
}

/** True when the printed total disagrees with the computed total. */
export function receiptHasMismatch(receipt: Receipt): boolean {
  return receiptComputedTotal(receipt) !== receipt.total;
}
