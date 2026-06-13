import React, { useEffect, useState } from 'react';
import { AuroraBackground } from './ui/AuroraBackground';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { AccountMenu } from './AccountMenu';
import { useApp } from './AppContext';

export type SidebarMode = 'full' | 'rail' | 'overlay' | 'hidden';

function useViewport() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

/** Persistent app shell: aurora + responsive sidebar + content region + global overlays. */
export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { navOpen, closeNav, openPalette, closePalette, closeAccount, paletteOpen } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const w = useViewport();

  const isMobile = w < 760;
  const isTablet = w >= 760 && w < 1140;
  const isDesktop = w >= 1140;
  const effectiveCollapsed = isTablet ? true : collapsed;
  const overlay = navOpen && !isDesktop;
  const mode: SidebarMode = overlay ? 'overlay' : isMobile ? 'hidden' : effectiveCollapsed ? 'rail' : 'full';

  // Global keyboard: ⌘K / Ctrl+K palette, Esc closes overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        paletteOpen ? closePalette() : openPalette();
      } else if (e.key === 'Escape') {
        closePalette(); closeAccount(); closeNav();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, openPalette, closePalette, closeAccount, closeNav]);

  const gridCols = isMobile || overlay ? '1fr' : effectiveCollapsed ? '78px 1fr' : '266px 1fr';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg p-[14px] text-text">
      <AuroraBackground position="absolute" />
      <div className="relative z-[1] grid h-full min-h-0 gap-3" style={{ gridTemplateColumns: gridCols }}>
        {overlay && (
          <div
            onClick={closeNav}
            className="fixed inset-0 z-[64]"
            style={{ background: 'var(--backdrop)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
          />
        )}
        {mode !== 'hidden' && (
          <Sidebar mode={mode} onCollapse={() => setCollapsed(true)} onExpand={() => setCollapsed(false)} />
        )}
        <div className="flex min-h-0 min-w-0">{children}</div>
      </div>
      <CommandPalette />
      <AccountMenu />
    </div>
  );
};

export default Layout;
