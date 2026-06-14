import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { serialize } from 'cookie';

// Auth-checked proxy for the PRIVATE 'images' storage bucket. Note images and
// attachments are stored as raw storage PATHS (never public URLs); the client
// references them through `/api/file?path=<storagePath>` (see lib/api.fileUrl).
// We verify there is a session AND the user is approved, then 302-redirect to a
// short-lived signed URL. This is the ONLY way these objects are served, so PHI
// in screenshots isn't reachable by a guessable public URL.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = req.query.path;
  const path = Array.isArray(raw) ? raw[0] : raw;
  if (!path || typeof path !== 'string') {
    return res.status(404).json({ error: 'Not found' });
  }

  // Server client bound to the request cookies — mirrors lib/supabase/middleware.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies).map(([name, value]) => ({
            name,
            value: value ?? '',
          }));
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          res.setHeader(
            'Set-Cookie',
            cookiesToSet.map(({ name, value, options }) => serialize(name, value, options)),
          );
        },
      },
    },
  );

  // getUser() validates the JWT against the auth server (getSession alone trusts
  // the cookie). No session / invalid token → not authenticated.
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Binary platform access: only approved users may resolve private files.
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('approved')
    .eq('id', user.id)
    .single();
  if (profErr || !profile?.approved) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Short-lived signed URL (60s) — long enough to follow the redirect, not to
  // bookmark/share. RLS on storage.objects is the deeper boundary; this is the
  // app-level gate.
  const { data: signed, error: signErr } = await supabase
    .storage
    .from('images')
    .createSignedUrl(path, 60);
  if (signErr || !signed?.signedUrl) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Don't let the redirect (or any intermediary) cache the signed URL.
  res.setHeader('Cache-Control', 'private, no-store');
  return res.redirect(302, signed.signedUrl);
}
