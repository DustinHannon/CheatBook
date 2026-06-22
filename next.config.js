/** @type {import('next').NextConfig} */

// Content-Security-Policy tuned to exactly what CheatBook loads:
//  • script-src keeps 'unsafe-inline' because Next's App Router injects un-nonced
//    inline hydration scripts (and our static BOOT_THEME boot script). There is no
//    reachable XSS sink today (React + ProseMirror JSON + safeFileHref/safeAvatarSrc
//    guards), so the value here is the rest of the policy: frame-ancestors (anti-
//    clickjacking), object-src/base-uri lockdown, and tight connect/img/font origins.
//  • Supabase REST + Realtime (wss) + Storage all live on *.supabase.co.
//  • Inline note images load via the same-origin /api/file proxy, which 302-redirects
//    to a *.supabase.co signed URL — so img-src must allow *.supabase.co (+ data:/blob:
//    for Entra data-URL avatars and pasted blobs).
//  • Google Fonts: stylesheet from fonts.googleapis.com, font files from fonts.gstatic.com.
const CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

const nextConfig = {
  reactStrictMode: true,
  env: {
    // Entra SSO is a PUBLIC client flag (not a secret), so it can live in the
    // repo. Default it ON for production builds; an explicit
    // NEXT_PUBLIC_ENTRA_ENABLED (Vercel env var or .env.local) still wins, so
    // local dev / preview deploys stay OFF unless turned on deliberately.
    NEXT_PUBLIC_ENTRA_ENABLED:
      process.env.NEXT_PUBLIC_ENTRA_ENABLED ??
      (process.env.VERCEL_ENV === 'production' ? 'true' : 'false'),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

module.exports = nextConfig;
