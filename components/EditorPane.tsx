import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '../lib/router-compat';
import type { Note, Attachment, ActivityEvent } from '../lib/types';
import { useApp } from './AppContext';
import { useToast } from './Toast';
import { hexa, avatarTokens, initials } from '../lib/colors';
import { relativeTime, fileSize } from '../lib/time';
import { docToMarkdown } from '../lib/blocks';
import { createClient } from '../lib/supabase/client';
import {
  updateNoteMeta, duplicateNote, getActivity, setLocked,
  getAttachments, uploadAttachment, deleteAttachment, safeFileHref, getNoteBody,
} from '../lib/api';
import { NoteEditor, type EditorPeer } from './NoteEditor';
import { ConfirmDialog } from './ConfirmDialog';

const supabase = createClient();

interface EditorPaneProps {
  note: Note;
  /** Scope-aware "back to list" for the mobile single-pane layout. */
  onBack?: () => void;
}

type OverflowAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onRun: () => void;
};

const ico = (d: string, fill = 'none', sw = '1.8') => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={fill} stroke={fill === 'none' ? 'currentColor' : 'none'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d.split('|').map((p, i) => <path key={i} d={p} />)}
  </svg>
);

/**
 * Editor pane. Toolbar markup (breadcrumb, live presence, star, overflow)
 * lifted from designideas/design-references/CheatBook.dc.html (lines 240–266);
 * body eyebrow/title/tags from lines 381–390; attachments from lines 364–376.
 * All overflow actions are fully wired against lib/api.
 */
