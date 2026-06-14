import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import type { Scope, FilterChip, Note } from '../lib/types';
import { RUNBOOK_SPACE_NAMES } from '../lib/types';
import { useApp } from './AppContext';
import { useToast } from './Toast';
import { NoteList } from './NoteList';
import { Skeleton } from './ui/Skeleton';

// The editor (TipTap + Yjs + lowlight) is the heaviest chunk in the app. Load it
// lazily so the notes LIST route doesn't ship it; NoteCard prefetches it on hover
// so opening a note stays instant. Client-only (ssr:false) — it already is.
const EditorPane = dynamic(() => import('./EditorPane').then((m) => m.EditorPane), {
  ssr: false,
  loading: () => (
    <section className="cb-panel flex min-h-0 flex-col items-center justify-center" style={{ borderRadius: 20, padding: 40 }} aria-busy="true">
      <div className="text-sm text-text-3">Opening note…</div>
    </section>
  ),
});

interface WorkspaceProps {
  scope: Scope;
  selectedNoteId?: string;
}

const FILTER_CHIPS: FilterChip[] = ['all', 'pinned', 'starred', 'runbooks'];

function parseChip(v: string | string[] | undefined): FilterChip {
  const s = Array.isArray(v) ? v[0] : v;
  return (FILTER_CHIPS as string[]).includes(s ?? '') ? (s as FilterChip) : 'all';
}
function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Three-pane workspace orchestrator. Derives the scoped + chip-filtered +
 * space-filtered note list: scope base (all|starred), chips apply only within
 * `all`, ?space= composes and clears the chip, pinned floated to top for `all`.
 * Reads/writes ?filter= and ?space= via shallow routing. Responsive grid:
 * desktop 362px/1fr, tablet 300px/1fr, mobile single-pane by selection.
 */
