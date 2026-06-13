import React from 'react';

/** Fixed aurora + grid + vignette backdrop. Sits behind all glass panels (z-0). */
export const AuroraBackground: React.FC<{ position?: 'fixed' | 'absolute' }> = ({ position = 'fixed' }) => (
  <>
    <div
      style={{
        position, inset: '-20%', zIndex: 0,
        animation: 'cbAurora 26s ease-in-out infinite',
        background:
          'radial-gradient(820px 620px at 10% 4%,rgba(70,120,225,0.22),transparent 60%),' +
          'radial-gradient(760px 680px at 92% 14%,rgba(120,96,224,0.16),transparent 55%),' +
          'radial-gradient(960px 820px at 74% 104%,rgba(40,96,190,0.20),transparent 60%)',
      }}
    />
    <div
      style={{
        position, inset: 0, zIndex: 0,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),' +
          'linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px)',
        backgroundSize: '46px 46px',
        WebkitMaskImage: 'radial-gradient(1200px 800px at 50% 30%,#000,transparent 80%)',
        maskImage: 'radial-gradient(1200px 800px at 50% 30%,#000,transparent 80%)',
      }}
    />
    <div
      style={{
        position, inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(140% 120% at 50% 0%,transparent 55%,rgba(0,0,0,0.55) 100%)',
      }}
    />
  </>
);

export default AuroraBackground;
