import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body className="font-body antialiased">
        {/* Apply the cached theme/density/accent before first paint so a light-theme
            user never sees a dark flash on reload (DB load happens post-hydration). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var a=JSON.parse(localStorage.getItem('cb-appearance')||'{}');var e=document.documentElement;e.setAttribute('data-theme',a.theme||'dark');e.setAttribute('data-density',a.density||'balanced');if(a.accent){var c=a.accent,r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);e.style.setProperty('--accent',c);e.style.setProperty('--accent-soft','rgba('+r+','+g+','+b+',0.16)');e.style.setProperty('--accent-grad','linear-gradient(160deg, rgb('+Math.min(255,r+15)+','+Math.min(255,g+8)+','+Math.min(255,b+1)+'), '+c+')');}}catch(_){}})();",
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
