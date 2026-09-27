import type { ID, Trip } from '../../types';
import type { TripMerge, TripRepository } from '../repository';
import { getSupabase } from './client';
import {
  applyEntityChange,
  diffEntities,
  entitiesToTrip,
  tripToEntities,
  type Entity,
  type EntityKind,
  type EntityRow,
} from './entities';

const TABLE = 'trip_entities';

/**
 * Trips stored in Supabase (see supabase/README.md).
 *
 * Saving is incremental: we keep the rows we last saw for each trip and send
 * only what changed. That also stops an update arriving from another device
 * from being echoed straight back to the server.
 */
export class SupabaseRepository implements TripRepository {
  /** tripId → the rows we believe the server currently has. */
  private lastSynced = new Map<ID, Entity[]>();

  async listTrips(): Promise<Trip[]> {
    const rows = await this.fetchRows();
    const byTrip = new Map<ID, EntityRow[]>();
    for (const row of rows) {
      const list = byTrip.get(row.trip_id) ?? [];
      list.push(row);
      byTrip.set(row.trip_id, list);
    }

    const trips: Trip[] = [];
    for (const [tripId, tripRows] of byTrip) {
      const trip = entitiesToTrip(tripId, tripRows);
      if (!trip) continue;
      this.remember(tripId, tripRows);
      trips.push(trip);
    }
    return trips.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  async getTrip(id: ID): Promise<Trip | null> {
    const rows = await this.fetchRows(id);
    if (rows.length === 0) return null;
    this.remember(id, rows);
    return entitiesToTrip(id, rows);
  }

  async saveTrip(trip: Trip): Promise<void> {
    const supabase = getSupabase();
    const next = tripToEntities(trip);
    const previous = this.lastSynced.get(trip.id);

    // First time we save this trip: create it (and make us a participant).
    if (!previous) {
      const { error } = await supabase.rpc('create_trip', {
        p_id: trip.id,
        p_invite_code: trip.inviteCode,
      });
      // A duplicate key error just means the trip already exists — fine.
      if (error && !isDuplicate(error)) throw error;
    }

    const { upserts, deletes } = diffEntities(previous ?? [], next);

    if (upserts.length > 0) {
      const { error } = await supabase.from(TABLE).upsert(
        upserts.map((e) => ({ trip_id: trip.id, kind: e.kind, id: e.id, data: e.data, deleted_at: null })),
        { onConflict: 'trip_id,kind,id' },
      );
      if (error) throw error;
    }

    // Deletes are "soft" so other devices hear about them through Realtime.
    for (const gone of deletes) {
      const { error } = await supabase
        .from(TABLE)
        .update({ deleted_at: new Date().toISOString() })
        .match({ trip_id: trip.id, kind: gone.kind, id: gone.id });
      if (error) throw error;
    }

    this.lastSynced.set(trip.id, next);
  }

  async deleteTrip(id: ID): Promise<void> {
    const { error } = await getSupabase().from('trips').delete().eq('id', id);
    if (error) throw error;
    this.lastSynced.delete(id);
  }

  /** Joins the trip (the invite code is the permission) and returns it. */
  async findTripByInviteCode(code: string): Promise<Trip | null> {
    const { data, error } = await getSupabase().rpc('join_trip', { p_code: code });
    if (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    return typeof data === 'string' ? this.getTrip(data) : null;
  }

  /** Links this guest to a member of the trip ("I'm Alex"). */
  async claimMember(tripId: ID, memberId: ID): Promise<void> {
    const { error } = await getSupabase().rpc('claim_member', {
      p_trip_id: tripId,
      p_member_id: memberId,
    });
    if (error) throw error;
  }

  /**
   * Calls `onChange` with a merge function whenever anyone changes this trip.
   * The merge is applied to the app's current copy, so an edit made here that
   * hasn't saved yet survives a change arriving from someone else.
   * Returns an unsubscribe function.
   */
  subscribe(tripId: ID, onChange: (merge: TripMerge) => void): () => void {
    const supabase = getSupabase();

    const channel = supabase
      .channel(`trip:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `trip_id=eq.${tripId}` },
        (payload) => {
          const row = payload.new as EntityRow | undefined;
          if (!row?.kind || !row.id) return;

          const change = {
            kind: row.kind as EntityKind,
            id: row.id,
            data: row.data,
            deleted: Boolean(row.deleted_at),
          };
          // The server now has this row, whatever the app decides to show.
          this.rememberOne(tripId, change);
          onChange((current) => (current ? applyEntityChange(current, change) : undefined));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }

  private async fetchRows(tripId?: ID): Promise<EntityRow[]> {
    let query = getSupabase().from(TABLE).select('trip_id, kind, id, data').is('deleted_at', null);
    if (tripId) query = query.eq('trip_id', tripId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as EntityRow[];
  }

  /** Records one row as "this is what the server has" without touching the rest. */
  private rememberOne(tripId: ID, change: { kind: EntityKind; id: ID; data: Record<string, unknown>; deleted: boolean }): void {
    const rows = (this.lastSynced.get(tripId) ?? []).filter(
      (e) => !(e.kind === change.kind && e.id === change.id),
    );
    if (!change.deleted) rows.push({ kind: change.kind, id: change.id, data: change.data });
    this.lastSynced.set(tripId, rows);
  }

  private remember(tripId: ID, rows: Entity[]): void {
    this.lastSynced.set(
      tripId,
      rows.map(({ kind, id, data }) => ({ kind, id, data })),
    );
  }
}

function isDuplicate(error: { code?: string }): boolean {
  return error.code === '23505';
}

function isNotFound(error: { code?: string }): boolean {
  return error.code === 'P0002';
}
