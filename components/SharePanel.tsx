import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { useApp } from './AppContext';
import { useToast } from './Toast';
import { Skeleton } from './ui/Skeleton';
import {
  getNote, getCollaborators, addCollaboratorByEmail, setCollaboratorPermission,
  removeCollaborator, getLinkShare, setLinkShare,
} from '../lib/api';
import { hexa } from '../lib/colors';
import type { Member, Permission, ShareGrant } from '../lib/types';

const supabase = createClient();

const PERMISSION_OPTIONS: { value: Permission; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'edit', label: 'Can edit' },
  { value: 'view', label: 'Can view' },
];
const PERMISSION_LABEL: Record<Permission, string> = { owner: 'Owner', edit: 'Can edit', view: 'Can view' };

interface AccessRow {
  member: Member;
  userId: string;
  permission: Permission;
  isYou: boolean;
}

/** Right slide-over to share a note: invite by email, link sharing, and per-person access. */
export const SharePanel: React.FC<{ noteId: string; open: boolean; onClose: () => void }> = ({
  noteId, open, onClose,
}) => {
  const { me, memberById, members } = useApp();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [grants, setGrants] = useState<ShareGrant[]>([]);
  const [linkOn, setLinkOn] = useState(false);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();

  // ─── Load data when the panel opens ───
  const reloadAccess = useCallback(async () => {
    try {
      setGrants(await getCollaborators(supabase, noteId));
    } catch {
      /* keep prior on transient failure */
    }
  }, [noteId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [note, collabs, link] = await Promise.all([
          getNote(supabase, noteId),
          getCollaborators(supabase, noteId),
          getLinkShare(supabase, noteId),
        ]);
        if (cancelled) return;
        setNoteTitle(note.title);
        setGrants(collabs);
        setLinkOn(link.enabled);
      } catch {
        if (!cancelled) setError('Could not load sharing settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, noteId]);

  // ─── Escape to close (and close any open permission menu first) ───
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (openMenuFor) { setOpenMenuFor(null); return; }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, openMenuFor, onClose]);

  // ─── Focus the invite input when opened ───
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  // Reset transient input state when closed.
  useEffect(() => {
    if (!open) { setEmail(''); setOpenMenuFor(null); }
  }, [open]);

  // ─── People-with-access rows: collaborators joined to live members ───
  const rows = useMemo<AccessRow[]>(() => {
    return grants
      .map((g): AccessRow | null => {
        const member = memberById(g.userId);
        if (!member) return null;
        return { member, userId: g.userId, permission: g.permission, isYou: me?.id === g.userId };
      })
      .filter((r): r is AccessRow => r !== null)
      // Owner first, then current user, then alphabetical for a stable order.
      .sort((a, b) => {
        if (a.permission === 'owner' && b.permission !== 'owner') return -1;
        if (b.permission === 'owner' && a.permission !== 'owner') return 1;
        if (a.isYou && !b.isYou) return -1;
        if (b.isYou && !a.isYou) return 1;
        return a.member.name.localeCompare(b.member.name);
      });
  }, [grants, memberById, me?.id]);

  const noteUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/notes/${noteId}` : `/notes/${noteId}`),
    [noteId],
  );

  // ─── Actions ───
  const handleInvite = useCallback(async () => {
    const value = email.trim();
    if (!value || inviting) return;
    setInviting(true);
    try {
      if (value.startsWith('@')) {
        // Resolve @name against the team and grant by user id.
        const handle = value.slice(1).toLowerCase();
        const m = members.find(
          (x) => x.username?.toLowerCase() === handle || x.name.toLowerCase() === handle,
        );
        if (!m) throw new Error('No teammate found with that @name.');
        // Never downgrade an existing owner/editor to view.
        if (grants.some((g) => g.userId === m.id)) {
          showToast('That teammate already has access.', 'info');
          return;
        }
        await setCollaboratorPermission(supabase, noteId, m.id, 'view');
      } else {
        // Resolve to a member id so we can detect an existing grant before inviting.
        const m = members.find((x) => x.email.toLowerCase() === value.toLowerCase());
        if (m && grants.some((g) => g.userId === m.id)) {
          showToast('That teammate already has access.', 'info');
          return;
        }
        await addCollaboratorByEmail(supabase, noteId, value);
      }
      setEmail('');
      await reloadAccess();
      showToast('Invitation sent.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not invite that teammate.', 'error');
    } finally {
      setInviting(false);
    }
  }, [email, inviting, noteId, reloadAccess, showToast, members, grants]);

  const handleToggleLink = useCallback(async () => {
    const next = !linkOn;
    setLinkOn(next); // optimistic
    try {
      await setLinkShare(supabase, { noteId, enabled: next, scope: 'tenant', permission: 'view' });
      showToast(next ? 'Link sharing on — anyone at MorganWhiteGroup can view.' : 'Link sharing off.', 'success');
    } catch {
      setLinkOn(!next);
      showToast('Could not update link sharing.', 'error');
    }
  }, [linkOn, noteId, showToast]);

  const handlePermission = useCallback(async (userId: string, permission: Permission) => {
    setOpenMenuFor(null);
    const prev = grants;
    setGrants((g) => g.map((x) => (x.userId === userId ? { ...x, permission } : x))); // optimistic
    try {
      await setCollaboratorPermission(supabase, noteId, userId, permission);
      showToast('Permission updated.', 'success');
    } catch {
      setGrants(prev);
      showToast('Could not update permission.', 'error');
    }
  }, [grants, noteId, showToast]);

  const handleRemove = useCallback(async (userId: string) => {
    setOpenMenuFor(null);
    const prev = grants;
    setGrants((g) => g.filter((x) => x.userId !== userId)); // optimistic
    try {
      await removeCollaborator(supabase, noteId, userId);
      showToast('Access removed.', 'success');
      await reloadAccess();
    } catch {
      setGrants(prev);
      showToast('Could not remove access.', 'error');
    }
  }, [grants, noteId, reloadAccess, showToast]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(noteUrl);
      showToast('Link copied to clipboard.', 'success');
    } catch {
      showToast('Could not copy link.', 'error');
    }
  }, [noteUrl, showToast]);

  // Close the permission menu on outside click within the panel.
  useEffect(() => {
    if (!openMenuFor) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-perm-menu]')) setOpenMenuFor(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenuFor]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'var(--backdrop)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px,92vw)', height: '100%',
          display: 'flex', flexDirection: 'column',
          animation: 'cbSlide .22s ease',
          background: 'linear-gradient(180deg,rgba(24,30,42,0.94),rgba(14,18,28,0.96))',
          backdropFilter: 'blur(40px) saturate(170%)', WebkitBackdropFilter: 'blur(40px) saturate(170%)',
          borderLeft: '1px solid var(--modal-border)',
          boxShadow: '-40px 0 100px -30px rgba(0,0,0,0.9)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid var(--hairline)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6ea8fe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" />
              <path d="M8.1 10.9l7.8-3.8M8.1 13.1l7.8 3.8" />
            </svg>
            <h3 id={headingId} style={{ margin: 0, fontSize: 16, fontWeight: 800, flex: 1 }} className="text-text">Share note</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close share panel"
              className="grid place-items-center text-text-3 hover:bg-hover-2 hover:text-text"
              style={{ width: 30, height: 30, borderRadius: 9, cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div style={{ fontSize: 12.5 }} className="text-text-3 truncate">{noteTitle || (loading ? 'Loading…' : '')}</div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          {/* Invite by email */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            <input
              ref={inputRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
              placeholder="Invite by email or @name"
              aria-label="Invite by email or @name"
              className="cb-invite-input text-text font-body"
              style={{
                flex: 1, height: 40, padding: '0 14px', borderRadius: 11,
                background: 'var(--surface-input)', border: '1px solid var(--hairline)',
                outline: 'none', fontSize: 13,
              }}
            />
            <button
              type="button"
              onClick={handleInvite}
              disabled={!email.trim() || inviting}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 40, height: 40, padding: '0 14px', borderRadius: 11,
                fontSize: 12.5, fontWeight: 700, color: 'var(--text-on-accent)',
                background: 'var(--accent-grad)',
                cursor: email.trim() && !inviting ? 'pointer' : 'not-allowed',
                opacity: email.trim() && !inviting ? 1 : 0.6,
                filter: 'brightness(1)', whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { if (email.trim() && !inviting) e.currentTarget.style.filter = 'brightness(1.07)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
            >
              {inviting ? 'Inviting…' : 'Invite'}
            </button>
          </div>

          {/* Link sharing */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: 14, borderRadius: 13,
              marginBottom: 22, background: 'rgba(110,168,254,0.06)', border: '1px solid rgba(110,168,254,0.18)',
            }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: 10, flex: '0 0 auto',
                display: 'grid', placeItems: 'center', color: '#6ea8fe', background: 'rgba(110,168,254,0.14)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
                <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Anyone at MorganWhiteGroup</div>
              <div style={{ fontSize: 11, marginTop: 2 }} className="text-text-3">with the link can view</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={linkOn}
              aria-label="Anyone at MorganWhiteGroup with the link can view"
              onClick={handleToggleLink}
              disabled={loading}
              style={{
                width: 44, height: 26, borderRadius: 20, cursor: loading ? 'default' : 'pointer',
                position: 'relative', transition: 'background .15s', padding: 0, border: 'none',
                background: linkOn ? 'var(--accent)' : 'var(--border-strong)',
              }}
            >
              <span
                style={{
                  position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left .15s', left: linkOn ? 21 : 3,
                }}
              />
            </button>
          </div>

          {/* People with access */}
          <div style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-4)', marginBottom: 10 }} className="font-mono">
            PEOPLE WITH ACCESS
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px' }}>
                  <Skeleton className="h-[34px] w-[34px] rounded-full" />
                  <div style={{ flex: 1 }}>
                    <Skeleton className="mb-1.5 h-3 w-1/2" />
                    <Skeleton className="h-2.5 w-1/4" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div style={{ fontSize: 12.5, padding: '14px 6px' }} className="text-danger" role="alert">{error}</div>
          ) : rows.length === 0 ? (
            <div style={{ fontSize: 12.5, padding: '14px 6px' }} className="text-text-3">
              Only you have access. Invite a teammate above.
            </div>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, listStyle: 'none', margin: 0, padding: 0 }}>
              {rows.map((row) => {
                const menuOpen = openMenuFor === row.userId;
                const tokenBg = hexa(row.member.color, 0.18);
                return (
                  <li
                    key={row.userId}
                    className="hover:bg-hover"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', borderRadius: 11 }}
                  >
                    <div style={{ position: 'relative' }}>
                      <div
                        className="font-mono"
                        style={{
                          width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center',
                          fontSize: 11, fontWeight: 700, color: row.member.color, background: tokenBg,
                          border: '1.5px solid var(--surface-raised)', overflow: 'hidden',
                        }}
                      >
                        {row.member.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                          row.member.initials
                        )}
                      </div>
                      {row.member.online && (
                        <span
                          style={{
                            position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%',
                            background: 'var(--success)', border: '2px solid #14182a',
                          }}
                        />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }} className="truncate">
                        {row.member.name}{row.isYou ? ' (you)' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }} className="truncate">{row.member.role}</div>
                    </div>

                    {/* Permission dropdown */}
                    <div style={{ position: 'relative' }} data-perm-menu>
                      <button
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={menuOpen}
                        aria-label={`Permission for ${row.member.name}: ${PERMISSION_LABEL[row.permission]}`}
                        onClick={() => setOpenMenuFor(menuOpen ? null : row.userId)}
                        className="hover:text-text"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600,
                          color: '#9aa6ba', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', minHeight: 28,
                          background: 'var(--surface-input)',
                          border: menuOpen ? '1px solid var(--border-strong)' : '1px solid var(--hairline)',
                        }}
                      >
                        {PERMISSION_LABEL[row.permission]}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                          style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      {menuOpen && (
                        <ul
                          role="listbox"
                          aria-label="Set permission"
                          className="cb-panel"
                          style={{
                            position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 10,
                            minWidth: 132, padding: 4, borderRadius: 11, listStyle: 'none', margin: 0,
                          }}
                        >
                          {PERMISSION_OPTIONS.map((opt) => {
                            const active = opt.value === row.permission;
                            return (
                              <li key={opt.value} role="option" aria-selected={active}>
                                <button
                                  type="button"
                                  onClick={() => handlePermission(row.userId, opt.value)}
                                  className="hover:bg-hover"
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                                    width: '100%', minHeight: 34, padding: '7px 10px', borderRadius: 8,
                                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                    color: active ? '#e7ecf3' : '#9aa6ba', background: 'transparent', border: 'none',
                                    textAlign: 'left',
                                  }}
                                >
                                  {opt.label}
                                  {active && (
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6ea8fe" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                          {!row.isYou && (
                            <li role="option" aria-selected={false}>
                              <button
                                type="button"
                                onClick={() => handleRemove(row.userId)}
                                aria-label={`Remove access for ${row.member.name}`}
                                className="hover:bg-hover"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  width: '100%', minHeight: 34, padding: '7px 10px', borderRadius: 8,
                                  marginTop: 4, paddingTop: 9,
                                  border: 'none', borderTop: '1px solid var(--hairline)',
                                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                  color: '#ff8fa3', background: 'transparent',
                                  textAlign: 'left',
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                </svg>
                                Remove access
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 22px', borderTop: '1px solid var(--hairline)', display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleCopyLink}
            className="hover:bg-hover-2"
            style={{
              flex: 1, minHeight: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#cdd6e3',
              background: 'var(--bg-hover)', border: '1px solid var(--hairline)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" />
            </svg>
            Copy link
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, minHeight: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#0a0f1a',
              background: 'var(--accent-grad)', border: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.07)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
          >
            Done
          </button>
        </div>
      </div>

      <style>{
        '@keyframes cbSlide{from{transform:translateX(40px)}to{transform:translateX(0)}}'
        + '.cb-invite-input::placeholder{color:#6f7c92}'
        + '.cb-invite-input:focus{border-color:rgba(110,168,254,0.5)!important}'
      }</style>
    </div>
  );
};

export default SharePanel;
