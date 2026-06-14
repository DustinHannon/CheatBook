import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useApp } from './AppContext';
import { useAuth } from './AuthContext';
import { usePresence } from './PresenceContext';
import { useToast } from './Toast';
import { InputDialog } from './InputDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { Avatar } from './ui/Avatar';
import { hexa } from '../lib/colors';
import type { Member, Space } from '../lib/types';

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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
const IconStar = () => (
  <svg style={{ position: 'relative', flex: '0 0 auto' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" /></svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
);
const IconChevrons = () => (
  <svg width="13" height="13" style={{ color: 'var(--accent)', flex: '0 0 auto' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 9l4-4 4 4M8 15l4 4 4-4" /></svg>
);
const IconKebab = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
);
const IconTrash = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
);

const TENANT = 'MorganWhiteGroup';

// The space recolor palette — literal data choices (Infrastructure / Runbooks /
// Onboarding / Incidents / Security / Tribal). These are NOT chrome; do not tokenize.
const SPACE_PALETTE = ['#6ea8fe', '#5eead4', '#86efac', '#fb87a4', '#fbbf72', '#b794f6'];

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
      color: active || hover ? 'var(--text)' : 'var(--text-3)',
      background: !active && hover ? 'var(--bg-hover)' : 'transparent',
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
          border: '1px solid var(--accent)',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />
    )}
    {icon}
    {showLabels && <span style={{ position: 'relative', flex: 1 }}>{label}</span>}
    {showLabels && count !== undefined && (
      <span className="cb-mono" style={{ position: 'relative', fontSize: 10.5, color: 'var(--text-4)' }}>
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
        color: hover ? 'var(--text)' : 'var(--text-3)',
        cursor: 'pointer',
        background: hover ? 'var(--bg-hover)' : 'transparent',
        border: bordered ? '1px solid var(--hairline)' : 'none',
      }}
    >
      {children}
    </button>
  );
};

/**
 * A space row: colored dot + name + note count, plus a hover/focus "manage"
 * kebab. The row is a flex wrapper (not a button) so the kebab can be a sibling
 * button — nesting buttons is invalid HTML.
 */
const SpaceRow: React.FC<{
  name: string;
  color: string;
  noteCount: number;
  showLabels: boolean;
  center: boolean;
  active: boolean;
  onClick: () => void;
  onManage?: () => void;
}> = ({ name, color, noteCount, showLabels, center, active, onClick, onManage }) => {
  const [hover, hoverProps] = useHover();
  return (
    <div
      {...hoverProps}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 10,
        background: active ? 'var(--accent-soft)' : hover ? 'var(--bg-hover)' : 'transparent',
      }}
    >
      <button
        type="button"
        title={name}
        aria-label={name}
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: center ? 'center' : 'flex-start',
          gap: 11,
          padding: '8px 12px',
          minHeight: center ? 44 : 38,
          width: '100%',
          borderRadius: 10,
          cursor: 'pointer',
          fontSize: 13,
          color: hover || active ? 'var(--text-strong)' : 'var(--text-2)',
          background: 'transparent',
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
            {/* count hides while the kebab is shown to avoid crowding; never intercepts clicks */}
            <span className="cb-mono" style={{ fontSize: 10.5, color: 'var(--text-4)', opacity: hover && onManage ? 0 : 1, pointerEvents: 'none' }}>
              {noteCount}
            </span>
          </>
        )}
      </button>
      {showLabels && onManage && (
        <button
          type="button"
          aria-label={`Manage ${name}`}
          title={`Manage ${name}`}
          onClick={(e) => { e.stopPropagation(); onManage(); }}
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 26,
            height: 26,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 7,
            cursor: 'pointer',
            color: 'var(--text-3)',
            background: 'transparent',
            border: 'none',
            // Always interactive (keyboard reachable); focusing it reveals it via
            // the wrapper's onFocus → hover. Opacity-only hide keeps it in tab order.
            opacity: hover ? 1 : 0,
            pointerEvents: 'auto',
          }}
        >
          <IconKebab />
        </button>
      )}
    </div>
  );
};

