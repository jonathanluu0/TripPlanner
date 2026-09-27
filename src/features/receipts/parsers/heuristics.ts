import type { ParsedFee, ParsedReceipt, ParsedReceiptItem } from '../../../types';

/**
 * Pure heuristic parser: turns raw OCR / pasted receipt text into a ParsedReceipt.
 * No DOM / network access so it's trivial to unit-test.
 */

/** Rightmost token in a line that plausibly looks like a money amount. */
const PRICE_TOKEN_RE = /-?\(?\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\)?-?/g;

const SUBTOTAL_RE = /\bsub[\s-]?total\b/i;
const SKIP_RE = /\b(change|cash|card|visa|mastercard|amex|discover|debit|credit\s*card|auth(?:orization)?|approved|terminal|ref\s*#|account\s*#)\b/i;
const TAX_RE = /\b(sales\s*tax|tax|vat|gst|hst)\b/i;
const TIP_RE = /\b(tip|gratuity)\b/i;
const FEE_RE = /\b(service\s*fee|delivery\s*fee|delivery|surcharge|convenience\s*fee|booking\s*fee|resort\s*fee|cleaning\s*fee|processing\s*fee|fee)\b/i;
const TOTAL_RE = /\b(total|amount\s*due|balance\s*due|balance|grand\s*total|amount\s*charged)\b/i;
/**
 * Discounts and savings lines ("Cartwheel 15% off $3.62", "Saved $1.71 off").
 * They print a price but aren't things you bought — counting them as items
 * inflates the bill, and "total savings" isn't the total.
 */
const SAVINGS_RE = /\b(you\s*saved|saved|savings|discount|coupon|mfr\s*cpn|mfrcpn|promo)\b|\d+\s*%\s*off/i;

const DATE_PATTERNS: RegExp[] = [
  /\b(\d{4}-\d{1,2}-\d{1,2})\b/,
  /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/,
  /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})\b/i,
];

/**
 * The tax amount on a tax line.
 *
 * Receipts often print the rate and what it applied to before the amount:
 *   "MO TAX 8.4750% on $151.37    12.83"
 * Taking the rightmost number usually works, but if OCR dropped the amount we'd
 * take $151.37 — the taxable subtotal — and report a wildly inflated tax. So on
 * an "... on $X ..." line we only accept a number that comes after that base.
 */
function taxAmount(line: string, rightmost: number): number | null {
  const base = /\bon\b\s*(\$?\s*\d[\d,]*(?:\.\d{1,2})?)/i.exec(line);
  if (!base) return rightmost;

  const after = line.slice(base.index + base[0].length);
  const tokens = after.match(PRICE_TOKEN_RE)?.filter(looksLikeMoney) ?? [];
  if (tokens.length === 0) return null; // the amount itself wasn't readable

  const parsed = priceTokenToCents(tokens[tokens.length - 1]);
  return parsed === null || parsed <= 0 ? null : parsed;
}

/**
 * Which "total" line to trust when a receipt prints several (total, balance,
 * amount due, card charged). Prefer the one that agrees with what we added up;
 * otherwise take the last one printed, which is normally the real total.
 */
function pickTotal(candidates: number[], computed: number): number | null {
  if (candidates.length === 0) return null;
  const tolerance = Math.max(50, computed * 0.03);
  const reconciling = candidates.filter((c) => Math.abs(c - computed) <= tolerance);
  if (reconciling.length > 0) {
    return reconciling.reduce((best, c) => (Math.abs(c - computed) < Math.abs(best - computed) ? c : best));
  }
  return candidates[candidates.length - 1];
}

/** True when a token looks like an actual currency amount, not a bare integer. */
function looksLikeMoney(token: string): boolean {
  return token.includes('$') || token.includes('.') || token.includes(',');
}

/**
 * Parse a "12.34" / "$12.34" / "1,234.50" / "12.34-" / "(12.34)" token into cents.
 * Returns null when the token has no digits.
 */
