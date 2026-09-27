/**
 * Round-trip and diff checks for entities.ts.
 *   npx tsx src/backend/supabase/entities.test.mts
 */
import assert from 'node:assert/strict';
import { applyEntityChange, diffEntities, entitiesToTrip, tripToEntities } from './entities.ts';
import type { Trip } from '../../types.ts';

const trip: Trip = {
  id: 'trip1',
  name: 'Tahoe Weekend',
  destination: 'South Lake Tahoe, CA',
  startDate: '2026-10-09',
  endDate: '2026-10-11',
  inviteCode: 'K7Q2MX',
  createdAt: '2026-09-20T00:00:00.000Z',
  members: [
    { id: 'm1', name: 'Jon', color: 'teal' },
    { id: 'm2', name: 'Alex', color: 'blue' },
  ],
  cars: [{ id: 'c1', label: "Jon's Civic", seats: 5, driverIds: ['m1'], passengerIds: ['m2'] }],
  sleepingSpots: [{ id: 's1', kind: 'Bedroom', label: 'Master', capacity: 2, occupantIds: ['m1'] }],
  receipts: [
    {
      id: 'r1',
      merchant: 'Safeway',
      imageDataUrl: 'data:image/jpeg;base64,AAAA',
      imagePath: 'trip1/r1.jpg',
      items: [{ id: 'i1', name: 'Milk', basePrice: 479, quantity: 1, extras: [] }],
      tax: 144,
      tip: 0,
      fees: [],
      total: 2208,
      paidById: 'm1',
      split: { mode: 'even', count: 2, participantIds: [] },
      status: 'confirmed',
      createdAt: '2026-09-20T00:00:00.000Z',
    },
  ],
};

const tests: [string, () => void][] = [
  ['trip → rows → trip is unchanged (apart from the image)', () => {
    const rows = tripToEntities(trip);
    const back = entitiesToTrip('trip1', rows);
    const { imageDataUrl: _dropped, ...receiptWithoutImage } = trip.receipts[0];
    assert.deepEqual(back, { ...trip, receipts: [receiptWithoutImage] });
  }],

  ['one row per thing, plus meta', () => {
    const rows = tripToEntities(trip);
    assert.equal(rows.length, 1 + 2 + 1 + 1 + 1);
    assert.deepEqual(
      rows.map((r) => r.kind),
      ['meta', 'member', 'member', 'car', 'spot', 'receipt'],
    );
  }],

  ['receipt photos are never stored in the database', () => {
    const receiptRow = tripToEntities(trip).find((r) => r.kind === 'receipt');
    assert.ok(!('imageDataUrl' in receiptRow!.data), 'imageDataUrl must not be saved');
    assert.equal(receiptRow!.data.imagePath, 'trip1/r1.jpg');
  }],

  ['member order survives the round trip', () => {
    const reordered = { ...trip, members: [trip.members[1], trip.members[0]] };
    const back = entitiesToTrip('trip1', shuffle(tripToEntities(reordered)));
    assert.deepEqual(back!.members.map((m) => m.name), ['Alex', 'Jon']);
  }],

  ['no changes → nothing to save', () => {
    const rows = tripToEntities(trip);
    const diff = diffEntities(rows, tripToEntities(trip));
    assert.equal(diff.upserts.length, 0);
    assert.equal(diff.deletes.length, 0);
  }],

  ['editing one car saves only that car', () => {
    const edited = { ...trip, cars: [{ ...trip.cars[0], label: 'Civic (full)' }] };
    const diff = diffEntities(tripToEntities(trip), tripToEntities(edited));
    assert.deepEqual(diff.upserts.map((e) => `${e.kind}:${e.id}`), ['car:c1']);
    assert.equal(diff.deletes.length, 0);
  }],

  ['removing a receipt marks exactly that row deleted', () => {
    const diff = diffEntities(tripToEntities(trip), tripToEntities({ ...trip, receipts: [] }));
    assert.deepEqual(diff.deletes, [{ kind: 'receipt', id: 'r1' }]);
    assert.equal(diff.upserts.length, 0);
  }],

  ['adding a member saves the new member only', () => {
    const withNewMember = {
      ...trip,
      members: [...trip.members, { id: 'm3', name: 'Priya', color: 'orange' }],
    };
    const diff = diffEntities(tripToEntities(trip), tripToEntities(withNewMember));
    assert.deepEqual(diff.upserts.map((e) => e.id), ['m3']);
  }],

  // The bug that lost a receipt: a change from someone else arrived while a
  // locally-added receipt hadn't been saved yet.
  ['a remote change keeps a local unsaved receipt', () => {
    const local = {
      ...trip,
      receipts: [...trip.receipts, { ...trip.receipts[0], id: 'r-local', merchant: 'Just added here' }],
    };
    const merged = applyEntityChange(local, {
      kind: 'car', id: 'c1', deleted: false,
      data: { id: 'c1', label: 'Civic (someone else edited)', seats: 5, driverIds: ['m1'], passengerIds: [], pos: 0 },
    });
    assert.deepEqual(merged.receipts.map((r) => r.id), ['r1', 'r-local'], 'local receipt survives');
    assert.equal(merged.cars[0].label, 'Civic (someone else edited)', 'remote edit applied');
  }],

  ['a remote delete removes only that item', () => {
    const merged = applyEntityChange(trip, { kind: 'receipt', id: 'r1', data: {}, deleted: true });
    assert.equal(merged.receipts.length, 0);
    assert.equal(merged.members.length, 2, 'other things untouched');
    assert.equal(merged.cars.length, 1);
  }],

  ['a remote addition is inserted', () => {
    const merged = applyEntityChange(trip, {
      kind: 'member', id: 'm9', deleted: false,
      data: { id: 'm9', name: 'Sam', color: 'grape', pos: 2 },
    });
    assert.deepEqual(merged.members.map((m) => m.name), ['Jon', 'Alex', 'Sam']);
  }],

  ['a remote trip rename keeps everything else', () => {
    const merged = applyEntityChange(trip, {
      kind: 'meta', id: trip.id, deleted: false,
      data: { ...trip, name: 'Renamed by a friend', members: undefined, cars: undefined, sleepingSpots: undefined, receipts: undefined },
    });
    assert.equal(merged.name, 'Renamed by a friend');
    assert.equal(merged.members.length, 2);
    assert.equal(merged.receipts.length, 1);
  }],

  ['a trip with no meta row is ignored', () => {
    const rows = tripToEntities(trip).filter((r) => r.kind !== 'meta');
    assert.equal(entitiesToTrip('trip1', rows), null);
  }],
];

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

let failed = 0;
for (const [name, run] of tests) {
  try {
    run();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}\n     ${(err as Error).message.split('\n')[0]}`);
  }
}
console.log(failed === 0 ? `\nall ${tests.length} entity tests passed` : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
