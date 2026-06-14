import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useApp } from '../AppContext';
import { usePresence } from '../PresenceContext';
import { Avatar } from '../ui/Avatar';
import { Skeleton } from '../ui/Skeleton';
import { greeting, dashboardDate, relativeTime, staleAge } from '../../lib/time';
import { hexa } from '../../lib/colors';
import type { Note, Member } from '../../lib/types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_MS = 180 * 24 * 60 * 60 * 1000;

/** Viewport-class hook mirroring the reference breakpoints (mobile <760, tablet 760–1140, desktop ≥1140). */
function useViewport(): { isMobile: boolean; isTablet: boolean } {
  const [w, setW] = useState<number | null>(null);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // SSR / first paint: assume desktop so layout doesn't flash to mobile.
  const width = w ?? 1440;
  return { isMobile: width < 760, isTablet: width >= 760 && width < 1140 };
}

const PlusIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-accent)" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const MenuIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const ClockIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.9" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/** A small overlapping contributor avatar (matches reference 22px circle). */
const MiniAvatar: React.FC<{ member: Member }> = ({ member }) => (
  <div
    className="grid place-items-center rounded-full font-mono font-bold"
    style={{
      width: 22, height: 22, marginRight: -7, fontSize: 9,
      color: member.color, background: hexa(member.color, 0.18),
      border: '1.5px solid var(--surface-raised)',
    }}
    title={member.name}
  >
    {member.initials}
  </div>
);