function priceTokenToCents(token: string): number | null {
  const trimmed = token.trim();
  if (!/\d/.test(trimmed)) return null;
  const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith('-') || trimmed.endsWith('-');
  const digits = trimmed.replace(/[^\d.]/g, '');
  if (!digits) return null;
  const lastDot = digits.lastIndexOf('.');
  const normalized =
    lastDot === -1 ? digits : digits.slice(0, lastDot).replace(/\./g, '') + '.' + digits.slice(lastDot + 1);
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

interface LinePrice {
  cents: number;
  /** Line text with the matched price token removed. */
  rest: string;
}

/** Finds the rightmost money-looking token on a line and strips it out. */
function extractPrice(line: string): LinePrice | null {
  const matches = [...line.matchAll(PRICE_TOKEN_RE)].filter((m) => looksLikeMoney(m[0]));
  if (matches.length === 0) return null;
  const match = matches[matches.length - 1];
  const cents = priceTokenToCents(match[0]);
  if (cents === null) return null;
  const rest = (line.slice(0, match.index) + line.slice(match.index + match[0].length)).trim();
  return { cents, rest };
}

interface ParsedQuantity {
  quantity: number;
  name: string;
  /** Set when the line spelled out an explicit unit price (e.g. "3 @ 2.50"); overrides the line's trailing price. */
  unitPriceCents?: number;
}

/**
 * Detects quantity markers: leading "2 x Widget", trailing "Widget x2" / "Widget 2 x",
 * and "3 @ 2.50" (which also tells us the *unit* price, since the line's trailing
 * number is usually the extended line total).
 */
function extractQuantity(rest: string): ParsedQuantity {
  const cleaned = rest.replace(/\s+/g, ' ').trim();

  // "2 x Widget" / "2x Widget" (leading multiplier)
  const leading = cleaned.match(/^(\d+)\s*[xX]\s+(.+)$/);
  if (leading) {
    return { quantity: Math.max(1, Number.parseInt(leading[1], 10)), name: leading[2].trim() };
  }

  // "3 @ 2.50" — qty before @, unit price after; whatever is left over is the name.
  const at = cleaned.match(/(\d+)\s*@\s*\$?(\d+(?:\.\d{1,2})?)/);
  if (at && at.index !== undefined) {
    const name = (cleaned.slice(0, at.index) + cleaned.slice(at.index + at[0].length)).trim();
    return {
      quantity: Math.max(1, Number.parseInt(at[1], 10)),
      name: name || cleaned,
      unitPriceCents: Math.round(Number.parseFloat(at[2]) * 100),
    };
  }

  // "Widget 2 x" (multiplier trails the name, "x" last)
  const midX = cleaned.match(/^(.+?)\s+(\d+)\s*[xX]$/);
  if (midX) {
    return { quantity: Math.max(1, Number.parseInt(midX[2], 10)), name: midX[1].trim() };
  }

  // "Widget x2" ("x" then count, trailing)
  const trailingX = cleaned.match(/^(.+?)\s*[xX]\s*(\d+)$/);
  if (trailingX) {
    return { quantity: Math.max(1, Number.parseInt(trailingX[2], 10)), name: trailingX[1].trim() };
  }

  return { quantity: 1, name: cleaned };
}

function cleanLabel(name: string): string {
  return name.replace(/[.\s]+$/g, '').replace(/^[.\s]+/g, '').trim();
}

function toIsoDate(raw: string): string | undefined {
  const isoMatch = raw.match(/^\d{4}-\d{1,2}-\d{1,2}$/);
  if (isoMatch) {
    const [y, m, d] = raw.split('-').map((n) => n.padStart(2, '0'));
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    // Guard against JS's lenient "MM/DD/YY" -> wildly wrong century parsing.
    if (y > 1990 && y < 2100) return `${y}-${m}-${d}`;
  }
  return undefined;
}

function extractDate(lines: string[]): string | undefined {
  for (const line of lines) {
    for (const re of DATE_PATTERNS) {
      const match = line.match(re);
      if (match) {
        const iso = toIsoDate(match[1]);
        if (iso) return iso;
      }
    }
  }
  return undefined;
}

function extractMerchant(lines: string[]): string {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (extractPrice(trimmed)) continue; // price-only header lines aren't the name
    if (SKIP_RE.test(trimmed) || TOTAL_RE.test(trimmed) || TAX_RE.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue; // bare numbers (phone/receipt #)
    return cleanLabel(trimmed);
  }
  return 'Unknown merchant';
}

/** Pure function: raw receipt text -> best-effort structured data. */
export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ParsedReceiptItem[] = [];
  const fees: ParsedFee[] = [];
  let tax = 0;
  let tip = 0;

  const totalCandidates: number[] = [];

  for (const line of lines) {
    const priced = extractPrice(line);
    if (!priced) continue;
    const { cents, rest } = priced;

    if (SUBTOTAL_RE.test(line)) continue; // explicitly ignored as an item
    if (SKIP_RE.test(line)) continue; // change/cash/card/visa/etc
    if (SAVINGS_RE.test(line)) {
      // A discount belongs to the item printed just above it, as a negative
      // extra: "Cartwheel 15% off $3.62" under "LEAN CUISINE $2.89".
      // Counting it as its own item would inflate the bill instead.
      const item = items[items.length - 1];
      if (item && cents > 0) {
        item.extras = [...(item.extras ?? []), { label: cleanLabel(rest) || 'Discount', amount: -cents }];
      }
      continue;
    }

    if (TAX_RE.test(line)) {
      const amount = taxAmount(line, cents);
      if (amount !== null) tax += amount;
      continue;
    }
    if (TIP_RE.test(line)) {
      tip += cents;
      continue;
    }
    if (FEE_RE.test(line)) {
      fees.push({ label: cleanLabel(rest) || 'Fee', amount: cents });
      continue;
    }
    if (TOTAL_RE.test(line)) {
      totalCandidates.push(cents);
      continue;
    }

    // Remaining priced line -> a line item.
    const { quantity, name, unitPriceCents } = extractQuantity(rest);
    const label = cleanLabel(name) || 'Item';
    items.push({ name: label, basePrice: unitPriceCents ?? cents, quantity });
  }

  const itemsSum = items.reduce((sum, it) => {
    const extras = (it.extras ?? []).reduce((acc, e) => acc + e.amount, 0);
    return sum + (it.basePrice + extras) * it.quantity;
  }, 0);
  const feesSum = fees.reduce((sum, f) => sum + f.amount, 0);
  const computed = itemsSum + tax + tip + feesSum;
  const bestTotal = pickTotal(totalCandidates, computed);
  const total = bestTotal ?? computed;

  // A tax bigger than the bill itself means we misread a line; drop it rather
  // than show a nonsense number.
  if (bestTotal !== null && tax > bestTotal) tax = 0;

  // Confidence: how closely the parsed pieces reconcile with the printed total.
  let confidence: number;
  if (items.length === 0) {
    confidence = 0.2;
  } else if (bestTotal === null) {
    confidence = 0.4;
  } else if (Math.abs(computed - total) <= 1) {
    confidence = 0.92;
  } else if (Math.abs(computed - total) <= Math.max(50, total * 0.03)) {
    confidence = 0.65;
  } else {
    confidence = 0.35;
  }

  return {
    merchant: extractMerchant(lines),
    date: extractDate(lines),
    items,
    tax,
    tip,
    fees,
    total,
    totalSource: bestTotal === null ? 'computed' : 'printed',
    confidence,
    rawText: text,
  };
}
