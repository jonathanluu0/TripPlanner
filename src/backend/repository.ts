import type { ID, Trip } from '../types';

/**
 * Persistence boundary for trips. The zustand store is the in-app source of
 * truth; a repository syncs whole Trip documents to wherever they live.
 * Implementations: LocalRepository (localStorage), SupabaseRepository (stub).
 */
export interface TripRepository {
  /** Trips visible to the current user. */
  listTrips(): Promise<Trip[]>;
  getTrip(id: ID): Promise<Trip | null>;
  /** Insert or replace a trip. */
  saveTrip(trip: Trip): Promise<void>;
  deleteTrip(id: ID): Promise<void>;
  /** Case-insensitive lookup by 6-char invite code. */
  findTripByInviteCode(code: string): Promise<Trip | null>;
  /**
   * Optional realtime: invoke `cb` whenever the trip changes elsewhere.
   * Returns an unsubscribe function.
   */
  subscribe?(tripId: ID, cb: (trip: Trip) => void): () => void;
}
