import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Car,
  CarRole,
  ExtraCost,
  Fee,
  ID,
  Member,
  Receipt,
  ReceiptItem,
  SleepingSpot,
  Trip,
} from '../types';
import { newId, newInviteCode, normalizeInviteCode } from '../lib/ids';
import { colorForId } from '../lib/colors';

/* ------------------------------------------------------------------ */
/* Input types                                                         */
/* ------------------------------------------------------------------ */

export interface CreateTripInput {
  name: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  /** Optional initial attendees. */
  memberNames?: string[];
}

export type TripPatch = Partial<Pick<Trip, 'name' | 'destination' | 'startDate' | 'endDate'>>;
export type CarPatch = Partial<Omit<Car, 'id'>>;
export type SleepingSpotPatch = Partial<Omit<SleepingSpot, 'id'>>;
export type ReceiptPatch = Partial<Omit<Receipt, 'id' | 'createdAt'>>;
export type ReceiptItemPatch = Partial<Omit<ReceiptItem, 'id'>>;
export type ExtraCostPatch = Partial<Omit<ExtraCost, 'id'>>;
export type FeePatch = Partial<Omit<Fee, 'id'>>;

export interface JoinResult {
  trip: Trip;
  member: Member;
}

export interface TripState {
  trips: Record<ID, Trip>;
  /** Which member "I" am in each trip on this device (set on create/join). */
  meByTrip: Record<ID, ID>;
  /** True once the demo trip has been seeded, so deleting it doesn't re-seed. */
  demoSeeded: boolean;

  // Trips
  createTrip(input: CreateTripInput): Trip;
  updateTrip(tripId: ID, patch: TripPatch): void;
  deleteTrip(tripId: ID): void;
  /** Insert or replace a whole trip (e.g. loaded from the repository). */
  upsertTrip(trip: Trip): void;
  /** Adds `name` to the trip (or reuses a same-named member) and marks them as "me". */
  joinTripByCode(code: string, name: string): JoinResult | null;
  /** Mark an existing member as "me" on this device (claiming a placeholder). */
  setMe(tripId: ID, memberId: ID): void;
  seedDemoTrip(): Trip;

  // Members
  addMember(tripId: ID, name: string): Member;
  renameMember(tripId: ID, memberId: ID, name: string): void;
  /** Also removes them from cars, sleeping spots, receipt splits and payer. */
  removeMember(tripId: ID, memberId: ID): void;

  // Cars
  addCar(tripId: ID, init?: CarPatch): Car;
  updateCar(tripId: ID, carId: ID, patch: CarPatch): void;
  removeCar(tripId: ID, carId: ID): void;
  /** A member is in at most one car; this moves them if already assigned. */
  assignToCar(tripId: ID, memberId: ID, carId: ID, role: CarRole): void;
  unassignFromCars(tripId: ID, memberId: ID): void;

  // Sleeping spots
  addSleepingSpot(tripId: ID, init?: SleepingSpotPatch): SleepingSpot;
  updateSleepingSpot(tripId: ID, spotId: ID, patch: SleepingSpotPatch): void;
  removeSleepingSpot(tripId: ID, spotId: ID): void;
  /** A member is in at most one spot; this moves them if already assigned. */
  assignToSpot(tripId: ID, memberId: ID, spotId: ID): void;
  unassignFromSpots(tripId: ID, memberId: ID): void;

  // Receipts
  addReceipt(tripId: ID, init?: ReceiptPatch): Receipt;
  updateReceipt(tripId: ID, receiptId: ID, patch: ReceiptPatch): void;
  removeReceipt(tripId: ID, receiptId: ID): void;

