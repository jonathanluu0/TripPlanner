import { backendKind, repository } from './index';
import { startRepositorySync } from './sync';
import { ensureGuestSession } from './supabase/auth';
import { useTripStore } from '../store/tripStore';

/**
 * Prepares the backend before the app renders.
 *
 * local mode:    nothing to do — the store loads from this browser.
 * supabase mode: sign in as a guest, then load the trips this guest belongs to.
 *                Those replace whatever is in the store, so the trip list always
 *                reflects the server (trips made while in local mode stay in this
 *                browser's local storage but aren't listed).
 */
export async function initBackend(): Promise<void> {
  if (backendKind !== 'supabase') {
    startRepositorySync({ pushExisting: true });
    return;
  }

  await ensureGuestSession();
  const trips = await repository.listTrips();
  useTripStore.getState().replaceAllTrips(trips);

  // The repository already has these trips, so don't push them back up.
  startRepositorySync({ pushExisting: false });
}
