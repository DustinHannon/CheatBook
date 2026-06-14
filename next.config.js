/** @type {import('next').NextConfig} */
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
};

module.exports = nextConfig; 