/** Search trigger row → opens the command palette. */
const SearchTrigger: React.FC<{ showLabels: boolean; onClick: () => void }> = ({ showLabels, onClick }) => {
  const [hover, hoverProps] = useHover();
  const bg = hover ? 'var(--bg-hover-2)' : 'var(--surface-input)';
  const border = hover ? '1px solid var(--accent)' : '1px solid var(--hairline)';
  const fg = hover ? 'var(--text-2)' : 'var(--text-3)';
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
          background: 'var(--bg-hover-2)',
          border: '1px solid var(--hairline)',
          color: 'var(--text-3)',
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
        background: hover ? 'var(--accent-soft)' : 'var(--accent-soft)',
        opacity: hover ? 1 : 0.85,
        border: '1px solid var(--accent)',
      }}
    >
      <Avatar name={name} color={color} avatarUrl={avatarUrl} size={30} online ring />
      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>You</span>
      <IconChevrons />
    </button>
  );
};

/**
 * Manage-space dialog: rename + recolor + delete in one glass modal (same shell
 * as InputDialog/ConfirmDialog, tokenized). Delete is handed back up to the
 * Sidebar so it can route through the shared ConfirmDialog with a cascade warning.
 */
const SpaceManageDialog: React.FC<{
  space: Space;
  onSave: (name: string, color: string) => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({ space, onSave, onDelete, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [name, setName] = useState(space.name);
  const [color, setColor] = useState(space.color);

  useEffect(() => {
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const id = requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    // Restore focus to the trigger (the kebab) when the dialog closes.
    return () => { cancelAnimationFrame(id); document.removeEventListener('keydown', onKey); restoreRef.current?.focus?.(); };
  }, [onClose]);

  const trimmed = name.trim();

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        background: 'var(--backdrop)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cb-manage-space-title"
        className="animate-cb-up"
        style={{
          width: 'min(420px,92vw)', borderRadius: 18, overflow: 'hidden', padding: '24px 24px 20px',
          background: 'var(--modal-grad)', backdropFilter: 'blur(40px) saturate(170%)', WebkitBackdropFilter: 'blur(40px) saturate(170%)',
          border: '1px solid var(--modal-border)', boxShadow: 'var(--modal-shadow)',
        }}
      >
        <h2 id="cb-manage-space-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>Manage space</h2>

        <label htmlFor="cb-space-name" className="cb-mono" style={{ display: 'block', marginTop: 18, marginBottom: 8, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)' }}>
          Name
        </label>
        <input
          id="cb-space-name"
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && trimmed) { e.preventDefault(); onSave(trimmed, color); } }}
          autoComplete="off"
          style={{
            width: '100%', height: 44, padding: '0 14px', borderRadius: 11,
            background: 'var(--surface-input)', border: '1px solid var(--hairline)', outline: 'none',
            color: 'var(--text-strong)', fontSize: 14, fontFamily: "'Manrope',sans-serif",
          }}
        />

        <div className="cb-mono" style={{ marginTop: 18, marginBottom: 8, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)' }}>
          Color
        </div>
        <div role="radiogroup" aria-label="Space color" style={{ display: 'flex', gap: 10 }}>
          {SPACE_PALETTE.map((c) => {
            const selected = color.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                style={{
                  position: 'relative', width: 34, height: 34, borderRadius: 10, cursor: 'pointer', padding: 0,
                  background: c, border: selected ? '2px solid var(--text-strong)' : '2px solid transparent',
                  boxShadow: `0 0 10px ${hexa(c, 0.5)}`,
                }}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete space"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, minHeight: 44, padding: '0 14px', borderRadius: 11,
              cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--danger)',
              background: 'transparent', border: '1px solid var(--hairline)',
            }}
          >
            <IconTrash size={14} /> Delete
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 40, minHeight: 44, padding: '0 16px', borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              color: 'var(--text-2)', background: 'var(--bg-hover)', border: '1px solid var(--hairline)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!trimmed}
            onClick={() => onSave(trimmed, color)}
            style={{
              height: 40, minHeight: 44, padding: '0 18px', borderRadius: 11, cursor: trimmed ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700,
              color: 'var(--text-on-accent)', background: 'var(--accent-grad)', border: 'none', opacity: trimmed ? 1 : 0.5,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ mode, onCollapse, onExpand }) => {
  const router = useRouter();
  const { notes, spaces, me, members, openPalette, toggleAccount, closeNav, createSpace, updateSpace, deleteSpace, starredCount } = useApp();
  const { user: authUser } = useAuth();
  const { onlineCount } = usePresence();
  const { showToast } = useToast();
  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);
  const [manageSpace, setManageSpace] = useState<Space | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Space | null>(null);

  if (mode === 'hidden') return null;

  const isFull = mode === 'full';
  const isRail = mode === 'rail';
  const isOverlay = mode === 'overlay';
  const showLabels = isFull || isOverlay;
  const center = isRail;

  const path = router.pathname;
  const isDashboard = path === '/';
  const isAllNotes = path === '/notes' || path.startsWith('/notes/');
  const isStarred = path === '/starred';
  const activeSpaceId = router.pathname === '/notes' ? (router.query.space as string | undefined) : undefined;

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

  const handleSaveSpace = async (name: string, color: string) => {
    const target = manageSpace;
    setManageSpace(null);
    if (!target) return;
    const updates: { name?: string; color?: string } = {};
    if (name !== target.name) updates.name = name;
    if (color !== target.color) updates.color = color;
    if (!updates.name && !updates.color) return;
    const ok = await updateSpace(target.id, updates);
    showToast(ok ? 'Space updated.' : 'Could not update space.', ok ? 'success' : 'error');
  };

  const handleConfirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    const ok = await deleteSpace(target.id);
    if (ok) {
      showToast('Space deleted.', 'success');
      if (activeSpaceId === target.id) router.push('/notes');
    } else {
      showToast('Could not delete space.', 'error');
    }
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
                <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--text)' }}>CheatBook</div>
                <div className="cb-mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-4)', marginTop: 3 }}>
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
              <span className="cb-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-4)' }}>
                SPACES
              </span>
              <IconButton title="New space" ariaLabel="Create space" bordered={false} size={22} onClick={() => setSpaceDialogOpen(true)}>
                <IconPlus />
              </IconButton>
            </>
          ) : (
            <div style={{ width: '100%', height: 1, background: 'var(--hairline)' }} />
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
              active={activeSpaceId === sp.id}
              onClick={() => go('/notes?space=' + sp.id)}
              onManage={showLabels ? () => setManageSpace(sp) : undefined}
            />
          ))}
          {showLabels && spaces.length === 0 && (
            <div className="cb-mono" style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-4)' }}>
              No spaces yet — add one with +
            </div>
          )}
        </div>

        {/* ── presence + me (full / overlay) ── */}
        {showLabels && (
          <div
            style={{
              margin: '8px 12px 12px',
              padding: 12,
              borderRadius: 14,
              background: 'var(--bg-hover)',
              border: '1px solid var(--hairline)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span
                className="animate-cb-online"
                style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }}
              />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}>{onlineCount} online now</span>
              <span className="cb-mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-4)' }}>
                {TENANT}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <YouChip name={me?.name} color={me?.color} avatarUrl={me?.avatarUrl} onClick={toggleAccount} />
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                {overlapAvatars.map((m) => (
                  <div key={m.id} title={m.name} style={{ marginLeft: -9, border: '2px solid var(--surface-raised)', borderRadius: '50%' }}>
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
                      color: 'var(--text-3)',
                      background: 'var(--bg-hover-2)',
                      border: '2px solid var(--surface-raised)',
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

      {manageSpace && (
        <SpaceManageDialog
          space={manageSpace}
          onSave={handleSaveSpace}
          onDelete={() => { const t = manageSpace; setManageSpace(null); setDeleteTarget(t); }}
          onClose={() => setManageSpace(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title="Delete this space?"
        message={
          deleteTarget && deleteTarget.noteCount > 0
            ? `“${deleteTarget.name}” and its ${deleteTarget.noteCount} note${deleteTarget.noteCount === 1 ? '' : 's'} will be permanently deleted for the whole team. This cannot be undone.`
            : `“${deleteTarget?.name ?? ''}” will be permanently deleted. This cannot be undone.`
        }
        confirmLabel="Delete space"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};

export default Sidebar;
