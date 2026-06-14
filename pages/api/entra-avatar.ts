import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { serialize } from 'cookie';

// Sync the signed-in user's Microsoft 365 (Entra) directory profile into their
// CheatBook profile. The client posts the Azure provider_token (only present on
// the fresh OAuth session) right after an Entra sign-in. We call Microsoft Graph
// server-side (no browser CORS):
//   - GET /me            -> name (displayName), title (jobTitle), team_name (department)
//   - GET /me/photo/$value -> avatar (uploaded to the public avatars bucket)
// Profile-field sync and photo sync are independent and BEST-EFFORT: a failure in
// one never fails the other, and the route never 500s (errors are logged for ops).
// The photo only (re)syncs when the avatar is empty or itself Entra-sourced
// (`<uid>/entra.*`), so a manually uploaded avatar (`<uid>/avatar.*`) is preserved.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const providerToken = (req.body as { providerToken?: unknown })?.providerToken;
  if (!providerToken || typeof providerToken !== 'string') {
    return res.status(400).json({ error: 'Missing provider token' });
  }

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

  const graph = (path: string) =>
    fetch(`https://graph.microsoft.com/v1.0${path}`, { headers: { Authorization: `Bearer ${providerToken}` } });

  const applied: string[] = [];

  // ── 1. Directory profile fields (name / title / department) ──────────────
  try {
    const meRes = await graph('/me?$select=displayName,jobTitle,department');
    if (meRes.ok) {
      const me = (await meRes.json()) as { displayName?: string; jobTitle?: string; department?: string };
      const upd: Record<string, string> = {};
      if (me.displayName) upd.name = me.displayName;
      if (me.jobTitle) upd.title = me.jobTitle;
      if (me.department) upd.team_name = me.department;
      if (Object.keys(upd).length) {
        const { error } = await supabase.from('profiles').update(upd).eq('id', user.id);
        if (error) console.error('[entra-sync] profile fields update failed:', error.message);
        else applied.push(...Object.keys(upd));
      }
    } else {
      console.error('[entra-sync] Graph /me failed:', meRes.status, await meRes.text());
    }
  } catch (e) {
    console.error('[entra-sync] Graph /me threw:', e);
  }

  // ── 2. Profile photo (best-effort; preserves a manual upload) ────────────
  try {
    const { data: profile } = await supabase.from('profiles').select('avatar').eq('id', user.id).maybeSingle();
    const current: string = profile?.avatar ?? '';
    const entraManaged = current === '' || current.includes('/entra.');
    if (entraManaged) {
      const photoRes = await graph('/me/photo/$value');
      if (photoRes.ok) {
        const contentType = photoRes.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const buf = await photoRes.arrayBuffer();
        if (buf.byteLength > 0 && buf.byteLength <= 5 * 1024 * 1024) {
          const blob = new Blob([buf], { type: contentType });
          const path = `${user.id}/entra.${ext}`;
          const { data: up, error: upErr } = await supabase.storage
            .from('avatars')
            .upload(path, blob, { upsert: true, contentType });
          if (upErr) {
            console.error('[entra-sync] avatar upload failed:', upErr.message);
          } else if (up) {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(up.path);
            const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;
            const { error: avErr } = await supabase.from('profiles').update({ avatar: avatarUrl }).eq('id', user.id);
            if (avErr) console.error('[entra-sync] avatar profile update failed:', avErr.message);
            else applied.push('avatar');
          }
        }
      } else if (photoRes.status !== 404) {
        console.error('[entra-sync] Graph photo failed:', photoRes.status, await photoRes.text());
      }
    }
  } catch (e) {
    console.error('[entra-sync] photo threw:', e);
  }

  return res.status(200).json({ applied });
}
