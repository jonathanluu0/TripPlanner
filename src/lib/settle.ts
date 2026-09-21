import type { Balances, ID, Receipt, Settlement, Trip } from '../types';
import { splitEven } from './money';

/**
 * Who shares a receipt: explicit participantIds, or else the first `count` members.
 * Unknown ids (e.g. removed members) are dropped.
 */
export function splitParticipants(trip: Trip, receipt: Receipt): ID[] {
  const memberIds = new Set(trip.members.map((m) => m.id));
  const explicit = receipt.split.participantIds.filter((id) => memberIds.has(id));
  if (explicit.length > 0) return explicit;
  const count = Math.max(0, Math.min(receipt.split.count, trip.members.length));
  return trip.members.slice(0, count).map((m) => m.id);
}

/**
 * Net balance per member from confirmed receipts only.
 * Payer is credited the receipt total; each split participant is debited their
 * splitEven share. Positive = is owed money; negative = owes money.
 * Receipts without a payer or participants are skipped.
 */
export function computeBalances(trip: Trip): Balances {
  const balances: Balances = {};
  for (const m of trip.members) balances[m.id] = 0;

  for (const receipt of trip.receipts) {
    if (receipt.status !== 'confirmed') continue;
    const payer = receipt.paidById;
    if (!payer || !(payer in balances)) continue;
    const participants = splitParticipants(trip, receipt);
    if (participants.length === 0) continue;

    balances[payer] += receipt.total;
    const shares = splitEven(receipt.total, participants.length);
    participants.forEach((id, i) => {
      balances[id] -= shares[i];
    });
  }
  return balances;
}

/**
 * Minimal-ish "who pays whom": greedily match the largest debtor with the
 * largest creditor until everything nets to zero.
 */
export function settleUp(balances: Balances): Settlement[] {
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([id, amount]) => ({ id, amount }));
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([id, amount]) => ({ id, amount: -amount }));

  const result: Settlement[] = [];
  const byAmountDesc = (a: { amount: number }, b: { amount: number }) => b.amount - a.amount;

  while (creditors.length && debtors.length) {
    creditors.sort(byAmountDesc);
    debtors.sort(byAmountDesc);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.amount, d.amount);
    if (amount > 0) result.push({ from: d.id, to: c.id, amount });
    c.amount -= amount;
    d.amount -= amount;
    if (c.amount === 0) creditors.shift();
    if (d.amount === 0) debtors.shift();
  }
  return result;
}
