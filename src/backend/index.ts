import { LocalRepository } from './localRepository';
import type { TripRepository } from './repository';
import { SupabaseRepository } from './supabaseRepository';

export type { TripRepository } from './repository';

export type BackendKind = 'local' | 'supabase';

export const backendKind: BackendKind =
  import.meta.env.VITE_BACKEND === 'supabase' ? 'supabase' : 'local';

/** The active repository, chosen by VITE_BACKEND ('local' by default). */
export const repository: TripRepository =
  backendKind === 'supabase' ? new SupabaseRepository() : new LocalRepository();
