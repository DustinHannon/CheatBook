import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useApp } from './AppContext';
import { useAuth } from './AuthContext';
import { usePresence } from './PresenceContext';
import { InputDialog } from './InputDialog';
import { Avatar } from './ui/Avatar';
import { hexa } from '../lib/colors';
import type { Member } from '../lib/types';

type SidebarMode = 'full' | 'rail' | 'overlay' | 'hidden';

interface SidebarProps {
  mode: SidebarMode;
  onCollapse: () => void;
  onExpand: () => void;
}

// Hover styling is data-driven from the reference's `style-hover` attributes.
// theme.css is a foundation file we don't own, so we apply hover via state.
function useHover(): [boolean, { onMouseEnter: () => void; onMouseLeave: () => void; onFocus: () => void; onBlur: () => void }] {
  const [hover, setHover] = useState(false);
  return [
    hover,
    {
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      onFocus: () => setHover(true),
      onBlur: () => setHover(false),
    },
  ];
}

// ─── Inline icons (lifted verbatim from the reference sidebar SVGs) ───
const IconBrand = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0f1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M19 18v3H6.5A2.5 2.5 0 0 1 4 18.5" />
  </svg>
);
const IconClose = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
);
const IconCollapse = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /><path d="M20 5v14" /></svg>
);
const IconSearch = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
);
const IconHome = () => (
  <svg style={{ position: 'relative', flex: '0 0 auto' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7" /><path d="M5 10v9h5v-6h4v6h5v-9" /></svg>
);
const IconNotes = () => (
  <svg style={{ position: 'relative', flex: '0 0 auto' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
);
const IconShared = () => (
  <svg style={{ position: 'relative', flex: '0 0 auto' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8.1 10.9l7.8-3.8M8.1 13.1l7.8 3.8" /></svg>
);
const IconStar = () => (
  <svg style={{ position: 'relative', flex: '0 0 auto' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" /></svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
);
const IconChevrons = () => (
  <svg width="13" height="13" style={{ color: '#9bbcf2', flex: '0 0 auto' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 9l4-4 4 4M8 15l4 4 4-4" /></svg>
);

const TENANT = 'MorganWhiteGroup';

/** A single nav row. Active rows get the accent-soft wash + accent border. */
const NavRow: React.FC<{
  active: boolean;
  showLabels: boolean;
  center: boolean;
  label: string;
  count?: number;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ active, showLabels, center, label, count, icon, onClick }) => {
  const [hover, hoverProps] = useHover();
  return (
  <button
    type="button"
    onClick={onClick}
    title={!showLabels ? label : undefined}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    {...hoverProps}
    style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: center ? 'center' : 'flex-start',
      gap: 11,
      padding: '9px 12px',
      minHeight: 44,
      width: '100%',
      borderRadius: 11,
      cursor: 'pointer',
      fontSize: 13.5,
      fontWeight: 600,
      color: active || hover ? '#e7ecf3' : '#aeb9ca',
      background: !active && hover ? 'rgba(255,255,255,0.05)' : 'transparent',
      border: 'none',
      textAlign: 'left',
    }}
  >
    {active && (
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 11,
          background: 'var(--accent-soft)',
          border: '1px solid rgba(110,168,254,0.32)',
          pointerEvents: 'none',
        }}
      />
    )}
    {icon}
    {showLabels && <span style={{ position: 'relative', flex: 1 }}>{label}</span>}
    {showLabels && count !== undefined && (
      <span className="cb-mono" style={{ position: 'relative', fontSize: 10.5, color: '#7c8aa0' }}>
        {count}
      </span>
    )}
  </button>
  );
};

/** Subtle ghost icon button (collapse / close / new-space). Hover lightens it. */
const IconButton: React.FC<{
  title: string;
  ariaLabel: string;
  bordered?: boolean;
  size?: number;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, ariaLabel, bordered = true, size = 30, onClick, children }) => {
  const [hover, hoverProps] = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      {...hoverProps}
      style={{
        width: size,
        height: size,
        minWidth: 44,
        minHeight: 44,
        borderRadius: bordered ? 9 : 7,
        flex: '0 0 auto',
        display: 'grid',
        placeItems: 'center',
        color: hover ? '#e7ecf3' : '#8b97ab',
        cursor: 'pointer',
        background: hover ? 'rgba(255,255,255,0.05)' : 'transparent',
        border: bordered ? '1px solid rgba(255,255,255,0.06)' : 'none',
      }}
    >
      {children}
    </button>
  );
};

/** A space row: colored dot + name + note count. */
const SpaceRow: React.FC<{
  name: string;
  color: string;
  noteCount: number;
  showLabels: boolean;
  center: boolean;
  onClick: () => void;
}> = ({ name, color, noteCount, showLabels, center, onClick }) => {
  const [hover, hoverProps] = useHover();
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      onClick={onClick}
      {...hoverProps}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: center ? 'center' : 'flex-start',
        gap: 11,
        padding: '8px 12px',
        minHeight: center ? 44 : undefined,
        width: '100%',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 13,
        color: hover ? '#eef2f8' : '#b6c0d0',
        background: hover ? 'rgba(255,255,255,0.05)' : 'transparent',
        border: 'none',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 3,
          flex: '0 0 auto',
          background: color,
          boxShadow: `0 0 10px ${hexa(color, 0.6)}`,
        }}
      />
      {showLabels && (
        <>
          <span style={{ flex: 1, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          <span className="cb-mono" style={{ fontSize: 10.5, color: '#6f7c92' }}>
            {noteCount}
          </span>
        </>
      )}
    </button>
  );
};

/** Search trigger row → opens the command palette. */
const SearchTrigger: React.FC<{ showLabels: boolean; onClick: () => void }> = ({ showLabels, onClick }) => {
  const [hover, hoverProps] = useHover();
  const bg = hover ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)';
  const border = hover ? '1px solid rgba(110,168,254,0.4)' : '1px solid rgba(255,255,255,0.08)';
  const fg = hover ? '#c7d0de' : '#8b97ab';
  if (!showLabels) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Search (⌘K)"
        aria-label="Search"
        {...hoverProps}
        style={{
          width: 46,
          height: 44,
          margin: '0 auto',
          borderRadius: 12,
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          background: bg,
          border,
          color: fg,
        }}
      >
        <IconSearch size={17} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search everything"
      {...hoverProps}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '9px 12px',
        minHeight: 44,
        borderRadius: 12,
        cursor: 'pointer',
        background: bg,
        border,
        color: fg,
        fontSize: 13,
        textAlign: 'left',
      }}
    >
      <IconSearch />
      <span style={{ flex: 1 }}>Search everything…</span>
      <span
        className="cb-mono"
        style={{
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.09)',
          color: '#9aa6ba',
        }}
      >
        ⌘K
      </span>
    </button>
  );
};

