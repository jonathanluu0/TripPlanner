import { getSupabase } from './client';

/**
 * Guest mode: every visitor gets an anonymous Supabase account, created silently
 * on first visit and remembered in this browser. It's a real signed-in user, so
 * the database's security rules apply normally — a guest can only reach trips
 * they created or joined with an invite code.
 *
 * Requires "Allow anonymous sign-ins" to be enabled in the Supabase dashboard
 * (Authentication → Sign In / Providers).
 *
 * Later: `supabase.auth.linkIdentity({ provider: 'google' })` upgrades a guest
 * to a real account without losing their trips.
 */
export async function ensureGuestSession(): Promise<string> {
  const supabase = getSupabase();

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) return existing.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      `Could not start a guest session: ${error?.message ?? 'unknown error'}. ` +
        'Check that anonymous sign-ins are enabled in your Supabase project.',
    );
  }
  return data.user.id;
}

/** The signed-in user's id, or null if there's no session yet. */
export async function currentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getUser();
  return data.user?.id ?? null;
}
