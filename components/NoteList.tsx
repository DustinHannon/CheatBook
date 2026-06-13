import React from 'react';
import type { Note, Scope, FilterChip } from '../lib/types';
import { useApp } from './AppContext';
import { NoteCard } from './NoteCard';

interface NoteListProps {
  scope: Scope;
  notes: Note[];
  selectedId?: string;
  onSelect: (id: string) => void;
  activeChip: FilterChip;
  onChip: (c: FilterChip) => void;
  onNew: () => void;
  sort: 'updated' | 'title';
  onToggleSort: () => void;
}

const CHIP_DEFS: { id: FilterChip; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'starred', label: 'Starred' },
  { id: 'runbooks', label: 'Runbooks' },
];

function titleFor(scope: Scope): string {
  if (scope === 'shared') return 'Shared with me';
  if (scope === 'starred') return 'Starred';
  return 'All Notes';
}
function subtitleFor(scope: Scope): string {
  if (scope === 'shared') return 'Notes teammates have shared with you';
  if (scope === 'starred') return 'Notes you’ve bookmarked for quick recall';
  return '';
}
function emptyFor(scope: Scope): string {
  if (scope === 'starred') return 'No starred notes yet — tap the star on any note to pin it here.';
  if (scope === 'shared') return 'Nothing shared with you yet.';
  return 'No notes match this filter.';
}

/**
 * Workspace list pane. Markup lifted verbatim from the note-list block in
 * designideas/design-references/CheatBook.dc.html (lines 164–231): dynamic
 * header (title + count, sort glyph, New button), single-select filter chips
 * (scope=all only), scope subtitle, scrollable NoteCard list, empty states.
 */
export const NoteList: React.FC<NoteListProps> = ({
  scope, notes, selectedId, onSelect, activeChip, onChip, onNew, sort, onToggleSort,
}) => {
  const { openNav } = useApp();

  const title = titleFor(scope);
  const subtitle = subtitleFor(scope);
  const showChips = scope === 'all';
  const isEmpty = notes.length === 0;

  return (
    <section className="cb-panel relative flex min-h-0 flex-col" style={{ borderRadius: 20 }}>
      {/* header */}
      <div style={{ padding: '18px 18px 12px' }}>
        <div className="flex items-center gap-[10px]">
          {/* mobile hamburger */}
          <button
            type="button"
            onClick={openNav}
            aria-label="Open navigation"
            className="grid flex-none cursor-pointer place-items-center border border-white/[0.08] text-text-2 hover:bg-white/[0.06] md:hidden"
            style={{ width: 32, height: 32, minWidth: 44, minHeight: 44, borderRadius: 9 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <h2 className="m-0 font-extrabold" style={{ fontSize: 18, letterSpacing: '-0.02em' }}>{title}</h2>
          <span className="mt-[2px] font-mono text-text-4" style={{ fontSize: 11 }}>{notes.length} notes</span>
          <div className="ml-auto flex gap-[6px]">
            <button
              type="button"
              onClick={onToggleSort}
              aria-label={sort === 'title' ? 'Sorted A–Z — click to sort by recently updated' : 'Sorted by recently updated — click to sort A–Z'}
              title={sort === 'title' ? 'Sorted A–Z' : 'Sorted by recently updated'}
              className="grid cursor-pointer place-items-center border border-white/[0.07] hover:bg-white/[0.05] hover:text-text-1"
              style={{ width: 30, height: 30, borderRadius: 9, color: sort === 'title' ? 'var(--accent)' : '#8b97ab' }}
            >
              {sort === 'title' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h10M5 12h7M5 17h4M16 7v10M16 17l3-3M16 17l-3-3" /></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              )}
            </button>
            <button
              type="button"
              onClick={onNew}
              aria-label="New note"
              className="flex cursor-pointer items-center gap-[7px] font-bold hover:brightness-[1.07]"
              style={{
                height: 30, minHeight: 44, padding: '0 12px', borderRadius: 9, fontSize: 12.5,
                color: '#0a0f1a', background: 'linear-gradient(160deg,#7db0ff,#6ea8fe)',
                boxShadow: '0 6px 16px -6px rgba(110,168,254,0.8)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0f1a" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>New
            </button>
          </div>
        </div>

        {/* filter chips — All Notes scope only, single-select */}
        {showChips && (
          <div className="mt-[14px] flex gap-[7px]" role="group" aria-label="Filter notes">
            {CHIP_DEFS.map((c) => {
              const on = activeChip === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChip(c.id)}
                  className="cursor-pointer whitespace-nowrap font-semibold hover:brightness-[1.15]"
                  style={{
                    padding: '6px 12px', borderRadius: 9, fontSize: 12,
                    color: on ? '#0a0f1a' : '#aeb9ca',
                    background: on ? '#6ea8fe' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${on ? '#6ea8fe' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        {subtitle && (
          <div className="mt-[12px] text-text-3" style={{ fontSize: 12 }}>{subtitle}</div>
        )}
      </div>

      {/* scrollable list */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{ padding: '4px 12px 12px', gap: 'var(--density-list-gap)' }}
      >
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-[14px] text-center" style={{ padding: '48px 30px' }}>
            <div
              className="grid place-items-center border border-white/[0.08] bg-white/[0.04] text-text-4"
              style={{ width: 54, height: 54, borderRadius: 16 }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" /></svg>
            </div>
            <div className="text-text-3" style={{ fontSize: 13, maxWidth: 240, lineHeight: 1.5 }}>{emptyFor(scope)}</div>
          </div>
        ) : (
          <>
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                selected={note.id === selectedId}
                onSelect={() => onSelect(note.id)}
              />
            ))}
            <div className="font-mono" style={{ textAlign: 'center', padding: '14px 0 4px', fontSize: 10.5, color: '#5d6a7e' }}>
              — end of {notes.length} notes —
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default NoteList;