  // Receipt items / extras / fees
  addReceiptItem(tripId: ID, receiptId: ID, init?: ReceiptItemPatch): ReceiptItem;
  updateReceiptItem(tripId: ID, receiptId: ID, itemId: ID, patch: ReceiptItemPatch): void;
  removeReceiptItem(tripId: ID, receiptId: ID, itemId: ID): void;
  addItemExtra(tripId: ID, receiptId: ID, itemId: ID, init?: ExtraCostPatch): ExtraCost;
  updateItemExtra(tripId: ID, receiptId: ID, itemId: ID, extraId: ID, patch: ExtraCostPatch): void;
  removeItemExtra(tripId: ID, receiptId: ID, itemId: ID, extraId: ID): void;
  addFee(tripId: ID, receiptId: ID, init?: FeePatch): Fee;
  updateFee(tripId: ID, receiptId: ID, feeId: ID, patch: FeePatch): void;
  removeFee(tripId: ID, receiptId: ID, feeId: ID): void;
}

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

const nowIso = () => new Date().toISOString();

export function makeMember(name: string): Member {
  const id = newId();
  return { id, name: name.trim(), color: colorForId(id) };
}

function makeTrip(input: CreateTripInput): Trip {
  return {
    id: newId(),
    name: input.name.trim() || 'Untitled trip',
    destination: input.destination?.trim() || undefined,
    startDate: input.startDate,
    endDate: input.endDate,
    inviteCode: newInviteCode(),
    members: (input.memberNames ?? []).filter((n) => n.trim()).map(makeMember),
    cars: [],
    sleepingSpots: [],
    receipts: [],
    createdAt: nowIso(),
  };
}

function makeReceipt(memberCount: number, init: ReceiptPatch = {}): Receipt {
  return {
    merchant: '',
    items: [],
    tax: 0,
    tip: 0,
    fees: [],
    total: 0,
    status: 'needs_review',
    ...init,
    split: init.split ?? { mode: 'even', count: memberCount, participantIds: [] },
    id: newId(),
    createdAt: nowIso(),
  };
}

const without = (ids: ID[], id: ID) => ids.filter((x) => x !== id);

/** Remove a member from every car (either role). */
function stripFromCars(cars: Car[], memberId: ID): Car[] {
  return cars.map((c) =>
    c.driverIds.includes(memberId) || c.passengerIds.includes(memberId)
      ? { ...c, driverIds: without(c.driverIds, memberId), passengerIds: without(c.passengerIds, memberId) }
      : c,
  );
}

function stripFromSpots(spots: SleepingSpot[], memberId: ID): SleepingSpot[] {
  return spots.map((s) =>
    s.occupantIds.includes(memberId) ? { ...s, occupantIds: without(s.occupantIds, memberId) } : s,
  );
}

