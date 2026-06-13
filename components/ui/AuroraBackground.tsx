import React from 'react';

/** Fixed aurora + grid + vignette backdrop. Sits behind all glass panels (z-0). */
export const AuroraBackground: React.FC<{ position?: 'fixed' | 'absolute' }> = ({ position = 'fixed' }) => (
  <>
    <div
      style={{
        position, inset: '-20%', zIndex: 0,
        animation: 'cbAurora 26s ease-in-out infinite',
        background:
          'radial-gradient(820px 620px at 10% 4%,var(--aurora-1),transparent 60%),' +
          'radial-gradient(760px 680px at 92% 14%,var(--aurora-2),transparent 55%),' +
          'radial-gradient(960px 820px at 74% 104%,var(--aurora-3),transparent 60%)',
      }}
    />
    <div
      style={{
        position, inset: 0, zIndex: 0,
        backgroundImage:
          'linear-gradient(var(--aurora-grid) 1px,transparent 1px),' +
          'linear-gradient(90deg,var(--aurora-grid) 1px,transparent 1px)',
        backgroundSize: '46px 46px',
        WebkitMaskImage: 'radial-gradient(1200px 800px at 50% 30%,#000,transparent 80%)',
        maskImage: 'radial-gradient(1200px 800px at 50% 30%,#000,transparent 80%)',
      }}
    />
    <div
      style={{
        position, inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(140% 120% at 50% 0%,transparent 55%,var(--aurora-vignette) 100%)',
      }}
    />
  </>
);

export default AuroraBackground;
