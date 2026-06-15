import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '../../../lib/supabase/server';

// Auth-checked proxy for the PRIVATE 'images' storage bucket. Note images and
// attachments are stored as raw storage PATHS (never public URLs); the client
// references them through `/api/file?path=<storagePath>` (see lib/api.fileUrl).
// We verify there is a session AND the user is approved, then 302-redirect to a
// short-lived signed URL — the only way these objects are served, so PHI in
// screenshots isn't reachable by a guessable public URL.
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = await createServerSupabase();

  // getUser() validates the JWT against the auth server (getSession alone trusts
  // the cookie). No session / invalid token → not authenticated.
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Binary platform access: only approved users may resolve private files.
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('approved')
    .eq('id', user.id)
    .single();
  if (profErr || !profile?.approved) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Short-lived signed URL (60s) — long enough to follow the redirect, not to
  // bookmark/share. RLS on storage.objects is the deeper boundary; this is the
  // app-level gate.
  const { data: signed, error: signErr } = await supabase
    .storage
    .from('images')
    .createSignedUrl(path, 60);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Don't let the redirect (or any intermediary) cache the signed URL.
  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