export const Workspace: React.FC<WorkspaceProps> = ({ scope, selectedNoteId }) => {
  const router = useRouter();
  const { loading, notes, createNote, spaces } = useApp();
  const { showToast } = useToast();

  const activeChip = scope === 'all' ? parseChip(router.query.filter) : 'all';
  const spaceFilter = firstParam(router.query.space);
  // Persist the sort choice so it survives the remount when switching scope
  // (all/starred are separate routes — local state would reset otherwise).
  const [sortKey, setSortKey] = useState<'updated' | 'title'>('updated');
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('cb-note-sort');
      if (saved === 'title' || saved === 'updated') setSortKey(saved);
    } catch { /* private mode */ }
  }, []);
  const toggleSort = useCallback(() => {
    setSortKey((k) => {
      const next = k === 'updated' ? 'title' : 'updated';
      try { window.localStorage.setItem('cb-note-sort', next); } catch { /* private mode */ }
      return next;
    });
  }, []);

  // ── Derived list (mirrors reference renderVals) ─────────────────────
  const visibleNotes = useMemo<Note[]>(() => {
    // scope base
    let base = notes;
    if (scope === 'starred') {
      base = notes.filter((n) => n.starredByMe);
    }

    // ?space= composes (clears chip — handled in selectChip)
    if (spaceFilter) base = base.filter((n) => n.spaceId === spaceFilter);

    // chips apply only within All Notes scope
    if (scope === 'all' && !spaceFilter) {
      if (activeChip === 'pinned') base = base.filter((n) => n.pinned);
      else if (activeChip === 'starred') base = base.filter((n) => n.starredByMe);
      else if (activeChip === 'runbooks') base = base.filter((n) => !!n.space && RUNBOOK_SPACE_NAMES.includes(n.space.name));
    }

    // Float pinned to top for `all`; then order by the chosen sort key.
    return [...base].sort((a, b) => {
      if (scope === 'all' && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sortKey === 'title') return (a.title || '').localeCompare(b.title || '');
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [notes, scope, spaceFilter, activeChip, sortKey]);

  // /starred has no [id] route, so selection rides a ?note= query param there;
  // /notes uses the [id] segment (selectedNoteId prop).
  const effectiveSelectedId = selectedNoteId ?? firstParam(router.query.note);
  const selectedNote = useMemo(
    () => (effectiveSelectedId ? notes.find((n) => n.id === effectiveSelectedId) : undefined),
    [notes, effectiveSelectedId],
  );

  // ── Responsive panes (mobile shows one at a time) ───────────────────
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 759px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const showEditor = !!selectedNote;
  const showListPane = !isMobile || !showEditor;
  const showEditorPane = !isMobile || showEditor;

  // ── Selection / navigation ──────────────────────────────────────────
  const basePath = scope === 'starred' ? '/starred' : '/notes';

  const onSelect = useCallback((id: string) => {
    // Carry the active space/filter context, and keep starred in-scope.
    const carry: Record<string, string> = {};
    if (spaceFilter) carry.space = spaceFilter;
    if (activeChip !== 'all') carry.filter = activeChip;
    if (scope === 'all') {
      router.push({ pathname: `/notes/${id}`, query: carry }, undefined, { shallow: true });
    } else {
      router.push({ pathname: basePath, query: { ...carry, note: id } }, undefined, { shallow: true });
    }
  }, [router, scope, basePath, spaceFilter, activeChip]);

  const onChip = useCallback((c: FilterChip) => {
    const query: Record<string, string> = {};
    if (c !== 'all') query.filter = c;
    // selecting a chip clears any space filter (single dimension at a time)
    router.push({ pathname: basePath, query }, undefined, { shallow: true });
  }, [router, basePath]);

  const onNew = useCallback(async () => {
    const targetSpace = spaceFilter || spaces[0]?.id;
    if (!targetSpace) { showToast('Create a space first.', 'info'); return; }
    const note = await createNote(targetSpace);
    if (note) router.push(`/notes/${note.id}`, undefined, { shallow: true });
    else showToast('Could not create note.', 'error');
  }, [spaceFilter, spaces, createNote, router, showToast]);

  // ── Loading skeleton ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid h-full min-h-0 w-full gap-3" style={{ gridTemplateColumns: 'var(--ws-cols)' }}>
        <WorkspaceGridVars />
        <section className="cb-panel flex min-h-0 flex-col gap-3 p-4" style={{ borderRadius: 20 }} aria-busy="true">
          <Skeleton className="h-7 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-14" /><Skeleton className="h-8 w-16" /><Skeleton className="h-8 w-16" />
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </section>
        <section className="cb-panel hidden min-h-0 flex-col gap-4 p-6 md:flex" style={{ borderRadius: 20 }} aria-busy="true">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 w-full gap-3" style={{ gridTemplateColumns: showEditorPane && showListPane ? 'var(--ws-cols)' : '1fr' }}>
      <WorkspaceGridVars />
      {showListPane && (
        <NoteList
          scope={scope}
          notes={visibleNotes}
          selectedId={effectiveSelectedId}
          onSelect={onSelect}
          activeChip={activeChip}
          onChip={onChip}
          onNew={() => void onNew()}
          sort={sortKey}
          onToggleSort={toggleSort}
        />
      )}
      {showEditorPane && (
        selectedNote ? (
          <EditorPane
            key={selectedNote.id}
            note={selectedNote}
            onBack={() => router.push(basePath, undefined, { shallow: true })}
          />
        ) : (
          !isMobile && <EmptyEditor />
        )
      )}
    </div>
  );
};

/** Injects responsive `--ws-cols` (desktop 362px/tablet 300px) for the grid. */
const WorkspaceGridVars: React.FC = () => (
  <style jsx global>{`
    :root { --ws-cols: 362px 1fr; }
    @media (max-width: 1139px) { :root { --ws-cols: 300px 1fr; } }
    @media (max-width: 759px) { :root { --ws-cols: 1fr; } }
  `}</style>
);

/** Placeholder shown in the editor column when no note is selected (desktop). */
const EmptyEditor: React.FC = () => (
  <section className="cb-panel flex min-h-0 flex-col items-center justify-center gap-[14px] text-center" style={{ borderRadius: 20, padding: 40 }}>
    <div
      className="grid place-items-center border border-hairline bg-hover text-text-4"
      style={{ width: 60, height: 60, borderRadius: 18 }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
    </div>
    <div className="text-text-3" style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.5 }}>
      Select a note from the list to open it, or hit <span className="font-mono text-text-2">New</span> to start one.
    </div>
  </section>
);

export default Workspace;