export const EditorPane: React.FC<EditorPaneProps> = ({ note, onBack }) => {
  const router = useRouter();
  const { me, setPinned, toggleStar, refreshNotes, refreshSpaces, deleteNote, moveNote, spaces } = useApp();
  const { showToast } = useToast();
  const attachInputRef = useRef<HTMLInputElement>(null);

  const spaceColor = note.space?.color || '#6ea8fe';
  const spaceName = note.space?.name || 'Notes';
  const spaceUpper = spaceName.toUpperCase();

  // ── Live editing peers (fed by NoteEditor) ──────────────────────────
  const [peers, setPeers] = useState<EditorPeer[]>([]);

  // ── Lazy-loaded note body ───────────────────────────────────────────
  // The notes list omits `body` to keep its payload small; fetch the real doc
  // for the OPEN note here, BEFORE NoteEditor mounts, so the Yjs seeding gate
  // always sees a real body. Critical invariant: never mount the editor with a
  // missing/empty body for a note that actually has content — an empty seed would
  // be snapshotted back and clobber it. On error we show a message, not the editor.
  const [bodyDoc, setBodyDoc] = useState<Note['body']>(null);
  const [bodyError, setBodyError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setBodyDoc(null);
    setBodyError(false);
    getNoteBody(supabase, note.id)
      .then((b) => { if (!cancelled) setBodyDoc(b); })
      .catch(() => { if (!cancelled) setBodyError(true); });
    return () => { cancelled = true; };
  }, [note.id]);

  // ── Overlays ────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [imageNonce, setImageNonce] = useState(0);

  // Command-palette bridge: ?upload=1 triggers the image picker, then strips
  // its param after handling.
  useEffect(() => {
    if (router.query.upload !== '1') return;
    setImageNonce((n) => n + 1);
    const rest = { ...router.query };
    delete rest.upload;
    void router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.upload]);

  // ── Editable title (uncontrolled-ish: blur commits) ─────────────────
  const [title, setTitle] = useState(note.title);
  useEffect(() => { setTitle(note.title); }, [note.id, note.title]);

  // The title is a textarea (not an input) so long titles WRAP instead of being
  // clipped; grow its height to fit the wrapped lines.
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = titleRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [title]);

  const commitTitle = useCallback(async () => {
    const next = title.trim() || 'Untitled note';
    if (next === note.title) return;
    try {
      await updateNoteMeta(supabase, note.id, { title: next });
      void refreshNotes();
    } catch {
      showToast('Could not rename note.', 'error');
      setTitle(note.title);
    }
  }, [title, note.id, note.title, refreshNotes, showToast]);

  // ── Editable tags ───────────────────────────────────────────────────
  const [tags, setTags] = useState<string[]>(note.tags);
  const [tagDraft, setTagDraft] = useState('');
  useEffect(() => { setTags(note.tags); }, [note.id, note.tags]);

  const persistTags = useCallback(async (next: string[]) => {
    setTags(next);
    try {
      await updateNoteMeta(supabase, note.id, { tags: next });
      void refreshNotes();
    } catch {
      showToast('Could not update tags.', 'error');
      setTags(note.tags);
    }
  }, [note.id, note.tags, refreshNotes, showToast]);

  const addTag = useCallback(() => {
    const raw = tagDraft.trim().replace(/^#+/, '');
    if (!raw) return;
    const tag = `#${raw}`;
    if (tags.includes(tag)) { setTagDraft(''); return; }
    void persistTags([...tags, tag]);
    setTagDraft('');
  }, [tagDraft, tags, persistTags]);

  const removeTag = useCallback((tag: string) => {
    void persistTags(tags.filter((t) => t !== tag));
  }, [tags, persistTags]);

  // ── Overflow menu (click-out + Esc + focus trap) ────────────────────
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (menuBtnRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setMenuOpen(false); menuBtnRef.current?.focus(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []);
      if (!items.length) return;
      e.preventDefault();
      const idx = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === 'Home' ? 0
        : e.key === 'End' ? items.length - 1
        : e.key === 'ArrowDown' ? (idx < 0 ? 0 : (idx + 1) % items.length)
        : (idx <= 0 ? items.length - 1 : idx - 1);
      items[next]?.focus();
    };
    const id = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}/notes/${note.id}`;
    navigator.clipboard?.writeText(url).then(
      () => showToast('Link copied to clipboard.', 'success'),
      () => showToast('Could not copy link.', 'error'),
    );
  }, [note.id, showToast]);

  const doDuplicate = useCallback(async () => {
    try {
      const copy = await duplicateNote(supabase, note.id);
      void refreshNotes();
      void refreshSpaces();
      showToast('Note duplicated.', 'success');
      router.push(`/notes/${copy.id}`);
    } catch {
      showToast('Could not duplicate note.', 'error');
    }
  }, [note.id, refreshNotes, refreshSpaces, router, showToast]);

  const doExport = useCallback(async () => {
    try {
      // Use the already-loaded body when present; otherwise fetch it on demand
      // (export can be triggered from the list before the editor mounts).
      const body = bodyDoc ?? await getNoteBody(supabase, note.id);
      const md = docToMarkdown(body, note.title);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(note.title || 'note').replace(/[^\w.-]+/g, '-').toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Could not export note.', 'error');
    }
  }, [bodyDoc, note.id, note.title, showToast]);

  const doMove = useCallback(async (spaceId: string) => {
    setMoveOpen(false);
    const ok = await moveNote(note.id, spaceId);
    showToast(ok ? 'Note moved.' : 'Could not move note.', ok ? 'success' : 'error');
  }, [note.id, moveNote, showToast]);

  const doLock = useCallback(async () => {
    setMenuOpen(false);
    try {
      await setLocked(supabase, note.id, !note.isLocked);
      void refreshNotes();
      showToast(note.isLocked ? 'Note unlocked.' : 'Note locked — editing disabled for everyone.', 'success');
    } catch {
      showToast('Could not change the lock state.', 'error');
    }
  }, [note.id, note.isLocked, refreshNotes, showToast]);

  const doDelete = useCallback(async () => {
    setDeleteOpen(false);
    const ok = await deleteNote(note.id);
    if (ok) { showToast('Note deleted.', 'success'); router.push('/notes'); }
    else showToast('Could not delete note.', 'error');
  }, [note.id, deleteNote, router, showToast]);

  const actions: OverflowAction[] = [
    {
      key: 'pin', label: note.pinned ? 'Unpin note' : 'Pin note',
      icon: ico('M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z', note.pinned ? 'currentColor' : 'none'),
      onRun: () => { setMenuOpen(false); void setPinned(note.id, !note.pinned); },
    },
    {
      key: 'lock', label: note.isLocked ? 'Unlock note' : 'Lock note',
      icon: ico(note.isLocked ? 'M7 11h10v9H7z|M9 11V8a3 3 0 0 1 6 0' : 'M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4'),
      onRun: () => { void doLock(); },
    },
    {
      key: 'copy', label: 'Copy link',
      icon: ico('M9 9h11v11H9z|M5 15V5a2 2 0 0 1 2-2h8'),
      onRun: () => { setMenuOpen(false); copyLink(); },
    },
    {
      key: 'move', label: 'Move to space…',
      icon: ico('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
      onRun: () => { setMenuOpen(false); setMoveOpen(true); },
    },
    {
      key: 'dup', label: 'Duplicate',
      icon: ico('M9 9h11v11H9z|M5 15V5a2 2 0 0 1 2-2h8'),
      onRun: () => { setMenuOpen(false); void doDuplicate(); },
    },
    {
      key: 'export', label: 'Export as Markdown',
      icon: ico('M12 3v12M7 11l5 4 5-4M5 21h14'),
      onRun: () => { setMenuOpen(false); doExport(); },
    },
    {
      key: 'history', label: 'Version history',
      icon: ico('M12 8v4l3 2|M3 12a9 9 0 1 0 9-9 9 9 0 0 0-8 5M3 3v5h5'),
      onRun: () => { setMenuOpen(false); setHistoryOpen(true); },
    },
    {
      key: 'delete', label: 'Delete note', danger: true,
      icon: ico('M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'),
      onRun: () => { setMenuOpen(false); setDeleteOpen(true); },
    },
  ];

  return (
    <section className="cb-panel relative flex min-h-0 flex-col" style={{ borderRadius: 20 }}>
      {/* ── toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-hairline" style={{ padding: '14px 18px' }}>
        {/* mobile back to list */}
        <button
          type="button"
          onClick={() => (onBack ? onBack() : router.push('/notes'))}
          aria-label="Back to notes"
          className="grid flex-none cursor-pointer place-items-center border border-hairline text-text-2 hover:bg-hover md:hidden"
          style={{ width: 32, height: 32, minWidth: 44, minHeight: 44, borderRadius: 9 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>

        {/* breadcrumb */}
        <div className="flex min-w-0 items-center gap-[7px] text-text-3" style={{ fontSize: 12 }}>
          <span className="inline-flex items-center gap-[5px] font-mono" style={{ fontSize: 10, color: spaceColor }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: spaceColor }} />
            {spaceName}
          </span>
          <span style={{ color: 'var(--text-4)' }}>/</span>
          <span className="overflow-hidden font-semibold text-text-2" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{note.title || 'Untitled note'}</span>
        </div>

        {/* right cluster */}
        <div className="ml-auto flex items-center gap-[13px]">
          {/* live editing presence */}
          {peers.length > 0 && (
            <>
              <div className="flex items-center">
                {peers.slice(0, 3).map((p) => {
                  const t = avatarTokens(p.color);
                  const init = initials(p.name);
                  return (
                    <div
                      key={p.id}
                      title={p.name}
                      className="grid place-items-center rounded-full font-mono font-bold"
                      style={{
                        width: 28, height: 28, marginRight: -8, fontSize: 10,
                        color: t.color, background: t.bg, border: '2px solid var(--surface-raised)', boxShadow: `0 0 0 1.5px ${t.ring}`,
                      }}
                    >
                      {init}
                    </div>
                  );
                })}
              </div>
              <span className="inline-flex items-center gap-[6px] font-semibold text-text-3" style={{ fontSize: 11 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', animation: 'cbPulse 1.6s infinite' }} />
                {peers.length} editing
              </span>
            </>
          )}

          {/* star toggle */}
          <button
            type="button"
            onClick={() => void toggleStar(note.id)}
            aria-pressed={note.starredByMe}
            aria-label={note.starredByMe ? 'Unstar this note' : 'Star this note'}
            title="Star this note"
            className="grid cursor-pointer place-items-center border border-hairline hover:bg-hover"
            style={{ width: 32, height: 32, minWidth: 44, minHeight: 44, borderRadius: 10 }}
          >
            <svg
              width="17" height="17" viewBox="0 0 24 24"
              fill={note.starredByMe ? 'var(--warning)' : 'none'}
              stroke={note.starredByMe ? 'var(--warning)' : 'var(--text-3)'}
              strokeWidth={note.starredByMe ? '1.6' : '1.7'} strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" />
            </svg>
          </button>

          {/* overflow */}
          <div className="relative">
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              className="grid cursor-pointer place-items-center border border-hairline text-text-3 hover:bg-hover hover:text-text-1"
              style={{ width: 32, height: 32, minWidth: 44, minHeight: 44, borderRadius: 10 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                role="menu"
                aria-label="Note actions"
                className="cb-panel absolute z-[80] animate-cb-up"
                style={{ right: 0, top: 'calc(100% + 8px)', width: 222, borderRadius: 14, padding: 6, background: 'var(--surface-raised)' }}
              >
                {actions.map((a, i) => (
                  <React.Fragment key={a.key}>
                    {a.danger && <div style={{ height: 1, margin: '6px 8px', background: 'var(--hairline)' }} />}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={a.onRun}
                      className="flex w-full cursor-pointer items-center gap-[10px] rounded-[9px] text-left hover:bg-hover"
                      style={{
                        padding: '9px 10px', minHeight: 40, fontSize: 13, fontWeight: 600,
                        color: a.danger ? 'var(--danger)' : 'var(--text-2)',
                      }}
                    >
                      <span className="grid flex-none place-items-center" style={{ width: 18, height: 18 }}>{a.icon}</span>
                      {a.label}
                      {i === 0 && note.pinned && <span className="ml-auto font-mono text-text-4" style={{ fontSize: 10 }}>on</span>}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── body ────────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div style={{ maxWidth: 740, margin: '0 auto', padding: 'var(--density-editor-pad)', position: 'relative' }}>
          {/* eyebrow: space badge + relative updated */}
          <div className="mb-[16px] flex items-center gap-[9px]">
            <span
              className="inline-flex items-center gap-[6px] font-mono font-semibold"
              style={{ fontSize: 10, padding: '4px 9px', borderRadius: 7, color: spaceColor, background: hexa(spaceColor, 0.14) }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: spaceColor }} />
              {spaceUpper}
            </span>
            <span className="font-mono text-text-4" style={{ fontSize: 10.5 }}>
              Updated {relativeTime(note.updatedAt)}{note.updatedByName ? ` by ${note.updatedByName}` : ''}
            </span>
          </div>

          {/* editable title (H1) — textarea so long titles wrap, not clip */}
          <textarea
            ref={titleRef}
            value={title}
            rows={1}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void commitTitle()}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
            aria-label="Note title"
            placeholder="Untitled note"
            disabled={note.isLocked}
            className="m-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-extrabold text-text-1 outline-none placeholder:text-text-4"
            style={{ fontSize: 34, letterSpacing: '-0.03em', lineHeight: 1.12, marginBottom: 12 }}
          />

          {/* editable tag chips */}
          <div className="mb-[26px] flex flex-wrap items-center gap-[7px]">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-[6px] font-mono text-text-3"
                style={{ fontSize: 11, padding: '3px 9px', borderRadius: 7, background: 'var(--bg-hover)', border: '1px solid var(--hairline)' }}
              >
                {tag}
                {!note.isLocked && (
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove ${tag}`}
                    className="grid place-items-center text-text-4 hover:text-text-1"
                    style={{ width: 14, height: 14 }}
                  >
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
                  </button>
                )}
              </span>
            ))}
            {!note.isLocked && (
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
                  if (e.key === 'Backspace' && !tagDraft && tags.length) removeTag(tags[tags.length - 1]);
                }}
                onBlur={addTag}
                placeholder="add tag…"
                aria-label="Add tag"
                className="font-mono text-text-3 outline-none placeholder:text-text-4"
                style={{ fontSize: 11, padding: '3px 9px', borderRadius: 7, background: 'transparent', border: '1px dashed var(--border-strong)', width: 110 }}
              />
            )}
          </div>

          {/* collaborative body — the lazy body must finish loading before the
              editor mounts so Yjs seeding sees real content (never an empty seed) */}
          {me && bodyDoc !== null ? (
            <NoteEditor
              note={{ ...note, body: bodyDoc }}
              me={me}
              editable={!note.isLocked}
              onPeersChange={setPeers}
              onAttach={note.isLocked ? undefined : () => attachInputRef.current?.click()}
              imageNonce={imageNonce}
            />
          ) : me && bodyError ? (
            <div className="px-1 py-8 text-sm text-text-3">Couldn’t load this note’s content. Refresh to try again.</div>
          ) : me ? (
            <div className="px-1 py-8 text-sm text-text-3">Loading note…</div>
          ) : null}

          {/* attachments */}
          <AttachmentsSection noteId={note.id} locked={note.isLocked} inputRef={attachInputRef} />
        </div>
      </div>

      {/* ── overlays ────────────────────────────────────────────── */}
      {moveOpen && (
        <SpacePickerDialog
          currentSpaceId={note.spaceId}
          spaces={spaces}
          onPick={doMove}
          onCancel={() => setMoveOpen(false)}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        danger
        title="Delete this note?"
        message="This permanently removes the note for everyone. This cannot be undone."
        confirmLabel="Delete note"
        onConfirm={() => void doDelete()}
        onCancel={() => setDeleteOpen(false)}
      />

      {historyOpen && (
        <VersionHistoryDialog noteId={note.id} onClose={() => setHistoryOpen(false)} />
      )}
    </section>
  );
};

