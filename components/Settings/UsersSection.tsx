import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { getAllUsers, addUserToTeam, removeUserFromTeam, setUserRole } from '../../lib/api';
import { useToast } from '../Toast';
import { useApp } from '../AppContext';
import { Avatar } from '../ui/Avatar';
import { Skeleton } from '../ui/Skeleton';
import { ConfirmDialog } from '../ConfirmDialog';
import type { UserAccount } from '../../lib/types';
import { SectionHead, Eyebrow } from './parts';

const supabase = createClient();

type RoleValue = 'admin' | 'member';

/**
 * Admin "Users" section: approve pending users into the team and manage member roles.
 * Mirrors the other Settings sections (SectionHead + Eyebrow groups, RowList-style cards,
 * Avatar rows, ConfirmDialog for destructive actions). All chrome uses theme tokens.
 */
export const UsersSection: React.FC = () => {
  const { showToast } = useToast();
  const { me } = useApp();

  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [error, setError] = useState(false);
  // Per-user in-flight guard so a row's buttons disable while its action runs.
  const [busyId, setBusyId] = useState<string | null>(null);
  // The member queued for removal (drives the ConfirmDialog).
  const [pendingRemoval, setPendingRemoval] = useState<UserAccount | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      setUsers(await getAllUsers(supabase));
    } catch (err) {
      setUsers(null);
      setError(true);
      showToast(err instanceof Error ? err.message : 'Could not load users.', 'error');
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const { pending, team } = useMemo(() => {
    const list = users ?? [];
    return {
      pending: list.filter((u) => u.pending),
      team: list.filter((u) => !u.pending),
    };
  }, [users]);

  const approve = useCallback(async (u: UserAccount) => {
    setBusyId(u.id);
    try {
      await addUserToTeam(supabase, u.id, 'member');
      showToast(`Added ${u.name || u.email}.`, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add to team.', 'error');
    } finally {
      setBusyId(null);
    }
  }, [load, showToast]);

  const changeRole = useCallback(async (u: UserAccount, role: RoleValue) => {
    if (u.role === role) return;
    setBusyId(u.id);
    try {
      await setUserRole(supabase, u.id, role);
      showToast(`${u.name || u.email} is now ${role === 'admin' ? 'an admin' : 'a member'}.`, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not change role.', 'error');
    } finally {
      setBusyId(null);
    }
  }, [load, showToast]);

  const confirmRemove = useCallback(async () => {
    const u = pendingRemoval;
    setPendingRemoval(null);
    if (!u) return;
    setBusyId(u.id);
    try {
      await removeUserFromTeam(supabase, u.id);
      showToast(`Removed ${u.name || u.email}.`, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not remove from team.', 'error');
    } finally {
      setBusyId(null);
    }
  }, [pendingRemoval, load, showToast]);

  return (
    <>
      <SectionHead
        title="Users"
        lead="Approve who can access CheatBook and manage roles."
      />

      {users === null && !error && <UsersLoading />}

      {error && users === null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            borderRadius: 14,
            background: 'var(--danger-soft)',
            border: '1px solid var(--danger-edge)',
          }}
        >
          <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
            We couldn&apos;t load the user list. Check your connection and try again.
          </div>
          <button
            type="button"
            onClick={load}
            className="cb-users-retry"
            style={{
              flex: '0 0 auto',
              height: 44,
              padding: '0 16px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--danger)',
              background: 'transparent',
              border: '1px solid var(--danger-edge)',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {users !== null && (
        <>
          {/* ── Pending approval ─────────────────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <Eyebrow style={{ marginBottom: 11 }}>
              PENDING APPROVAL{pending.length > 0 ? ` · ${pending.length}` : ''}
            </Eyebrow>
            {pending.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', paddingLeft: 2 }}>
                No one is waiting for access.
              </div>
            ) : (
              <div style={listStyle}>
                {pending.map((u) => (
                  <UserRow key={u.id}>
                    <UserIdentity user={u} />
                    <button
                      type="button"
                      onClick={() => approve(u)}
                      disabled={busyId === u.id}
                      aria-label={`Add ${u.name || u.email} to the team`}
                      className="cb-users-primary"
                      style={{
                        flex: '0 0 auto',
                        height: 38,
                        minHeight: 44,
                        padding: '0 16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        borderRadius: 10,
                        cursor: busyId === u.id ? 'wait' : 'pointer',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--text-on-accent)',
                        background: 'var(--accent-grad)',
                        border: 'none',
                        opacity: busyId === u.id ? 0.7 : 1,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                      {busyId === u.id ? 'Adding…' : 'Add to team'}
                    </button>
                  </UserRow>
                ))}
              </div>
            )}
          </div>

          {/* ── Team members ─────────────────────────────────────── */}
          <div>
            <Eyebrow style={{ marginBottom: 11 }}>
              TEAM MEMBERS{team.length > 0 ? ` · ${team.length}` : ''}
            </Eyebrow>
            {team.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', paddingLeft: 2 }}>
                No team members yet.
              </div>
            ) : (
              <div style={listStyle}>
                {team.map((u) => {
                  const isSelf = me?.id === u.id;
                  const busy = busyId === u.id;
                  const role: RoleValue = u.role === 'admin' ? 'admin' : 'member';
                  return (
                    <UserRow key={u.id}>
                      <UserIdentity user={u} isSelf={isSelf} />
                      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RoleControl
                          role={role}
                          disabled={busy || isSelf}
                          name={u.name || u.email}
                          onChange={(next) => changeRole(u, next)}
                        />
                        <button
                          type="button"
                          onClick={() => setPendingRemoval(u)}
                          disabled={busy || isSelf}
                          aria-label={isSelf ? 'You cannot remove yourself' : `Remove ${u.name || u.email} from the team`}
                          className="cb-users-remove"
                          style={{
                            height: 38,
                            minHeight: 44,
                            padding: '0 12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            borderRadius: 10,
                            cursor: busy || isSelf ? 'not-allowed' : 'pointer',
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: 'var(--text-3)',
                            background: 'transparent',
                            border: 'none',
                            opacity: isSelf ? 0.4 : 1,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </UserRow>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove from the team?"
        message={
          pendingRemoval
            ? `Remove ${pendingRemoval.name || pendingRemoval.email} from the team? They lose all access until re-added.`
            : undefined
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemoval(null)}
      />

      {/* Hover affordances kept in CSS to avoid per-element JS state. */}
      <style jsx>{`
        .cb-users-primary:hover:not(:disabled) { filter: brightness(1.08); }
        .cb-users-remove:not(:disabled):hover { color: var(--danger); background: var(--danger-soft); }
        .cb-users-retry:hover { background: var(--danger-soft); }
      `}</style>
    </>
  );
};

// ─── Row scaffolding ──────────────────────────────────────────────────

// Rounded, hairline-bordered list mirroring the RowList primitive, but laid out
// for two-up (identity ↔ actions) rows with comfortable vertical padding.
const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  borderRadius: 14,
  overflow: 'hidden',
  border: '1px solid var(--hairline)',
};

const UserRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 16px',
      background: 'var(--bg-hover)',
    }}
  >
    {children}
  </div>
);

const UserIdentity: React.FC<{ user: UserAccount; isSelf?: boolean }> = ({ user, isSelf }) => (
  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
    <Avatar name={user.name} color={user.color} avatarUrl={user.avatarUrl} size={38} />
    <div style={{ minWidth: 0, lineHeight: 1.3 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 13.5,
          fontWeight: 700,
          color: 'var(--text-strong)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || 'Unnamed'}</span>
        {isSelf && (
          <span
            className="font-mono"
            style={{
              flex: '0 0 auto',
              fontSize: 9,
              letterSpacing: '0.08em',
              fontWeight: 700,
              color: 'var(--accent)',
              padding: '2px 6px',
              borderRadius: 6,
              background: 'var(--accent-soft)',
            }}
          >
            YOU
          </span>
        )}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 11,
          color: 'var(--text-3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {user.email}
      </div>
    </div>
  </div>
);

// ─── Role segmented control ───────────────────────────────────────────

// Two-segment Member / Admin toggle. The active segment reads as a badge
// (admin = violet, member = subtle neutral); inactive segment is a click target.
// When disabled (self / in-flight) it renders as a static badge of the current role.
const RoleControl: React.FC<{
  role: RoleValue;
  disabled?: boolean;
  name: string;
  onChange: (next: RoleValue) => void;
}> = ({ role, disabled, name, onChange }) => {
  if (disabled) {
    return <RoleBadge role={role} />;
  }
  return (
    <div
      role="group"
      aria-label={`Role for ${name}`}
      style={{
        display: 'inline-flex',
        padding: 2,
        gap: 2,
        borderRadius: 9,
        background: 'var(--surface-input)',
        border: '1px solid var(--border-strong)',
      }}
    >
      {(['member', 'admin'] as RoleValue[]).map((opt) => {
        const active = role === opt;
        const isAdmin = opt === 'admin';
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            aria-label={`Set ${name} as ${opt}`}
            style={{
              minHeight: 32,
              padding: '0 11px',
              borderRadius: 7,
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: 700,
              border: 'none',
              transition: 'background 0.14s ease, color 0.14s ease',
              color: active
                ? (isAdmin ? 'var(--violet)' : 'var(--text-strong)')
                : 'var(--text-3)',
              background: active
                ? (isAdmin ? 'color-mix(in srgb, var(--violet) 18%, transparent)' : 'var(--bg-hover)')
                : 'transparent',
            }}
          >
            {isAdmin ? 'Admin' : 'Member'}
          </button>
        );
      })}
    </div>
  );
};

const RoleBadge: React.FC<{ role: RoleValue }> = ({ role }) => {
  const isAdmin = role === 'admin';
  return (
    <span
      className="font-mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 32,
        padding: '0 11px',
        borderRadius: 8,
        fontSize: 10.5,
        letterSpacing: '0.06em',
        fontWeight: 700,
        color: isAdmin ? 'var(--violet)' : 'var(--text-3)',
        background: isAdmin ? 'color-mix(in srgb, var(--violet) 16%, transparent)' : 'var(--bg-hover)',
        border: `1px solid ${isAdmin ? 'color-mix(in srgb, var(--violet) 34%, transparent)' : 'var(--hairline)'}`,
      }}
    >
      {isAdmin ? 'ADMIN' : 'MEMBER'}
    </span>
  );
};

// ─── Loading skeleton ─────────────────────────────────────────────────

const UsersLoading: React.FC = () => (
  <div className="flex flex-col gap-7">
    {[0, 1].map((group) => (
      <div key={group} className="flex flex-col gap-3">
        <Skeleton className="h-3 w-32" />
        <div style={listStyle}>
          {[0, 1].map((row) => (
            <div
              key={row}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'var(--bg-hover)',
              }}
            >
              <Skeleton className="h-[38px] w-[38px] rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2.5 w-56" />
              </div>
              <Skeleton className="h-[38px] w-24 rounded-[10px]" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default UsersSection;