export const Dashboard: React.FC = () => {
  const router = useRouter();
  const {
    loading, me, notes, spaces, activity, memberById, createNote, openNav, isPending,
  } = useApp();
  const { onlineCount } = usePresence();
  const { isMobile, isTablet } = useViewport();

  const [creating, setCreating] = useState(false);

  const firstName = me?.name ? me.name.split(' ')[0] : 'there';
  const firstSpace = spaces[0]?.id ?? null;

  const handleNewNote = async () => {
    if (!firstSpace || creating) return;
    setCreating(true);
    try {
      const note = await createNote(firstSpace);
      if (note) router.push(`/notes/${note.id}`);
    } finally {
      setCreating(false);
    }
  };

  const openNote = (id: string) => router.push(`/notes/${id}`);

  // ── Derived data ──────────────────────────────────────────────────────
  const editsThisWeek = useMemo(() => {
    const cutoff = Date.now() - WEEK_MS;
    return notes.filter((n) => new Date(n.updatedAt).getTime() >= cutoff).length;
  }, [notes]);

  const recent = useMemo<Note[]>(() => {
    return [...notes]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4);
  }, [notes]);

  const stale = useMemo<Note[]>(() => {
    const cutoff = Date.now() - STALE_MS;
    return notes
      .filter((n) => n.staleSince || new Date(n.updatedAt).getTime() < cutoff)
      .sort((a, b) => {
        const aT = new Date(a.staleSince || a.updatedAt).getTime();
        const bT = new Date(b.staleSince || b.updatedAt).getTime();
        return aT - bT; // oldest first
      })
      .slice(0, 4);
  }, [notes]);

  const stats = useMemo(() => ([
    { value: notes.length, label: 'Total notes', color: '#eef2f8' },
    { value: spaces.length, label: 'Spaces', color: '#6ea8fe' },
    { value: editsThisWeek, label: 'Edits this week', color: '#5eead4' },
    { value: onlineCount, label: 'Online now', color: '#b794f6' },
  ]), [notes.length, spaces.length, editsThisWeek, onlineCount]);

  // ── Responsive tokens (lifted from reference renderVals) ──────────────
  const statCols = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)';
  const dashCols = isMobile || isTablet ? '1fr' : '1.3fr 1fr';
  const dashPad = isMobile ? '22px 16px 48px' : '34px 40px 60px';

  // ── Pending state ─────────────────────────────────────────────────────
  // Authed but not yet approved (awaiting an admin). RLS returns no
  // notes/spaces/members, so the normal tiles would be empty and meaningless —
  // show only a welcome/pending card on the glass shell instead.
  if (isPending) {
    return (
      <section
        className="cb-panel relative flex min-h-0 w-full flex-col overflow-y-auto"
        style={{ borderRadius: 20 }}
        aria-label="Dashboard"
      >
        <div style={{ maxWidth: 1080, width: '100%', margin: '0 auto', padding: dashPad }}>
          {isMobile && (
            <button
              type="button"
              onClick={openNav}
              aria-label="Open navigation"
              className="mb-[22px] grid flex-none cursor-pointer place-items-center text-text-2 hover:bg-hover"
              style={{ width: 44, height: 44, borderRadius: 9, border: '1px solid var(--hairline)' }}
            >
              <MenuIcon />
            </button>
          )}
          <div
            className="mx-auto flex flex-col items-center text-center"
            style={{
              maxWidth: 520,
              marginTop: isMobile ? 8 : 56,
              padding: isMobile ? '32px 22px' : '44px 40px',
              borderRadius: 18,
              background: 'var(--bg-hover)',
              border: '1px solid var(--hairline)',
            }}
          >
            <div
              className="grid place-items-center"
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                marginBottom: 22,
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
                border: '1px solid rgba(110,168,254,0.32)',
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3 19a6 6 0 0 1 12 0" />
                <path d="M17 11h4" />
                <path d="M19 9v4" />
              </svg>
            </div>
            <div
              className="font-mono"
              style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: 12 }}
            >
              CHEATBOOK / ACCESS PENDING
            </div>
            <h1 className="m-0 text-text" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
              Access pending
            </h1>
            <p
              style={{
                margin: '14px 0 0',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--text-3)',
                maxWidth: 420,
              }}
            >
              An admin needs to approve your access before you can see notes.
              Check back once you&apos;ve been approved.
            </p>
            {me?.name && (
              <div
                className="font-mono"
                style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 20 }}
              >
                Signed in as {me.name}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="cb-panel relative flex min-h-0 w-full flex-col overflow-y-auto"
      style={{ borderRadius: 20 }}
      aria-label="Dashboard"
    >
      <div style={{ maxWidth: 1080, width: '100%', margin: '0 auto', padding: dashPad }}>
        {/* Header */}
        <div className="mb-[30px] flex items-end gap-4">
          {isMobile && (
            <button
              type="button"
              onClick={openNav}
              aria-label="Open navigation"
              className="grid flex-none cursor-pointer place-items-center self-center text-text-2 hover:bg-hover"
              style={{ width: 44, height: 44, borderRadius: 9, border: '1px solid var(--hairline)' }}
            >
              <MenuIcon />
            </button>
          )}
          <div>
            {loading ? (
              <>
                <Skeleton className="mb-[6px] h-3 w-40" />
                <Skeleton className="h-8 w-64" />
              </>
            ) : (
              <>
                <div
                  className="font-mono"
                  style={{ fontSize: 11, letterSpacing: '0.06em', color: '#6ea8fe', marginBottom: 6 }}
                >
                  {dashboardDate()}
                </div>
                <h1 className="m-0 text-text" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>
                  {greeting()}, {firstName}
                </h1>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleNewNote}
            disabled={loading || !firstSpace || creating}
            className="ml-auto flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-[1.07]"
            style={{
              height: 38, minHeight: 38, padding: '0 16px', borderRadius: 11,
              fontSize: 13, fontWeight: 700, color: '#0a0f1a', cursor: 'pointer',
              background: 'var(--accent-grad)',
              boxShadow: '0 8px 20px -8px rgba(110,168,254,0.8)',
            }}
          >
            <PlusIcon />
            {creating ? 'Creating…' : 'New note'}
          </button>
        </div>

        {/* Stat tiles */}
        <div className="mb-[14px] grid gap-3" style={{ gridTemplateColumns: statCols }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[78px] rounded-[15px]" />
              ))
            : stats.map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: '16px 18px', borderRadius: 15,
                    background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: s.color }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 12, color: '#8b97ab', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
        </div>

        {/* Body */}
        <div className="grid gap-[14px]" style={{ gridTemplateColumns: dashCols }}>
          {/* Left column */}
          <div className="flex flex-col gap-[14px]">
            {/* Continue where you left off */}
            <div
              style={{
                padding: 18, borderRadius: 16,
                background: 'var(--bg-hover)', border: '1px solid var(--hairline)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)', marginBottom: 14 }}>
                Continue where you left off
              </div>
              <div className="flex flex-col gap-2">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-[50px] rounded-[12px]" />
                  ))
                ) : recent.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', padding: '6px 2px' }}>
                    No notes yet — create your first one.
                  </div>
                ) : (
                  recent.map((n) => {
                    const space = n.space;
                    const color = space?.color || '#6ea8fe';
                    const contributors = n.collaboratorIds
                      .map((id) => memberById(id))
                      .filter((m): m is Member => !!m)
                      .slice(0, 3);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => openNote(n.id)}
                        className="flex w-full items-center gap-[13px] text-left hover:!border-strong hover:!bg-hover"
                        style={{
                          padding: '11px 13px', borderRadius: 12, cursor: 'pointer',
                          background: 'var(--bg-hover)', border: '1px solid var(--hairline)',
                        }}
                      >
                        <span
                          className="flex-none"
                          style={{
                            width: 9, height: 9, borderRadius: 3,
                            background: color, boxShadow: `0 0 10px ${hexa(color, 0.6)}`,
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate"
                            style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)' }}
                          >
                            {n.title || 'Untitled note'}
                          </span>
                          <span
                            className="block font-mono"
                            style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 2 }}
                          >
                            {space?.name || 'No space'} · {relativeTime(n.updatedAt)}
                          </span>
                        </span>
                        <span className="flex flex-none">
                          {contributors.map((m) => (
                            <MiniAvatar key={m.id} member={m} />
                          ))}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Needs attention · stale knowledge */}
            <div
              style={{
                padding: 18, borderRadius: 16,
                background: 'rgba(251,135,164,0.05)', border: '1px solid rgba(251,135,164,0.18)',
              }}
            >
              <div className="mb-[14px] flex items-center gap-2">
                <ClockIcon />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#f5c2cf' }}>
                  Needs attention · stale knowledge
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-[44px] rounded-[11px]" />
                  ))
                ) : stale.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '4px 2px' }}>
                    Nothing stale — your knowledge base is fresh.
                  </div>
                ) : (
                  stale.map((n) => {
                    const staleRef = n.staleSince || n.updatedAt;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => openNote(n.id)}
                        className="flex w-full items-center gap-3 text-left hover:!bg-hover"
                        style={{
                          padding: '10px 12px', borderRadius: 11, cursor: 'pointer',
                          background: 'var(--bg-hover)', border: '1px solid transparent',
                        }}
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate"
                            style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}
                          >
                            {n.title || 'Untitled note'}
                          </span>
                          <span
                            className="block font-mono"
                            style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}
                          >
                            {n.space?.name || 'No space'}
                          </span>
                        </span>
                        <span
                          className="whitespace-nowrap font-mono"
                          style={{
                            fontSize: 10, fontWeight: 600, color: 'var(--danger)',
                            padding: '3px 8px', borderRadius: 6, background: 'rgba(251,135,164,0.14)',
                          }}
                        >
                          {staleAge(staleRef)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right column: live activity */}
          <div
            style={{
              padding: 18, borderRadius: 16,
              background: 'var(--bg-hover)', border: '1px solid var(--hairline)',
            }}
          >
            <div className="mb-4 flex items-center gap-2">
              <span
                className="animate-cb-pulse"
                style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }}
              />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>Live activity</span>
            </div>
            <div className="flex flex-col">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex gap-3"
                    style={{ padding: '9px 0', borderBottom: '1px solid var(--hairline)' }}
                  >
                    <Skeleton className="h-7 w-7 flex-none rounded-full" />
                    <Skeleton className="h-8 flex-1" />
                  </div>
                ))
              ) : activity.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', padding: '6px 0' }}>
                  No recent activity.
                </div>
              ) : (
                activity.map((a) => {
                  const actor = a.actorId ? memberById(a.actorId) : undefined;
                  const color = actor?.color || a.spaceColor || '#6ea8fe';
                  return (
                    <div
                      key={a.id}
                      className="flex gap-3"
                      style={{ padding: '9px 0', borderBottom: '1px solid var(--hairline)' }}
                    >
                      {actor ? (
                        <Avatar
                          name={actor.name}
                          color={actor.color}
                          avatarUrl={actor.avatarUrl}
                          size={28}
                          ring={false}
                          className="!flex-none"
                        />
                      ) : (
                        <div
                          className="grid flex-none place-items-center rounded-full font-mono font-bold"
                          style={{
                            width: 28, height: 28, fontSize: 10,
                            color, background: hexa(color, 0.18), border: '1.5px solid var(--surface-raised)',
                          }}
                        >
                          {a.actorName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-3)' }}>
                        <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{a.actorName}</strong>{' '}
                        {a.verb}{' '}
                        {a.targetTitle && (
                          <span style={{ color: a.spaceColor || '#6ea8fe', fontWeight: 600 }}>
                            {a.targetTitle}
                          </span>
                        )}
                        <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 3 }}>
                          {relativeTime(a.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
