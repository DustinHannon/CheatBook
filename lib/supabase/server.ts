import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Server-side Supabase client (RSC + Route Handlers) ───
// Reads the user's session from the request cookies, so RLS applies as that
// user. In a Server Component cookies are read-only — setAll is wrapped in a
// try/catch because mutating cookies there throws; the middleware is what
// actually refreshes the auth cookie on each request.
export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* Server Component context — cookie writes are a no-op here. */
          }
        },
      },
    },
  );
}
