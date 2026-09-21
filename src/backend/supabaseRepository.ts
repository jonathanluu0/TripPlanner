import type { ID, Trip } from '../types';
import type { TripRepository } from './repository';

const NOT_CONFIGURED =
  'Supabase backend is not configured yet. Set VITE_BACKEND=local or implement SupabaseRepository (see supabase/schema.sql).';

/**
 * Stub for the recommended backend (docs/DESIGN.md §6, supabase/schema.sql).
 *
 * Implementation notes (TODO):
 *  - Client: `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`
 *    from `@supabase/supabase-js` (not installed yet).
 *  - Trip fields map to table `trips` (id, name, destination, start_date, end_date,
 *    invite_code, created_at, created_by).
 *  - members -> `trip_members` (id, trip_id, name, color, user_id).
 *  - cars -> `cars` (+ `car_assignments` with role 'driver' | 'passenger').
 *  - sleepingSpots -> `sleeping_spots` (+ `sleeping_assignments`).
 *  - receipts -> `receipts` (items/fees/split as jsonb or child tables
 *    `receipt_items`, `receipt_item_extras`, `receipt_fees`); images in Storage.
 *  - RLS: a trip is readable/writable only by users with a `trip_members` row.
 *  - findTripByInviteCode should call an RPC (security definer) so non-members
 *    can resolve a code without reading all trips.
 *  - subscribe: `supabase.channel('trip:'+id).on('postgres_changes', ...)`.
 */
export class SupabaseRepository implements TripRepository {
  async listTrips(): Promise<Trip[]> {
    // TODO: select trips joined via trip_members for auth.uid()
    throw new Error(NOT_CONFIGURED);
  }

  async getTrip(_id: ID): Promise<Trip | null> {
    // TODO: select trip + children and assemble a Trip document
    throw new Error(NOT_CONFIGURED);
  }

  async saveTrip(_trip: Trip): Promise<void> {
    // TODO: upsert trip row and diff/upsert child rows
    throw new Error(NOT_CONFIGURED);
  }

  async deleteTrip(_id: ID): Promise<void> {
    // TODO: delete from trips (children cascade)
    throw new Error(NOT_CONFIGURED);
  }

  async findTripByInviteCode(_code: string): Promise<Trip | null> {
    // TODO: rpc('find_trip_by_invite_code', { code })
    throw new Error(NOT_CONFIGURED);
  }

  subscribe(_tripId: ID, _cb: (trip: Trip) => void): () => void {
    // TODO: realtime channel on trips / child tables filtered by trip_id
    throw new Error(NOT_CONFIGURED);
  }
}
