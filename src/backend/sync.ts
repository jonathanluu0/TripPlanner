import { useTripStore } from '../store/tripStore';
import { repository } from './index';
import type { ID, Trip } from '../types';

const SAVE_DEBOUNCE_MS = 400;
const RETRY_DELAYS_MS = [1000, 4000, 10_000];

export interface SyncOptions {
  /** Push everything already in the store on startup (local mode). */
  pushExisting?: boolean;
}

/**
 * Mirrors store changes into the active repository (write-through).
 * The zustand store stays the in-app source of truth; this keeps the backend up
 * to date so other devices (Supabase) or tabs (local) can read trips.
 *
 * Saves are debounced per trip: dragging someone between cars fires several
 * store updates in a row, and we only want one save at the end.
 *
 * A failed save is retried with increasing delays and, if it still won't go
 * through, reported to the user — an edit that didn't reach the server should
 * never disappear quietly.
 *
 * Returns an unsubscribe function.
 */
export function startRepositorySync({ pushExisting = true }: SyncOptions = {}): () => void {
  let previous: Record<ID, Trip> = useTripStore.getState().trips;
  const timers = new Map<ID, ReturnType<typeof setTimeout>>();
  let failing = false;

  const save = async (tripId: ID, attempt = 0): Promise<void> => {
    const trip = useTripStore.getState().trips[tripId];
    if (!trip) return;

    try {
      await repository.saveTrip(trip);
      if (failing) {
        failing = false;
        notify('teal', 'Saved', 'Your changes are back in sync.');
      }
    } catch (err) {
      console.warn(`[gtp] save failed for trip ${tripId} (attempt ${attempt + 1})`, err);
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) {
        setTimeout(() => void save(tripId, attempt + 1), delay);
        return;
      }
      if (!failing) {
        failing = true;
        notify(
          'red',
          "Changes aren't saving",
          'Your edits are still here, but they haven\'t reached the server. Check your connection — we\'ll keep trying.',
        );
      }
    }
  };

  const scheduleSave = (tripId: ID) => {
    clearTimeout(timers.get(tripId));
    timers.set(
      tripId,
      setTimeout(() => {
        timers.delete(tripId);
        void save(tripId);
      }, SAVE_DEBOUNCE_MS),
    );
  };

  if (pushExisting) Object.keys(previous).forEach((id) => void save(id));

  const unsubscribe = useTripStore.subscribe((state) => {
    const next = state.trips;
    if (next === previous) return;

    for (const [id, trip] of Object.entries(next)) {
      if (previous[id] !== trip) scheduleSave(id);
    }
    for (const id of Object.keys(previous)) {
      if (!(id in next)) {
        clearTimeout(timers.get(id));
        timers.delete(id);
        repository.deleteTrip(id).catch((err) => console.warn('[gtp] delete failed', err));
      }
    }
    previous = next;
  });

  return () => {
    timers.forEach(clearTimeout);
    timers.clear();
    unsubscribe();
  };
}

/** Mantine notifications are imported lazily so this module stays testable. */
async function notify(color: string, title: string, message: string): Promise<void> {
  try {
    const { notifications } = await import('@mantine/notifications');
    notifications.show({ color, title, message, autoClose: color === 'red' ? false : 3000 });
  } catch {
    // Outside the app shell (tests) there's nothing to show it in.
  }
}
