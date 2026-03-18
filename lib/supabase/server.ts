import { createServerClient } from '@supabase/ssr';
import { NextApiRequest, NextApiResponse } from 'next';

export function createApiClient(req: NextApiRequest, res: NextApiResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies: { name: string; value: string }[] = [];
          for (const [name, value] of Object.entries(req.cookies)) {
            if (value) cookies.push({ name, value });
          }
          return cookies;
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.setHeader(
              'Set-Cookie',
              `${name}=${value}; Path=${options?.path ?? '/'}; HttpOnly; SameSite=Lax${options?.maxAge ? `; Max-Age=${options.maxAge}` : ''}`
            );
          });
        },
      },
    }
  );
}
