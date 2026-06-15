import { createServerSupabase } from '../supabase/server';
import { getCurrentMember, getMembers, getSpaces, getNotes, getActivity } from '../api';
import type { InitialAppData } from '../initial-data';

export type { InitialAppData };

// ─── Server-side prefetch of the initial AppContext payload ───
// Runs in the root layout (RSC) so the first paint already has real data and the
// client skips its post-hydration fetch waterfall. Mirrors AppContext's client
// load exactly (same lib/api helpers + RLS via the cookie session). Returns null
// when unauthenticated or on any error — AppProvider then falls back to its own
// client fetch, so this is a pure optimization that can never block the app.
export async function prefetchAppData(): Promise<InitialAppData | null> {
  try {
    const supabase = await createServerSupabase();
    // getCurrentMember -> getCurrentUser -> getSession() reads the cookie locally
    // and throws if there's no valid session (caught below).
    const me = await getCurrentMember(supabase);
    if (!me.approved) {
      return { me, approved: false, members: [], spaces: [], notes: [], activity: [] };
    }
    const [members, spaces, notes, activity] = await Promise.all([
      getMembers(supabase),
      getSpaces(supabase),
      getNotes(supabase),
      getActivity(supabase),
    ]);
    return { me, approved: true, members, spaces, notes, activity };
  } catch {
    return null;
  }
}
