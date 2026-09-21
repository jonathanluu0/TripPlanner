import { useTripStore } from '../store/tripStore';
import { repository } from './index';
import type { Trip } from '../types';

let warned = false;
const warnOnce = (err: unknown) => {
  if (warned) return;
  warned = true;
  console.warn('[gtp] repository sync failed; continuing with local store only.', err);
};

/**
 * Mirror store changes into the active TripRepository (write-through).
 * The zustand store stays the in-app source of truth; this keeps the backend
 * up to date so other devices (Supabase) or tabs (local) can read trips.
 * Returns an unsubscribe function.
 */
export function startRepositorySync(): () => void {
  let prev: Record<string, Trip> = useTripStore.getState().trips;
  // Initial push so the repository has everything the store has.
  Object.values(prev).forEach((t) => repository.saveTrip(t).catch(warnOnce));

  return useTripStore.subscribe((state) => {
    const next = state.trips;
    if (next === prev) return;
    for (const [id, trip] of Object.entries(next)) {
      if (prev[id] !== trip) repository.saveTrip(trip).catch(warnOnce);
    }
    for (const id of Object.keys(prev)) {
      if (!(id in next)) repository.deleteTrip(id).catch(warnOnce);
    }
    prev = next;
  });
}
