import React, { useCallback } from 'react';
import type { Note } from '../lib/types';
import { useApp } from './AppContext';
import { hexa } from '../lib/colors';
import { relativeTime } from '../lib/time';
import { Avatar } from './ui/Avatar';

interface NoteCardProps {
  note: Note;
  selected: boolean;
  onSelect: () => void;
}

const STAR_AMBER = 'var(--warning)';

/**
 * One note in the workspace list. Markup lifted verbatim from the note-card
 * block in designideas/design-references/CheatBook.dc.html (lines 194–220):
 * space badge, pin glyph, relative time, star toggle, title, 2-line snippet,
 * contributor avatar stack, image/attachment indicators. Selected → accent-soft
 * wash + glowing left accent bar.
 */
export const NoteCard: React.FC<NoteCardProps> = ({ note, selected, onSelect }) => {
  const { toggleStar, memberById } = useApp();

  const spaceColor = note.space?.color || '#6ea8fe';
  const spaceUpper = (note.space?.name || 'Notes').toUpperCase();
  const spaceBg = hexa(spaceColor, 0.14);
  const updated = relativeTime(note.updatedAt);

  // Up to 3 contributor avatars (owner first per the api mapping order).
  const contributors = note.collaboratorIds
    .map((id) => memberById(id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .slice(0, 3);

  const onToggleStar = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void toggleStar(note.id);
    },
    [toggleStar, note.id],
  );

  const onStarKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        void toggleStar(note.id);
      }
    },
    [toggleStar, note.id],
  );

  const onCardKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
    },
    [onSelect],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      aria-label={note.title}
      onClick={onSelect}
      onKeyDown={onCardKey}
      className="group relative flex-none cursor-pointer overflow-hidden border border-hairline bg-hover transition hover:border-strong hover:bg-hover-2"
      style={{ padding: '13px 14px', borderRadius: 14 }}
    >
      {selected && (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ borderRadius: 14, background: 'var(--accent-soft)', border: '1px solid rgba(110,168,254,0.45)' }}
          />
          <div
            className="pointer-events-none absolute"
            style={{
              left: 0, top: 14, bottom: 14, width: 3, borderRadius: '0 3px 3px 0',
              background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)',
            }}
          />
        </>
      )}

      <div className="relative">
        {/* meta row: space badge · pin · time · star */}
        <div className="mb-[7px] flex items-center gap-2">
          <span
            className="inline-flex items-center gap-[5px] font-mono font-semibold"
            style={{ fontSize: 9.5, letterSpacing: '0.04em', padding: '3px 7px', borderRadius: 6, color: spaceColor, background: spaceBg }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: spaceColor }} />
            {spaceUpper}
          </span>
          {note.pinned && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill={spaceColor} stroke="none" aria-label="Pinned">
              <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z" />
            </svg>
          )}
          <span className="ml-auto font-mono text-text-4" style={{ fontSize: 10 }}>{updated}</span>
          <div
            role="button"
            tabIndex={0}
            aria-pressed={note.starredByMe}
            aria-label={note.starredByMe ? 'Unstar note' : 'Star note'}
            onClick={onToggleStar}
            onKeyDown={onStarKey}
            className="grid cursor-pointer place-items-center rounded-[7px] hover:bg-hover-2"
            style={{ width: 24, height: 24 }}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill={note.starredByMe ? STAR_AMBER : 'none'}
              stroke={note.starredByMe ? STAR_AMBER : 'var(--text-4)'}
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" />
            </svg>
          </div>
        </div>

        {/* title */}
        <div
          className="mb-[5px] font-bold text-text-1"
          style={{ fontSize: 14.5, letterSpacing: '-0.01em', lineHeight: 1.25 }}
        >
          {note.title || 'Untitled note'}
        </div>

        {/* 2-line snippet */}
        <div
          className="overflow-hidden text-text-3"
          style={{
            fontSize: 12, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}
        >
          {note.snippet}
        </div>

        {/* footer: contributor stack + indicators */}
        <div className="mt-[11px] flex items-center gap-[10px]">
          <div className="flex items-center">
            {contributors.map((m, i) => (
              <div
                key={m.id}
                title={m.name}
                style={{ marginRight: -7, borderRadius: '50%', border: '1.5px solid var(--surface-raised)', zIndex: contributors.length - i }}
              >
                <Avatar name={m.name} color={m.color} avatarUrl={m.avatarUrl} size={22} ring={false} />
              </div>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-[9px] text-text-4">
            {note.hasImage && (
              <span className="inline-flex items-center gap-[3px]" style={{ fontSize: 10.5 }} title="Has image">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="4" width="18" height="16" rx="2.5" />
                  <circle cx="8.5" cy="9.5" r="1.6" />
                  <path d="M21 16l-5-5L5 20" />
                </svg>
              </span>
            )}
            {note.attachmentCount > 0 && (
              <span
                className="inline-flex items-center gap-[3px] font-mono"
                style={{ fontSize: 10.5 }}
                title={`${note.attachmentCount} attachment${note.attachmentCount === 1 ? '' : 's'}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M21 11l-8.4 8.4a4 4 0 0 1-5.7-5.7L15 5.7a2.7 2.7 0 0 1 3.8 3.8l-8.3 8.3a1.3 1.3 0 0 1-1.9-1.9l7.6-7.6" />
                </svg>
                {note.attachmentCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteCard;
