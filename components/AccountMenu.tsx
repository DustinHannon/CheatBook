import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useApp } from './AppContext';
import { useAuth } from './AuthContext';
import { Avatar } from './ui/Avatar';
import { hexa } from '../lib/colors';

// ─── Inline icons (lifted verbatim from the reference account-menu SVGs) ───
const IconProfile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
);
const IconAccount = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>
);
const IconNotif = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
);
const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
);

const ITEM_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  width: '100%',
  padding: '9px 10px',
  minHeight: 44,
  borderRadius: 9,
  cursor: 'pointer',
  fontSize: 13,
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
};

// A single account-menu item. Hover styling mirrors the reference `style-hover`.
const MenuItem = React.forwardRef<HTMLButtonElement, {
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}>(({ danger = false, onClick, children }, ref) => {
  const [hover, setHover] = useState(false);
  const restColor = danger ? '#fb87a4' : '#c7d0de';
  const hoverColor = danger ? '#fb87a4' : '#fff';
  const hoverBg = danger ? 'rgba(251,135,164,0.12)' : 'rgba(255,255,255,0.06)';
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        ...ITEM_BASE,
        fontWeight: danger ? 600 : undefined,
        color: hover ? hoverColor : restColor,
        background: hover ? hoverBg : 'transparent',
      }}
    >
      {children}
    </button>
  );
});
MenuItem.displayName = 'MenuItem';

export const AccountMenu: React.FC = () => {
  const router = useRouter();
  const { accountOpen, closeAccount, me } = useApp();
  const { logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Focus the first item on open; restore focus to the opener on close.
  useEffect(() => {
    if (!accountOpen) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const id = requestAnimationFrame(() => firstItemRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      restoreRef.current?.focus?.();
    };
  }, [accountOpen]);

  // Esc closes + Tab is trapped within the popover.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeAccount();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = menuRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled])')).filter(
        (n) => n.offsetParent !== null,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [closeAccount],
  );

  if (!accountOpen) return null;

  const goSettings = (section: string) => {
    closeAccount();
    router.push('/settings/' + section);
  };

  const handleLogout = async () => {
    closeAccount();
    await logout();
    router.push('/login');
  };

  const ring = me ? hexa(me.color, 0.55) : 'rgba(110,168,254,0.55)';

  return (
    <div onKeyDown={onKeyDown}>
      {/* click-out backdrop */}
      <div
        onClick={closeAccount}
        aria-hidden
        style={{ position: 'fixed', inset: 0, zIndex: 74 }}
      />
      {/* popover */}
      <div
        ref={menuRef}
        role="menu"
        aria-label="Account menu"
        className="animate-cb-up"
        style={{
          position: 'fixed',
          left: 18,
          bottom: 84,
          zIndex: 75,
          width: 244,
          borderRadius: 14,
          overflow: 'hidden',
          padding: 6,
          background: 'linear-gradient(180deg,rgba(30,36,50,0.98),rgba(18,22,32,0.98))',
          backdropFilter: 'blur(34px) saturate(160%)',
          WebkitBackdropFilter: 'blur(34px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 28px 70px -22px rgba(0,0,0,0.92),inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px 12px' }}>
          <Avatar name={me?.name} color={me?.color} avatarUrl={me?.avatarUrl} size={42} ring />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: '#eef2f8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {me?.name || 'You'}
            </div>
            <div
              className="cb-mono"
              style={{
                fontSize: 10,
                color: '#7c8aa0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={me?.email}
            >
              {me?.email || ''}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 2px 4px' }} />

        <MenuItem ref={firstItemRef} onClick={() => goSettings('profile')}>
          <IconProfile />
          Your profile
        </MenuItem>
        <MenuItem onClick={() => goSettings('account')}>
          <IconAccount />
          Account settings
        </MenuItem>
        <MenuItem onClick={() => goSettings('notifications')}>
          <IconNotif />
          <span style={{ flex: 1 }}>Notifications</span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6ea8fe' }} />
        </MenuItem>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 2px' }} />

        <MenuItem danger onClick={handleLogout}>
          <IconLogout />
          Log out
        </MenuItem>
      </div>
    </div>
  );
};

export default AccountMenu;
