import type { ParsedReceipt } from '../../../types';
import { tesseractParser } from './tesseract';
import { claudeParser } from './claude';

/** Behind-an-interface receipt scanner (docs/DESIGN.md §4, Feature 2). */
export interface ReceiptParser {
  name: 'tesseract' | 'claude' | 'manual';
  /** `onProgress` reports 0..1, if the implementation can estimate it. */
  parse(file: File, onProgress?: (progress: number) => void): Promise<ParsedReceipt>;
}

function emptyParsedReceipt(): ParsedReceipt {
  return { merchant: '', items: [], tax: 0, tip: 0, fees: [], total: 0, confidence: 0 };
}

/** No-op parser for "Enter manually" — the user fills in every field themselves. */
const manualParser: ReceiptParser = {
  name: 'manual',
  async parse() {
    return emptyParsedReceipt();
  },
};

async function notifyFallback() {
  try {
    const { notifications } = await import('@mantine/notifications');
    notifications.show({
      color: 'orange',
      title: 'Switched to on-device scanning',
      message:
        "We couldn't reach the receipt-scanning service, so this receipt was read on-device instead. Double-check the numbers.",
    });
  } catch {
    // Notifications aren't mountable outside the app shell (e.g. tests) — safe to ignore.
  }
}

/** Tries the Claude vision parser; falls back to the local OCR heuristics on any failure. */
const claudeWithFallback: ReceiptParser = {
  name: 'claude',
  async parse(file, onProgress) {
    try {
      return await claudeParser.parse(file, onProgress);
    } catch (err) {
      console.error('Claude receipt parser failed, falling back to tesseract:', err);
      await notifyFallback();
      return tesseractParser.parse(file, onProgress);
    }
  },
};

/** Picks the parser implementation from `VITE_RECEIPT_PARSER` (default 'tesseract'). */
export function getParser(): ReceiptParser {
  const kind = import.meta.env.VITE_RECEIPT_PARSER ?? 'tesseract';
  if (kind === 'manual') return manualParser;
  if (kind === 'claude') return claudeWithFallback;
  return tesseractParser;
}
