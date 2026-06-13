import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Singleton browser client — avoids spawning multiple GoTrue instances
// (which race on the auth session and emit "Multiple GoTrueClient" warnings).
let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