function stripFromReceipts(receipts: Receipt[], memberId: ID): Receipt[] {
  return receipts.map((r) => {
    const inSplit = r.split.participantIds.includes(memberId);
    const isPayer = r.paidById === memberId;
    if (!inSplit && !isPayer) return r;
    const participantIds = without(r.split.participantIds, memberId);
    return {
      ...r,
      paidById: isPayer ? undefined : r.paidById,
      split: inSplit
        ? { ...r.split, participantIds, count: Math.max(participantIds.length, 1) }
        : r.split,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => {
      /** Immutably replace one trip (no-op if missing). */
      const mutateTrip = (tripId: ID, fn: (trip: Trip) => Trip) =>
        set((s) => {
          const trip = s.trips[tripId];
          if (!trip) return s;
          return { trips: { ...s.trips, [tripId]: fn(trip) } };
        });

      const mutateReceipt = (tripId: ID, receiptId: ID, fn: (r: Receipt) => Receipt) =>
        mutateTrip(tripId, (t) => ({
          ...t,
          receipts: t.receipts.map((r) => (r.id === receiptId ? fn(r) : r)),
        }));

      const mutateItem = (tripId: ID, receiptId: ID, itemId: ID, fn: (i: ReceiptItem) => ReceiptItem) =>
        mutateReceipt(tripId, receiptId, (r) => ({
          ...r,
          items: r.items.map((i) => (i.id === itemId ? fn(i) : i)),
        }));

      return {
        trips: {},
        meByTrip: {},
        demoSeeded: false,

        /* ---------- trips ---------- */

        createTrip(input) {
          const trip = makeTrip(input);
          set((s) => ({ trips: { ...s.trips, [trip.id]: trip } }));
          return trip;
        },

        updateTrip(tripId, patch) {
          mutateTrip(tripId, (t) => ({ ...t, ...patch }));
        },

        deleteTrip(tripId) {
          set((s) => {
            const trips = { ...s.trips };
            const meByTrip = { ...s.meByTrip };
            delete trips[tripId];
            delete meByTrip[tripId];
            return { trips, meByTrip };
          });
        },

        upsertTrip(trip) {
          set((s) => ({ trips: { ...s.trips, [trip.id]: trip } }));
        },

        joinTripByCode(code, name) {
          const target = normalizeInviteCode(code);
          const trip = Object.values(get().trips).find((t) => t.inviteCode === target);
          const trimmed = name.trim();
          if (!trip || !trimmed) return null;
          const existing = trip.members.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
          const member = existing ?? get().addMember(trip.id, trimmed);
          get().setMe(trip.id, member.id);
          return { trip: get().trips[trip.id], member };
        },

        setMe(tripId, memberId) {
          set((s) => ({ meByTrip: { ...s.meByTrip, [tripId]: memberId } }));
        },

        seedDemoTrip() {
          const trip = buildDemoTrip();
          set((s) => ({ trips: { ...s.trips, [trip.id]: trip }, demoSeeded: true }));
          return trip;
        },

        /* ---------- members ---------- */

        addMember(tripId, name) {
          const member = makeMember(name);
          mutateTrip(tripId, (t) => ({ ...t, members: [...t.members, member] }));
          return member;
        },

        renameMember(tripId, memberId, name) {
          mutateTrip(tripId, (t) => ({
            ...t,
            members: t.members.map((m) => (m.id === memberId ? { ...m, name: name.trim() } : m)),
          }));
        },

        removeMember(tripId, memberId) {
          mutateTrip(tripId, (t) => ({
            ...t,
            members: t.members.filter((m) => m.id !== memberId),
            cars: stripFromCars(t.cars, memberId),
            sleepingSpots: stripFromSpots(t.sleepingSpots, memberId),
            receipts: stripFromReceipts(t.receipts, memberId),
          }));
          set((s) => {
            if (s.meByTrip[tripId] !== memberId) return s;
            const meByTrip = { ...s.meByTrip };
            delete meByTrip[tripId];
            return { meByTrip };
          });
        },

        /* ---------- cars ---------- */

        addCar(tripId, init = {}) {
          const count = get().trips[tripId]?.cars.length ?? 0;
          const car: Car = {
            label: `Car ${count + 1}`,
            seats: 5,
            driverIds: [],
            passengerIds: [],
            ...init,
            id: newId(),
          };
          mutateTrip(tripId, (t) => ({ ...t, cars: [...t.cars, car] }));
          return car;
        },

        updateCar(tripId, carId, patch) {
          mutateTrip(tripId, (t) => ({
            ...t,
            cars: t.cars.map((c) => (c.id === carId ? { ...c, ...patch } : c)),
          }));
        },

        removeCar(tripId, carId) {
          mutateTrip(tripId, (t) => ({ ...t, cars: t.cars.filter((c) => c.id !== carId) }));
        },

        assignToCar(tripId, memberId, carId, role) {
          mutateTrip(tripId, (t) => {
            if (!t.cars.some((c) => c.id === carId)) return t;
            const cars = stripFromCars(t.cars, memberId).map((c) =>
              c.id !== carId
                ? c
                : role === 'driver'
                  ? { ...c, driverIds: [...c.driverIds, memberId] }
                  : { ...c, passengerIds: [...c.passengerIds, memberId] },
            );
            return { ...t, cars };
          });
        },

        unassignFromCars(tripId, memberId) {
          mutateTrip(tripId, (t) => ({ ...t, cars: stripFromCars(t.cars, memberId) }));
        },

        /* ---------- sleeping spots ---------- */

        addSleepingSpot(tripId, init = {}) {
          const count = get().trips[tripId]?.sleepingSpots.length ?? 0;
          const spot: SleepingSpot = {
            kind: 'Bedroom',
            label: `Spot ${count + 1}`,
            capacity: 2,
            occupantIds: [],
            ...init,
            id: newId(),
          };
          mutateTrip(tripId, (t) => ({ ...t, sleepingSpots: [...t.sleepingSpots, spot] }));
          return spot;
        },

        updateSleepingSpot(tripId, spotId, patch) {
          mutateTrip(tripId, (t) => ({
            ...t,
            sleepingSpots: t.sleepingSpots.map((s) => (s.id === spotId ? { ...s, ...patch } : s)),
          }));
        },

        removeSleepingSpot(tripId, spotId) {
          mutateTrip(tripId, (t) => ({
            ...t,
            sleepingSpots: t.sleepingSpots.filter((s) => s.id !== spotId),
          }));
        },

        assignToSpot(tripId, memberId, spotId) {
          mutateTrip(tripId, (t) => {
            if (!t.sleepingSpots.some((s) => s.id === spotId)) return t;
            const sleepingSpots = stripFromSpots(t.sleepingSpots, memberId).map((s) =>
              s.id === spotId ? { ...s, occupantIds: [...s.occupantIds, memberId] } : s,
            );
            return { ...t, sleepingSpots };
          });
        },

        unassignFromSpots(tripId, memberId) {
          mutateTrip(tripId, (t) => ({ ...t, sleepingSpots: stripFromSpots(t.sleepingSpots, memberId) }));
        },

        /* ---------- receipts ---------- */

        addReceipt(tripId, init) {
          const receipt = makeReceipt(get().trips[tripId]?.members.length ?? 0, init);
          mutateTrip(tripId, (t) => ({ ...t, receipts: [...t.receipts, receipt] }));
          return receipt;
        },

        updateReceipt(tripId, receiptId, patch) {
          mutateReceipt(tripId, receiptId, (r) => ({ ...r, ...patch }));
        },

        removeReceipt(tripId, receiptId) {
          mutateTrip(tripId, (t) => ({ ...t, receipts: t.receipts.filter((r) => r.id !== receiptId) }));
        },

        addReceiptItem(tripId, receiptId, init = {}) {
          const item: ReceiptItem = { name: '', basePrice: 0, quantity: 1, extras: [], ...init, id: newId() };
          mutateReceipt(tripId, receiptId, (r) => ({ ...r, items: [...r.items, item] }));
          return item;
        },

        updateReceiptItem(tripId, receiptId, itemId, patch) {
          mutateItem(tripId, receiptId, itemId, (i) => ({ ...i, ...patch }));
        },

        removeReceiptItem(tripId, receiptId, itemId) {
          mutateReceipt(tripId, receiptId, (r) => ({ ...r, items: r.items.filter((i) => i.id !== itemId) }));
        },

        addItemExtra(tripId, receiptId, itemId, init = {}) {
          const extra: ExtraCost = { label: '', amount: 0, ...init, id: newId() };
          mutateItem(tripId, receiptId, itemId, (i) => ({ ...i, extras: [...i.extras, extra] }));
          return extra;
        },

        updateItemExtra(tripId, receiptId, itemId, extraId, patch) {
          mutateItem(tripId, receiptId, itemId, (i) => ({
            ...i,
            extras: i.extras.map((e) => (e.id === extraId ? { ...e, ...patch } : e)),
          }));
        },

        removeItemExtra(tripId, receiptId, itemId, extraId) {
          mutateItem(tripId, receiptId, itemId, (i) => ({
            ...i,
            extras: i.extras.filter((e) => e.id !== extraId),
          }));
        },

        addFee(tripId, receiptId, init = {}) {
          const fee: Fee = { label: '', amount: 0, ...init, id: newId() };
          mutateReceipt(tripId, receiptId, (r) => ({ ...r, fees: [...r.fees, fee] }));
          return fee;
        },

        updateFee(tripId, receiptId, feeId, patch) {
          mutateReceipt(tripId, receiptId, (r) => ({
            ...r,
            fees: r.fees.map((f) => (f.id === feeId ? { ...f, ...patch } : f)),
          }));
        },

        removeFee(tripId, receiptId, feeId) {
          mutateReceipt(tripId, receiptId, (r) => ({ ...r, fees: r.fees.filter((f) => f.id !== feeId) }));
        },
      };
    },
    {
      name: 'gtp-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only persist data, not actions.
      partialize: (s) => ({ trips: s.trips, meByTrip: s.meByTrip, demoSeeded: s.demoSeeded }),
    },
  ),
);

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

/** The trip with this id, or undefined. Re-renders only when that trip changes. */
export function useTrip(tripId: ID | undefined): Trip | undefined {
  return useTripStore((s) => (tripId ? s.trips[tripId] : undefined));
}

/** Member lookup map for a trip (memoize in components if used heavily). */
export function membersById(trip: Trip | undefined): Record<ID, Member> {
  const map: Record<ID, Member> = {};
  for (const m of trip?.members ?? []) map[m.id] = m;
  return map;
}

/* ------------------------------------------------------------------ */
/* Demo data                                                           */
/* ------------------------------------------------------------------ */

/** "Tahoe Weekend": 6 members, 2 cars, 3 sleeping spots, one confirmed receipt. */
function buildDemoTrip(): Trip {
  const trip = makeTrip({
    name: 'Tahoe Weekend',
    destination: 'South Lake Tahoe, CA',
    startDate: '2026-10-09',
    endDate: '2026-10-11',
    memberNames: ['Jon', 'Alex', 'Priya', 'Sam', 'Maya', 'Diego'],
  });
  const [jon, alex, priya, sam, maya, diego] = trip.members.map((m) => m.id);

  trip.cars = [
    { id: newId(), label: "Jon's Civic", seats: 5, driverIds: [jon], passengerIds: [alex, priya] },
    { id: newId(), label: "Maya's RAV4", seats: 5, driverIds: [maya], passengerIds: [sam] },
  ];
  trip.sleepingSpots = [
    { id: newId(), kind: 'Bedroom', label: 'Master bedroom', capacity: 2, occupantIds: [jon, alex] },
    { id: newId(), kind: 'Bedroom', label: 'Loft', capacity: 2, occupantIds: [priya, maya] },
    { id: newId(), kind: 'Couch', label: 'Living room couch', capacity: 1, occupantIds: [sam] },
  ];
  // Diego is intentionally unassigned so the "not in a car / bed" badges show.
  void diego;

  // Items 8700 + tax 740 + tip 1500 + fee 300 = 11240 (matches computed total)
  trip.receipts = [
    {
      id: newId(),
      merchant: 'Safeway',
      date: '2026-10-09',
      items: [
        { id: newId(), name: 'Burger patties (12)', basePrice: 2400, quantity: 1, extras: [] },
        { id: newId(), name: 'Buns', basePrice: 450, quantity: 2, extras: [] },
        { id: newId(), name: 'Firewood bundle', basePrice: 800, quantity: 3, extras: [] },
        {
          id: newId(),
          name: 'Chips & salsa',
          basePrice: 1250,
          quantity: 2,
          extras: [{ id: newId(), label: 'Guac', amount: 250 }],
        },
      ],
      tax: 740,
      tip: 1500,
      fees: [{ id: newId(), label: 'Delivery fee', amount: 300 }],
      total: 11240,
      paidById: jon,
      split: { mode: 'even', count: 6, participantIds: [] },
      status: 'confirmed',
      parser: 'manual',
      confidence: 1,
      createdAt: nowIso(),
    },
  ];
  return trip;
}
