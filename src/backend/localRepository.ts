import type { ID, Trip } from '../types';
import { normalizeInviteCode } from '../lib/ids';
import type { TripRepository } from './repository';

const STORAGE_KEY = 'gtp-repo-trips';

function readAll(): Record<ID, Trip> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<ID, Trip>) : {};
  } catch {
    return {};
  }
}

function writeAll(trips: Record<ID, Trip>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

/**
 * localStorage-backed repository. Works offline, single device only.
 * `subscribe` listens to the `storage` event so other tabs stay in sync.
 */
export class LocalRepository implements TripRepository {
  async listTrips(): Promise<Trip[]> {
    return Object.values(readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTrip(id: ID): Promise<Trip | null> {
    return readAll()[id] ?? null;
  }

  async saveTrip(trip: Trip): Promise<void> {
    const all = readAll();
    all[trip.id] = trip;
    writeAll(all);
  }

  async deleteTrip(id: ID): Promise<void> {
    const all = readAll();
    delete all[id];
    writeAll(all);
  }

  async findTripByInviteCode(code: string): Promise<Trip | null> {
    const target = normalizeInviteCode(code);
    return Object.values(readAll()).find((t) => t.inviteCode === target) ?? null;
  }

  subscribe(tripId: ID, cb: (trip: Trip) => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const trip = readAll()[tripId];
      if (trip) cb(trip);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}