/** "You" presence chip → opens the account menu. */
const YouChip: React.FC<{
  name?: string | null;
  color?: string;
  avatarUrl?: string | null;
  onClick: () => void;
}> = ({ name, color, avatarUrl, onClick }) => {
  const [hover, hoverProps] = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      title="You — account & settings"
      aria-label="Open account menu"
      aria-haspopup="menu"
      {...hoverProps}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        flex: '0 0 auto',
        cursor: 'pointer',
        padding: '3px 9px 3px 3px',
        minHeight: 44,
        borderRadius: 30,
        background: hover ? 'rgba(110,168,254,0.20)' : 'rgba(110,168,254,0.12)',
        border: '1px solid rgba(110,168,254,0.30)',
      }}
    >
      <Avatar name={name} color={color} avatarUrl={avatarUrl} size={30} online ring />
      <span style={{ fontSize: 11, fontWeight: 800, color: '#cfe0ff' }}>You</span>
      <IconChevrons />
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ mode, onCollapse, onExpand }) => {
  const router = useRouter();
  const { notes, spaces, me, members, openPalette, toggleAccount, closeNav, createSpace, starredCount } = useApp();
  const { user: authUser } = useAuth();
  const { onlineCount } = usePresence();
  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);

  if (mode === 'hidden') return null;

  const isFull = mode === 'full';
  const isRail = mode === 'rail';
  const isOverlay = mode === 'overlay';
  const showLabels = isFull || isOverlay;
  const center = isRail;

  const path = router.pathname;
  const isDashboard = path === '/';
  const isAllNotes = path === '/notes' || path.startsWith('/notes/');
  const isShared = path === '/shared';
  const isStarred = path === '/starred';

  const go = (href: string) => {
    closeNav();
    router.push(href);
  };

  const otherOnline: Member[] = members.filter((m) => m.online && m.id !== authUser?.id);
  const overflow = Math.max(0, otherOnline.length - 4);
  const overlapAvatars = otherOnline.slice(0, 4);

  const handleCreateSpace = (name: string) => {
    setSpaceDialogOpen(false);
    createSpace(name);
  };

  // Overlay is a fixed drawer; full/rail are relative and fill their grid column.
  const positionStyle: React.CSSProperties = isOverlay
    ? { position: 'fixed', left: 14, top: 14, bottom: 14, width: 284, zIndex: 70 }
    : { position: 'relative', width: '100%', height: '100%' };

  return (
    <>
      <aside
        className="cb-panel"
        aria-label="Primary navigation"
        style={{
          ...positionStyle,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        {/* ── brand ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: center ? 'center' : 'flex-start',
            gap: 11,
            padding: '18px 14px 14px',
          }}
        >
          <button
            type="button"
            onClick={onExpand}
            title="CheatBook"
            aria-label={isRail ? 'Expand sidebar' : 'CheatBook'}
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              flex: '0 0 auto',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              border: 'none',
              background: 'linear-gradient(150deg,#6ea8fe,#8a7bff)',
              boxShadow: '0 6px 18px -6px rgba(110,168,254,0.7),inset 0 1px 0 rgba(255,255,255,0.4)',
            }}
          >
            <IconBrand />
          </button>
          {showLabels && (
            <>
              <div style={{ lineHeight: 1.05, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: '#e7ecf3' }}>CheatBook</div>
                <div className="cb-mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#7c8aa0', marginTop: 3 }}>
                  IT · ENGINEERING
                </div>
              </div>
              {isOverlay && (
                <IconButton title="Close" ariaLabel="Close navigation" onClick={closeNav}>
                  <IconClose />
                </IconButton>
              )}
              {isFull && (
                <IconButton title="Collapse" ariaLabel="Collapse sidebar" onClick={onCollapse}>
                  <IconCollapse />
                </IconButton>
              )}
            </>
          )}
        </div>

        {/* ── search trigger ── */}
        <div style={{ padding: '0 14px 12px' }}>
          <SearchTrigger showLabels={showLabels} onClick={openPalette} />
        </div>

        {/* ── nav ── */}
        <nav style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NavRow active={isDashboard} showLabels={showLabels} center={center} label="Home" icon={<IconHome />} onClick={() => go('/')} />
          <NavRow active={isAllNotes} showLabels={showLabels} center={center} label="All Notes" count={notes.length} icon={<IconNotes />} onClick={() => go('/notes')} />
          <NavRow active={isShared} showLabels={showLabels} center={center} label="Shared with me" icon={<IconShared />} onClick={() => go('/shared')} />
          <NavRow active={isStarred} showLabels={showLabels} center={center} label="Starred" count={starredCount} icon={<IconStar />} onClick={() => go('/starred')} />
        </nav>

        {/* ── spaces header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 8px',
            minHeight: 14,
          }}
        >
          {showLabels ? (
            <>
              <span className="cb-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: '#6f7c92' }}>
                SPACES
              </span>
              <IconButton title="New space" ariaLabel="Create space" bordered={false} size={22} onClick={() => setSpaceDialogOpen(true)}>
                <IconPlus />
              </IconButton>
            </>
          ) : (
            <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.07)' }} />
          )}
        </div>

        {/* ── spaces list ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 10px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            minHeight: 0,
          }}
        >
          {spaces.map((sp) => (
            <SpaceRow
              key={sp.id}
              name={sp.name}
              color={sp.color}
              noteCount={sp.noteCount}
              showLabels={showLabels}
              center={center}
              onClick={() => go('/notes?space=' + sp.id)}
            />
          ))}
        </div>

        {/* ── presence + me (full / overlay) ── */}
        {showLabels && (
          <div
            style={{
              margin: '8px 12px 12px',
              padding: 12,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span
                className="animate-cb-online"
                style={{ width: 7, height: 7, borderRadius: '50%', background: '#5eead4' }}
              />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#cdd6e3' }}>{onlineCount} online now</span>
              <span className="cb-mono" style={{ marginLeft: 'auto', fontSize: 10, color: '#6f7c92' }}>
                {TENANT}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <YouChip name={me?.name} color={me?.color} avatarUrl={me?.avatarUrl} onClick={toggleAccount} />
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                {overlapAvatars.map((m) => (
                  <div key={m.id} title={m.name} style={{ marginLeft: -9, border: '2px solid #0c1119', borderRadius: '50%' }}>
                    <Avatar name={m.name} color={m.color} avatarUrl={m.avatarUrl} size={30} ring />
                  </div>
                ))}
                {overflow > 0 && (
                  <div
                    className="cb-mono"
                    title={`${overflow} more online`}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      marginLeft: -9,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#9aa6ba',
                      background: 'rgba(255,255,255,0.08)',
                      border: '2px solid #0c1119',
                    }}
                  >
                    +{overflow}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── me only (rail) ── */}
        {isRail && (
          <div style={{ margin: '8px auto 14px' }}>
            <button
              type="button"
              onClick={toggleAccount}
              title="You — account"
              aria-label="Open account menu"
              aria-haspopup="menu"
              style={{
                position: 'relative',
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                padding: 0,
              }}
            >
              <Avatar name={me?.name} color={me?.color} avatarUrl={me?.avatarUrl} size={42} online ring />
            </button>
          </div>
        )}
      </aside>

      <InputDialog
        open={spaceDialogOpen}
        title="Create a space"
        label="Space name"
        placeholder="e.g. Incident Response"
        confirmLabel="Create space"
        onSubmit={handleCreateSpace}
        onCancel={() => setSpaceDialogOpen(false)}
      />
    </>
  );
};

export default Sidebar;
