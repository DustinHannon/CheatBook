import type { ReactNode } from 'react';
import { prefetchAppData } from '../lib/server/prefetch';
import { Providers } from './providers';
import '../styles/theme.css';

// Auth-gated app — never statically prerender; always render per-request so the
// cookie-based prefetch runs and useSearchParams() works without a Suspense wrap.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'CheatBook',
  icons: { icon: '/favicon.svg' },
};

// Pre-paint theme/density/accent from cached localStorage so a light-theme user
// never sees a dark flash on reload (data loads post-hydration). Ported verbatim
// from the old pages/_document.tsx boot script.
const BOOT_THEME =
  "(function(){try{var a=JSON.parse(localStorage.getItem('cb-appearance')||'{}');var e=document.documentElement;e.setAttribute('data-theme',a.theme||'dark');e.setAttribute('data-density',a.density||'balanced');if(a.accent){var c=a.accent,r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);e.style.setProperty('--accent',c);e.style.setProperty('--accent-soft','rgba('+r+','+g+','+b+',0.16)');e.style.setProperty('--accent-grad','linear-gradient(160deg, rgb('+Math.min(255,r+15)+','+Math.min(255,g+8)+','+Math.min(255,b+1)+'), '+c+')');}}catch(_){}})();";

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Server-side prefetch of the initial app data (null when unauthenticated).
  const initialData = await prefetchAppData();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: BOOT_THEME }} />
      </head>
      <body className="font-body antialiased">
        <Providers initialData={initialData}>{children}</Providers>
      </body>
    </html>
  );
}
