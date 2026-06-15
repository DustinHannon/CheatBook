import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '../../../lib/supabase/server';

// Sync the signed-in user's Microsoft 365 (Entra) directory profile into their
// CheatBook profile. The client posts the Azure provider_token (only present on
// the fresh OAuth session) right after an Entra sign-in. We call Microsoft Graph
// server-side (no browser CORS):
//   - GET /me            -> name (displayName), title (jobTitle), team_name (department)
//   - GET /me/photo/$value -> avatar (inlined as a base64 data URL)
// Profile-field sync and photo sync are independent and BEST-EFFORT: a failure in
// one never fails the other, and the route never 500s (errors are logged for ops).
// The photo only (re)syncs when the avatar is empty or itself Entra-sourced, so a
// manually uploaded avatar is preserved.
export async function POST(req: NextRequest) {
  let providerToken: unknown;
  try {
    providerToken = ((await req.json()) as { providerToken?: unknown })?.providerToken;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!providerToken || typeof providerToken !== 'string') {
    return NextResponse.json({ error: 'Missing provider token' }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  // ── 2. Profile photo as a base64 data URL on the profile (best-effort) ────
  try {
    const { data: profile } = await supabase.from('profiles').select('avatar').eq('id', user.id).maybeSingle();
    const current: string = profile?.avatar ?? '';
    const entraManaged = current === '' || current.startsWith('data:') || current.includes('/entra.');
    if (entraManaged) {
      let photoRes = await graph('/me/photos/120x120/$value');
      if (!photoRes.ok) photoRes = await graph('/me/photo/$value');
      if (photoRes.ok) {
        const contentType = photoRes.headers.get('content-type') || 'image/jpeg';
        const buf = await photoRes.arrayBuffer();
        if (buf.byteLength > 0 && buf.byteLength <= 512 * 1024) {
          const dataUrl = `data:${contentType};base64,${Buffer.from(buf).toString('base64')}`;
          const { error } = await supabase.from('profiles').update({ avatar: dataUrl }).eq('id', user.id);
          if (error) console.error('[entra-sync] avatar update failed:', error.message);
          else applied.push('avatar');
        } else {
          console.error('[entra-sync] photo empty or too large:', buf.byteLength);
        }
      } else if (photoRes.status !== 404) {
        console.error('[entra-sync] Graph photo failed:', photoRes.status, await photoRes.text());
      }
    }
  } catch (e) {
    console.error('[entra-sync] photo threw:', e);
  }

  return NextResponse.json({ applied });
}
