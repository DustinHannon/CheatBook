import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/api') || pathname.startsWith('/_next');

  // Redirect unauthenticated users to login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Check if user needs team setup (skip if already on team-setup page)
  if (user && !isPublic && !pathname.startsWith('/team-setup')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('team_id')
      .eq('id', user.id)
      .single();

    if (profile && !profile.team_id) {
      const url = request.nextUrl.clone();
      url.pathname = '/team-setup';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
