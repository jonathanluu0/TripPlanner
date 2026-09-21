/**
 * Core domain types (see docs/DESIGN.md §3).
 * Money is always stored as integer cents; format only at render time.
 */

export type ID = string; // nanoid
export type Cents = number; // integer

export interface Member {
  id: ID;
  name: string;
  color: string; // Mantine color name, stable per member id
  userId?: ID; // set once they join with an account
}

export interface Trip {
  id: ID;
  name: string;
  destination?: string;
  startDate?: string; // ISO date (YYYY-MM-DD)
  endDate?: string; // ISO date (YYYY-MM-DD)
  inviteCode: string; // 6 chars, e.g. "K7Q2MX"
  members: Member[];
  cars: Car[];
  sleepingSpots: SleepingSpot[];
  receipts: Receipt[];
  createdAt: string;
}

export interface Car {
  id: ID;
  label: string;
  seats: number;
  driverIds: ID[];
  passengerIds: ID[];
}

export type SleepingKind = 'Bedroom' | 'Couch' | 'Airbed' | 'Other';
export const SLEEPING_KINDS: SleepingKind[] = ['Bedroom', 'Couch', 'Airbed', 'Other'];

export interface SleepingSpot {
  id: ID;
  kind: SleepingKind;
  label: string;
  capacity: number;
  occupantIds: ID[];
}

export interface ExtraCost {
  id: ID;
  label: string;
  amount: Cents;
}

export interface ReceiptItem {
  id: ID;
  name: string;
  basePrice: Cents;
  quantity: number;
  extras: ExtraCost[];
}

/** Service fee, delivery, resort fee... */
export interface Fee {
  id: ID;
  label: string;
  amount: Cents;
}

export type ReceiptStatus = 'parsing' | 'needs_review' | 'confirmed';
export type ReceiptParserKind = 'tesseract' | 'claude' | 'manual';

export interface ReceiptSplit {
  mode: 'even';
  count: number;
  participantIds: ID[];
}

export interface Receipt {
  id: ID;
  merchant: string;
  date?: string;
  imageDataUrl?: string;
  items: ReceiptItem[];
  tax: Cents;
  tip: Cents;
  fees: Fee[];
  total: Cents; // printed total (as parsed / edited)
  paidById?: ID; // who fronted the bill
  split: ReceiptSplit;
  status: ReceiptStatus;
  parser?: ReceiptParserKind;
  confidence?: number; // 0..1 from parser
  createdAt: string;
}

export type CarRole = 'driver' | 'passenger';

/** Item shape a parser returns; ids are optional and filled in by the store. */
export interface ParsedReceiptItem {
  id?: ID;
  name: string;
  basePrice: Cents;
  quantity: number;
  extras?: Array<Omit<ExtraCost, 'id'> & { id?: ID }>;
}

/** Fee shape a parser returns; id optional. */
export type ParsedFee = Omit<Fee, 'id'> & { id?: ID };

/** What a ReceiptParser.parse(file) resolves to. */
export interface ParsedReceipt {
  merchant: string;
  date?: string;
  items: ParsedReceiptItem[];
  tax: Cents;
  tip: Cents;
  fees: ParsedFee[];
  total: Cents;
  confidence: number; // 0..1
  rawText?: string; // OCR text, useful for debugging
}

/** Net balance per member (positive = is owed money). */
export type Balances = Record<ID, Cents>;

export interface Settlement {
  from: ID;
  to: ID;
  amount: Cents;
}
