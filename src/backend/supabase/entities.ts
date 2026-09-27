/**
 * Translates between a Trip (what the app works with) and trip_entities rows
 * (what the database stores): one row per member, car, sleeping spot or receipt,
 * plus a "meta" row for the trip's own details.
 *
 * Per-row storage means two friends editing different cars at the same time save
 * different rows instead of overwriting each other's whole trip.
 *
 * Pure functions only — no Supabase imports — so they're easy to test.
 */
import type { Car, ID, Member, Receipt, SleepingSpot, Trip } from '../../types';

export type EntityKind = 'meta' | 'member' | 'car' | 'spot' | 'receipt';

export interface Entity {
  kind: EntityKind;
  id: ID;
  /** `pos` is the item's place in its list, so order survives the round trip. */
  data: Record<string, unknown>;
}

export interface EntityRow extends Entity {
  trip_id: ID;
  deleted_at?: string | null;
}

/** Identity of a row within a trip. */
export function entityKey(kind: EntityKind, id: ID): string {
  return `${kind}:${id}`;
}

/** Trip → rows. Receipt images are stored in Storage, never inlined here. */
export function tripToEntities(trip: Trip): Entity[] {
  const { members, cars, sleepingSpots, receipts, id, ...meta } = trip;
  return [
    { kind: 'meta', id, data: { ...meta } },
    ...members.map((m, pos) => ({ kind: 'member' as const, id: m.id, data: { ...m, pos } })),
    ...cars.map((c, pos) => ({ kind: 'car' as const, id: c.id, data: { ...c, pos } })),
    ...sleepingSpots.map((s, pos) => ({ kind: 'spot' as const, id: s.id, data: { ...s, pos } })),
    ...receipts.map((r, pos) => ({ kind: 'receipt' as const, id: r.id, data: stripImage(r, pos) })),
  ];
}

/** A receipt photo lives in Storage (imagePath); the data URL never goes in the database. */
function stripImage(receipt: Receipt, pos: number): Record<string, unknown> {
  const { imageDataUrl: _ignored, ...rest } = receipt;
  return { ...rest, pos };
}

/** Rows → Trip. Returns null if the trip's "meta" row is missing (nothing to show). */
export function entitiesToTrip(tripId: ID, rows: Entity[]): Trip | null {
  const meta = rows.find((r) => r.kind === 'meta');
  if (!meta) return null;

  const of = <T>(kind: EntityKind): T[] =>
    rows
      .filter((r) => r.kind === kind)
      .sort((a, b) => (numberOr(a.data.pos, 0) - numberOr(b.data.pos, 0)) || a.id.localeCompare(b.id))
      .map((r) => {
        const { pos: _pos, ...rest } = r.data;
        return { ...rest, id: r.id } as T;
      });

  return {
    ...(meta.data as Omit<Trip, 'id' | 'members' | 'cars' | 'sleepingSpots' | 'receipts'>),
    id: tripId,
    members: of<Member>('member'),
    cars: of<Car>('car'),
    sleepingSpots: of<SleepingSpot>('spot'),
    receipts: of<Receipt>('receipt'),
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

/** One row's worth of change arriving from another device. */
export interface EntityChange {
  kind: EntityKind;
  id: ID;
  data: Record<string, unknown>;
  deleted: boolean;
}

/**
 * Applies a single incoming change onto the trip the app currently has.
 *
 * Merging one entity at a time (rather than rebuilding the trip from the rows
 * we last fetched) is what keeps local edits alive: a receipt someone just
 * added here hasn't reached the server yet, so a server-shaped snapshot would
 * silently drop it.
 */
export function applyEntityChange(trip: Trip, change: EntityChange): Trip {
  const others = tripToEntities(trip).filter((e) => !(e.kind === change.kind && e.id === change.id));
  const next = change.deleted ? others : [...others, { kind: change.kind, id: change.id, data: change.data }];
  return entitiesToTrip(trip.id, next) ?? trip;
}

export interface EntityDiff {
  /** Rows to insert or replace. */
  upserts: Entity[];
  /** Rows that no longer exist locally, to mark deleted. */
  deletes: { kind: EntityKind; id: ID }[];
}

/**
 * What changed between the last state we saved and the current one, so a save
 * touches only the rows that actually differ.
 */
export function diffEntities(previous: Entity[], next: Entity[]): EntityDiff {
  const before = new Map(previous.map((e) => [entityKey(e.kind, e.id), JSON.stringify(e.data)]));
  const upserts: Entity[] = [];
  const seen = new Set<string>();

  for (const entity of next) {
    const key = entityKey(entity.kind, entity.id);
    seen.add(key);
    if (before.get(key) !== JSON.stringify(entity.data)) upserts.push(entity);
  }

  const deletes = previous
    .filter((e) => !seen.has(entityKey(e.kind, e.id)))
    .map((e) => ({ kind: e.kind, id: e.id }));

  return { upserts, deletes };
}