// ── Space picker (Move to space…) ────────────────────────────────────
const SpacePickerDialog: React.FC<{
  currentSpaceId: string | null;
  spaces: { id: string; name: string; color: string }[];
  onPick: (id: string) => void;
  onCancel: () => void;
}> = ({ currentSpaceId, spaces, onPick, onCancel }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } };
    const id = requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[role="option"]')?.focus());
    document.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(id); document.removeEventListener('keydown', onKey); };
  }, [onCancel]);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--backdrop)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        ref={ref}
        role="listbox"
        aria-label="Move to space"
        className="animate-cb-up"
        style={{
          width: 'min(420px,92vw)', borderRadius: 18, overflow: 'hidden', padding: '22px 20px 18px',
          background: 'var(--modal-grad)',
          backdropFilter: 'blur(40px) saturate(170%)', WebkitBackdropFilter: 'blur(40px) saturate(170%)',
          border: '1px solid var(--modal-border)',
          boxShadow: 'var(--modal-shadow)',
        }}
      >
        <h2 className="m-0 font-extrabold" style={{ fontSize: 17, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>Move to space</h2>
        <div className="mt-[16px] flex max-h-[50vh] flex-col gap-[2px] overflow-y-auto">
          {spaces.map((sp) => {
            const isCurrent = sp.id === currentSpaceId;
            return (
              <button
                key={sp.id}
                role="option"
                aria-selected={isCurrent}
                type="button"
                disabled={isCurrent}
                onClick={() => onPick(sp.id)}
                className="flex w-full cursor-pointer items-center gap-[11px] rounded-[10px] text-left hover:bg-hover disabled:cursor-default disabled:opacity-50"
                style={{ padding: '10px 12px', minHeight: 44, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 3, flex: '0 0 auto', background: sp.color, boxShadow: `0 0 10px ${hexa(sp.color, 0.6)}` }} />
                <span className="flex-1">{sp.name}</span>
                {isCurrent && <span className="font-mono text-text-4" style={{ fontSize: 10 }}>current</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Version history (read-only, from activity_log filtered to this note) ──
const VersionHistoryDialog: React.FC<{ noteId: string; onClose: () => void }> = ({ noteId, onClose }) => {
  const { memberById } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getActivity(supabase, 100);
        if (cancelled) return;
        setEvents(all.filter((e) => e.targetId === noteId));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [noteId]);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--backdrop)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
        className="animate-cb-up"
        style={{
          width: 'min(460px,92vw)', borderRadius: 18, overflow: 'hidden', padding: '22px 20px 18px',
          background: 'var(--modal-grad)',
          backdropFilter: 'blur(40px) saturate(170%)', WebkitBackdropFilter: 'blur(40px) saturate(170%)',
          border: '1px solid var(--modal-border)',
          boxShadow: 'var(--modal-shadow)',
        }}
      >
        <div className="flex items-center gap-2">
          <h2 className="m-0 font-extrabold" style={{ fontSize: 17, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>Version history</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid place-items-center rounded-[8px] text-text-4 hover:bg-hover hover:text-text-1"
            style={{ width: 28, height: 28 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>

        <div className="mt-[16px] flex max-h-[55vh] flex-col gap-[2px] overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-text-3" style={{ fontSize: 13 }}>Loading history…</div>
          ) : error ? (
            <div className="py-8 text-center text-text-3" style={{ fontSize: 13 }}>Could not load version history.</div>
          ) : events.length === 0 ? (
            <div className="py-8 text-center text-text-3" style={{ fontSize: 13 }}>No recorded changes for this note yet.</div>
          ) : (
            events.map((e) => {
              const m = e.actorId ? memberById(e.actorId) : undefined;
              const color = m?.color || e.spaceColor;
              return (
                <div key={e.id} className="flex items-center gap-[11px]" style={{ padding: '9px 4px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto', background: color }} />
                  <div className="min-w-0 flex-1" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    <strong style={{ color: 'var(--text-strong)' }}>{e.actorName}</strong> {e.verb}
                  </div>
                  <span className="font-mono text-text-4" style={{ fontSize: 10.5 }}>{relativeTime(e.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ── Attachments section (lifted from reference lines 364–376) ────────
const AttachmentsSection: React.FC<{ noteId: string; locked: boolean; inputRef: React.RefObject<HTMLInputElement | null> }> = ({ noteId, locked, inputRef }) => {
  const { showToast } = useToast();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInput = inputRef;

  const reload = useCallback(async () => {
    try {
      setItems(await getAttachments(supabase, noteId));
    } catch {
      /* keep prior */
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => { setLoading(true); void reload(); }, [reload]);

  const onUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      await uploadAttachment(supabase, noteId, file);
      await reload();
      showToast('Attachment uploaded.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  }, [noteId, reload, showToast]);

  const onRemove = useCallback(async (id: string) => {
    try {
      await deleteAttachment(supabase, id);
      await reload();
    } catch {
      showToast('Could not remove attachment.', 'error');
    }
  }, [reload, showToast]);

  return (
    <div className="mt-[26px]">
      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); e.target.value = ''; }}
      />
      <div className="mb-[12px] flex items-center gap-2">
        <h2 className="m-0 font-extrabold text-text-1" style={{ fontSize: 19, letterSpacing: '-0.02em' }}>Attachments</h2>
        {!locked && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="ml-auto flex cursor-pointer items-center gap-[6px] border border-hairline font-semibold text-text-2 hover:bg-hover disabled:opacity-50"
            style={{ height: 30, minHeight: 44, padding: '0 12px', borderRadius: 9, fontSize: 12 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {uploading ? 'Uploading…' : 'Add file'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-text-3" style={{ fontSize: 13, padding: '8px 0' }}>Loading attachments…</div>
      ) : items.length === 0 ? (
        <div
          className="font-mono text-text-4"
          style={{ padding: 16, borderRadius: 13, border: '1px dashed var(--border-strong)', textAlign: 'center', fontSize: 11 }}
        >
          No attachments yet{locked ? '.' : ' — add a file to keep references with this note.'}
        </div>
      ) : (
        <div className="flex flex-col gap-[9px]">
          {items.map((att) => {
            const kind = (att.kind || att.fileName.split('.').pop() || 'FILE').toUpperCase().slice(0, 4);
            const tint = kindColor(kind);
            return (
              <div
                key={att.id}
                className="flex items-center gap-[12px] border border-hairline bg-hover"
                style={{ padding: '11px 14px', borderRadius: 12 }}
              >
                <div
                  className="grid flex-none place-items-center font-mono font-bold"
                  style={{ width: 34, height: 34, borderRadius: 9, fontSize: 9, color: tint, background: hexa(tint, 0.14) }}
                >
                  {kind}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-text-2" style={{ fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{att.fileName}</div>
                  <div className="font-mono text-text-4" style={{ fontSize: 10.5 }}>
                    {att.label ? `${att.label} · ` : ''}{fileSize(att.sizeBytes)}
                  </div>
                </div>
                <a
                  href={safeFileHref(att.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={att.fileName}
                  aria-label={`Download ${att.fileName}`}
                  className="grid place-items-center text-text-3 hover:text-text-1"
                  style={{ width: 32, height: 32, minWidth: 44, minHeight: 44 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 4 5-4M5 21h14" /></svg>
                </a>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => void onRemove(att.id)}
                    aria-label={`Remove ${att.fileName}`}
                    className="grid place-items-center text-text-4 hover:text-danger"
                    style={{ width: 32, height: 32, minWidth: 44, minHeight: 44 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const KIND_TINTS: Record<string, string> = {
  YML: '#6ea8fe', YAML: '#6ea8fe', JSON: '#6ea8fe',
  PDF: '#fb87a4', DOC: '#fb87a4', DOCX: '#fb87a4',
  PNG: '#5eead4', JPG: '#5eead4', JPEG: '#5eead4', GIF: '#5eead4', WEBP: '#5eead4',
  SH: '#fbbf72', BASH: '#fbbf72', ZIP: '#b794f6',
};
function kindColor(kind: string): string {
  return KIND_TINTS[kind] || '#8b97ab';
}

export default EditorPane;
