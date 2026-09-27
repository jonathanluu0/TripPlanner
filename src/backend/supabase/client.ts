import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase connection, created once.
 *
 * VITE_SUPABASE_ANON_KEY accepts either the new publishable key
 * (`sb_publishable_...`) or the older anon key (`eyJ...`). Both are safe to ship
 * in the browser: what a user may read or change is decided by the database's
 * row-level security rules, not by the key.
 */
let client: SupabaseClient | null = null;

export class SupabaseConfigError extends Error {}

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const missing = [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_ANON_KEY'].filter(Boolean);
  if (missing.length > 0) {
    throw new SupabaseConfigError(
      `Missing ${missing.join(' and ')} in your .env file. ` +
        'Copy them from your Supabase project (Project Settings → API Keys), or set VITE_BACKEND=local.',
    );
  }

  client = createClient(url as string, key as string, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
