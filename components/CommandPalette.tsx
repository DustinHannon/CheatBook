import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '../lib/supabase/client';
import { useApp } from './AppContext';
import { useToast } from './Toast';
import { searchNotes } from '../lib/api';
import type { Note } from '../lib/types';
import { Skeleton } from './ui/Skeleton';

const supabase = createClient();

// Inline SVG icons lifted VERBATIM from the reference `ico()` helper
// (14×14, stroke=currentColor, strokeWidth=2, round caps/joins).
const ActionIcon: React.FC<{ d: string }> = ({ d }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

// Reference path data for each quick action.
const PATH_NEW = 'M12 5v14M5 12h14';
const PATH_INVITE = 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6';
const PATH_DASHBOARD = 'M3 11l9-7 9 7M5 10v9h14v-9';
const PATH_UPLOAD = 'M12 3v12M7 8l5-5 5 5M5 21h14';

interface ActionDef {
  id: string;
  label: string;
  pathD: string;
  hotkey?: string;
  run: () => void;
}

// A flattened, navigable result row — either a note hit or a quick action.
type Row =
  | { kind: 'note'; key: string; note: Note; run: () => void }
  | { kind: 'action'; key: string; action: ActionDef; run: () => void };

export const CommandPalette: React.FC = () => {
  const router = useRouter();
  const { paletteOpen, closePalette, teamId, notes, spaces, createNote } = useApp();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[] | null>(null); // null = use recent notes
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Current note id from the route (drives note-targeted actions).
  const currentNoteId = typeof router.query.id === 'string' ? router.query.id : undefined;
  const firstSpaceId = spaces[0]?.id ?? null;

  // ── Reset + autofocus each time the palette opens ──────────────────────
  useEffect(() => {
    if (!paletteOpen) return;
    setQuery('');
    setResults(null);
    setSearching(false);
    setActive(0);
    // focus after paint so the element exists
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [paletteOpen]);

  // ── Debounced search (200ms). Empty query → recent notes (handled below). ─
  useEffect(() => {
    if (!paletteOpen) return;
    const q = query.trim();
    if (!q) { setResults(null); setSearching(false); return; }
    if (!teamId) { setResults([]); setSearching(false); return; }
    setSearching(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const hits = await searchNotes(supabase, teamId, q);
        if (!cancelled) setResults(hits);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, teamId, paletteOpen]);

  const q = query.trim().toLowerCase();

  // NOTES group: search hits when querying, else the 6 most-recent notes.
  const noteHits = useMemo<Note[]>(() => {
    if (!q) return notes.slice(0, 6);
    return (results ?? []).slice(0, 6);
  }, [q, notes, results]);

  // ── Quick action definitions + their handlers ─────────────────────────
  const runCreateNote = useCallback(async () => {
    closePalette();
    if (!firstSpaceId) { showToast('Create a space first to add a note.', 'info'); return; }
    const note = await createNote(firstSpaceId);
    if (note) router.push('/notes/' + note.id);
    else showToast('Could not create note.', 'error');
  }, [closePalette, firstSpaceId, createNote, router, showToast]);

  // Target note for note-scoped actions: the open note, else the most recent.
  const targetNoteId = currentNoteId
    || (typeof router.query.note === 'string' ? router.query.note : undefined)
    || notes[0]?.id;

  const runInvite = useCallback(() => {
    closePalette();
    if (!targetNoteId) { showToast('Create a note first, then invite a teammate.', 'info'); return; }
    router.push(`/notes/${targetNoteId}?share=1`); // EditorPane opens the Share panel
  }, [closePalette, targetNoteId, router, showToast]);

  const runDashboard = useCallback(() => {
    closePalette();
    router.push('/');
  }, [closePalette, router]);

  const runUpload = useCallback(() => {
    closePalette();
    if (!targetNoteId) { showToast('Create a note first to upload an image.', 'info'); return; }
    router.push(`/notes/${targetNoteId}?upload=1`); // EditorPane triggers the image picker
  }, [closePalette, targetNoteId, router, showToast]);

  const actionDefs = useMemo<ActionDef[]>(() => [
    { id: 'new', label: 'Create a new note', pathD: PATH_NEW, hotkey: 'N', run: runCreateNote },
    { id: 'invite', label: 'Invite a teammate', pathD: PATH_INVITE, run: runInvite },
    { id: 'dashboard', label: 'Go to Dashboard', pathD: PATH_DASHBOARD, run: runDashboard },
    { id: 'upload', label: 'Upload an image to this note', pathD: PATH_UPLOAD, run: runUpload },
  ], [runCreateNote, runInvite, runDashboard, runUpload]);

  // Quick actions filtered by label (mirrors reference logic).
  const actionHits = useMemo<ActionDef[]>(
    () => actionDefs.filter((a) => !q || a.label.toLowerCase().includes(q)),
    [actionDefs, q],
  );

  // ── Flattened navigable list (notes first, then actions) ──────────────
  const rows = useMemo<Row[]>(() => {
    const noteRows: Row[] = noteHits.map((n) => ({
      kind: 'note',
      key: 'note:' + n.id,
      note: n,
      run: () => { router.push('/notes/' + n.id); closePalette(); },
    }));
    const actionRows: Row[] = actionHits.map((a) => ({
      kind: 'action',
      key: 'action:' + a.id,
      action: a,
      run: a.run,
    }));
    return [...noteRows, ...actionRows];
  }, [noteHits, actionHits, router, closePalette]);

  const showSkeleton = !!q && searching && results === null;
  const noResults = !showSkeleton && rows.length === 0;

  // Keep the active index in range as the list changes.
  useEffect(() => {
    setActive((i) => (rows.length ? Math.min(i, rows.length - 1) : 0));
  }, [rows.length]);

  // Scroll the active row into view.
  useEffect(() => {
    rowRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // ── Keyboard: ↑/↓ move, Enter run, Esc close. (Esc also handled globally.)
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      rows[active]?.run();
    }
  }, [rows, active, closePalette]);

  if (!paletteOpen) return null;

  const hasNoteResults = noteHits.length > 0 || showSkeleton;
  const hasActionResults = actionHits.length > 0;

  return (
    <div
      onMouseDown={closePalette}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(4,6,11,0.6)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '13vh',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: 'min(640px,92vw)', maxHeight: '62vh',
          display: 'flex', flexDirection: 'column',
          borderRadius: 18, overflow: 'hidden',
          animation: 'cbUp .18s ease',
          background: 'linear-gradient(180deg,rgba(26,32,44,0.92),rgba(16,20,30,0.92))',
          backdropFilter: 'blur(40px) saturate(170%)', WebkitBackdropFilter: 'blur(40px) saturate(170%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 40px 100px -30px rgba(0,0,0,0.9),inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Search input row */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#6ea8fe" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, spaces, people or run a command…"
            aria-label="Search notes, spaces, people or run a command"
            aria-controls="cb-palette-results"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#eef2f8', fontSize: 15, fontFamily: "'Manrope',sans-serif",
            }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: 10, padding: '3px 7px', borderRadius: 6,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)',
              color: '#9aa6ba',
            }}
          >
            ESC
          </span>
        </div>

        {/* Results */}
        <div
          id="cb-palette-results"
          ref={listRef}
          role="listbox"
          aria-label="Results"
          style={{ flex: 1, overflowY: 'auto', padding: 8 }}
        >
          {hasNoteResults && (
            <>
              <div
                className="font-mono"
                style={{ fontSize: 10, letterSpacing: '0.1em', color: '#6f7c92', padding: '8px 12px 5px' }}
              >
                NOTES
              </div>
              {showSkeleton ? (
                <div style={{ padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-5/6" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
              ) : (
                noteHits.map((n) => {
                  const rowIndex = rows.findIndex((r) => r.kind === 'note' && r.note.id === n.id);
                  const isActive = rowIndex === active;
                  return (
                    <div
                      key={n.id}
                      ref={(el) => { rowRefs.current[rowIndex] = el; }}
                      id={'cb-palette-row-' + rowIndex}
                      role="option"
                      aria-selected={isActive}
                      tabIndex={-1}
                      onMouseEnter={() => setActive(rowIndex)}
                      onClick={() => { router.push('/notes/' + n.id); closePalette(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        minHeight: 44, padding: '10px 12px', borderRadius: 11, cursor: 'pointer',
                        background: isActive ? 'rgba(110,168,254,0.12)' : 'transparent',
                      }}
                    >
                      <div
                        style={{
                          width: 9, height: 9, borderRadius: 3, flex: '0 0 auto',
                          background: n.space?.color || '#6ea8fe',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13.5, fontWeight: 600, color: '#e7ecf3',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}
                        >
                          {n.title || 'Untitled note'}
                        </div>
                      </div>
                      <span className="font-mono" style={{ fontSize: 10, color: '#6f7c92' }}>
                        {n.space?.name || ''}
                      </span>
                    </div>
                  );
                })
              )}
            </>
          )}

          {hasActionResults && (
            <>
              <div
                className="font-mono"
                style={{ fontSize: 10, letterSpacing: '0.1em', color: '#6f7c92', padding: '12px 12px 5px' }}
              >
                QUICK ACTIONS
              </div>
              {actionHits.map((a) => {
                const rowIndex = rows.findIndex((r) => r.kind === 'action' && r.action.id === a.id);
                const isActive = rowIndex === active;
                return (
                  <div
                    key={a.id}
                    ref={(el) => { rowRefs.current[rowIndex] = el; }}
                    id={'cb-palette-row-' + rowIndex}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={-1}
                    onMouseEnter={() => setActive(rowIndex)}
                    onClick={a.run}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      minHeight: 44, padding: '10px 12px', borderRadius: 11, cursor: 'pointer',
                      background: isActive ? 'rgba(110,168,254,0.12)' : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        width: 26, height: 26, borderRadius: 8, flex: '0 0 auto',
                        display: 'grid', placeItems: 'center',
                        color: '#6ea8fe', background: 'rgba(110,168,254,0.14)',
                      }}
                    >
                      <ActionIcon d={a.pathD} />
                    </div>
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#e7ecf3' }}>{a.label}</div>
                    {a.hotkey && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 6,
                          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)',
                          color: '#9aa6ba',
                        }}
                      >
                        {a.hotkey}
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {noResults && (
            <div style={{ padding: 34, textAlign: 'center', fontSize: 13, color: '#6f7c92' }}>
              No matches for “{query.trim()}”
            </div>
          )}
        </div>

        {/* Footer kbd hints */}
        <div
          className="font-mono"
          style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)',
            fontSize: 10, color: '#6f7c92',
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span style={{ marginLeft: 'auto' }}>CheatBook search</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
