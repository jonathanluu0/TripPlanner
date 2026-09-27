import type { ID, Trip } from '../types';

/** Merges a remote change into the app's current copy of a trip. */
export type TripMerge = (current: Trip | undefined) => Trip | undefined;

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
   * Optional realtime. Instead of a finished trip, the callback receives a
   * function that merges the incoming change into whatever the app currently
   * has — so a change from someone else can't wipe out an edit made here that
   * hasn't been saved yet. Returning undefined means "reload this trip".
   * Returns an unsubscribe function.
   */
  subscribe?(tripId: ID, onChange: (merge: TripMerge) => void): () => void;
  /**
   * Optional: link the signed-in user to a member of the trip ("I'm Alex"),
   * so other people can see which name is taken. Local mode has no accounts.
   */
  claimMember?(tripId: ID, memberId: ID): Promise<void>;
}
