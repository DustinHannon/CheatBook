import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { serialize } from 'cookie';

// Mirror the signed-in user's Microsoft 365 (Entra) profile photo into their
// CheatBook avatar. The client posts the Azure provider_token (only available on
// the fresh OAuth session) right after an Entra sign-in; we call Microsoft Graph
// server-side (no browser CORS), upload the photo to the public `avatars` bucket
// under the user's own folder, and point profiles.avatar at it.
//
// Respect manual choices: we only (re)sync when the current avatar is empty or is
// itself Entra-sourced (stored at `<uid>/entra.*`). A user who uploads their own
// photo in Settings (stored at `<uid>/avatar.*`) is never overwritten.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const providerToken = (req.body as { providerToken?: unknown })?.providerToken;
  if (!providerToken || typeof providerToken !== 'string') {
    return res.status(400).json({ error: 'Missing provider token' });
  }

  // Server client bound to the request cookies — uploads/updates run as the user,
  // so storage + profiles RLS (owner-scoped) is satisfied.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies).map(([name, value]) => ({ name, value: value ?? '' }));
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          res.setHeader('Set-Cookie', cookiesToSet.map(({ name, value, options }) => serialize(name, value, options)));
        },
      },
    },
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Don't clobber a manually uploaded avatar.
  const { data: profile } = await supabase.from('profiles').select('avatar').eq('id', user.id).maybeSingle();
  const current: string = profile?.avatar ?? '';
  const entraManaged = current === '' || current.includes(`/${user.id}/entra.`) || current.includes('/entra.');
  if (!entraManaged) {
    return res.status(200).json({ applied: false, reason: 'manual avatar set' });
  }

  // Fetch the Microsoft 365 profile photo. 404 = the user has no photo set.
  let photoRes: Response;
  try {
    photoRes = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
  } catch {
    return res.status(502).json({ error: 'Could not reach Microsoft Graph' });
  }
  if (photoRes.status === 404) {
    return res.status(200).json({ applied: false, reason: 'no Microsoft photo' });
  }
  if (!photoRes.ok) {
    return res.status(502).json({ error: `Graph photo fetch failed (${photoRes.status})` });
  }

  const contentType = photoRes.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const bytes = Buffer.from(await photoRes.arrayBuffer());
  // Guard against an empty/oversized payload (avatars bucket caps at ~5MB).
  if (bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024) {
    return res.status(200).json({ applied: false, reason: 'photo missing or too large' });
  }

  const path = `${user.id}/entra.${ext}`;
  const { data: up, error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { upsert: true, contentType });
  if (upErr || !up) {
    return res.status(500).json({ error: 'Could not store avatar' });
  }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(up.path);
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`; // cache-bust so it refreshes everywhere
  const { error: profErr } = await supabase.from('profiles').update({ avatar: avatarUrl }).eq('id', user.id);
  if (profErr) {
    return res.status(500).json({ error: 'Could not update profile' });
  }

  return res.status(200).json({ applied: true, avatarUrl });
}
