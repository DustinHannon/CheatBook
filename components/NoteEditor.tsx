import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor, EditorState, RichUtils, ContentState, convertToRaw, convertFromRaw, SelectionState, Modifier, ContentBlock } from 'draft-js';
import 'draft-js/dist/Draft.css';
import {
  CheckIcon,
  EllipsisHorizontalIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import UserPresence from './UserPresence';
import { useRealtime, getUserColor } from './RealtimeContext';
import { useAuth } from './AuthContext';
import { createClient } from '../lib/supabase/client';
import {
  updateNote as apiUpdateNote,
  pinNote,
  unpinNote,
  lockNote,
  unlockNote,
  hideNote,
} from '../lib/api';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabase = createClient();

interface NoteType {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  owner_id: string;
  owner_name?: string;
  notebook_id: string | null;
  version?: number;
  is_locked: boolean;
  locked_by: string | null;
  is_pinned: boolean;
  last_edited_by: string | null;
  last_edited_by_name?: string;
  categories?: Array<{ id: string; name: string; color: string }>;
}

interface ActiveUser {
  id: string;
  name: string;
  color: string;
  last_active: Date;
}

interface NoteEditorProps {
  note: NoteType | null;
  onSave?: (note: { id?: string; title: string; content: string }) => void;
  onDelete?: (noteId: string) => void;
  onShare?: (noteId: string) => void;
  onDuplicate?: (noteId: string) => void;
  readOnly?: boolean;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onSave,
  onDelete,
  onShare,
  onDuplicate,
  readOnly = false,
}) => {
  const [title, setTitle] = useState('');
  const [editorState, setEditorState] = useState(EditorState.createEmpty());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | 'saved' | 'error'>('saved');
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [docVersion, setDocVersion] = useState(1);
  const [localChanges, setLocalChanges] = useState(false);
  const [typingUsers, setTypingUsers] = useState<ActiveUser[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Enhancement state
  const [isPinned, setIsPinned] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [overrideLock, setOverrideLock] = useState(false);

  const { user } = useAuth();
  const { joinNote, leaveNote } = useRealtime();

  const editorRef = useRef<Editor>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const lastSelectionState = useRef<SelectionState | null>(null);
  const throttleRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isRemoteUpdate = useRef(false);

  // Compute effective readOnly: locked and not overridden, or prop
  const effectiveReadOnly = readOnly || (isLocked && !overrideLock);

  // Set up Supabase Realtime channel
  useEffect(() => {
    if (!note?.id || !user) return;

    const channel = joinNote(note.id, user.id, user.name);
    channelRef.current = channel;
    setIsConnected(true);

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: ActiveUser[] = [];
      for (const [, presences] of Object.entries(state)) {
        for (const presence of presences as any[]) {
          if (presence.user_id !== user.id) {
            users.push({
              id: presence.user_id,
              name: presence.user_name,
              color: presence.color,
              last_active: new Date(presence.online_at),
            });
          }
        }
      }
      setActiveUsers(users);
    });

    channel.on('broadcast', { event: 'content-change' }, (payload: any) => {
      const data = payload.payload;
      if (data.userId === user.id) return;
      try {
        isRemoteUpdate.current = true;
        const contentState = convertFromRaw(JSON.parse(data.content));
        const newEditorState = EditorState.createWithContent(contentState);
        if (lastSelectionState.current) {
          setEditorState(EditorState.forceSelection(newEditorState, lastSelectionState.current));
        } else {
          setEditorState(newEditorState);
        }
        if (data.title) setTitle(data.title);
        setDocVersion(data.version || docVersion);
        setSaveStatus('saved');
        setLocalChanges(false);
        isRemoteUpdate.current = false;
      } catch (error) {
        console.error('Error applying remote changes:', error);
        isRemoteUpdate.current = false;
      }
    });

    channel.on('broadcast', { event: 'typing-status' }, (payload: any) => {
      const data = payload.payload;
      if (data.userId === user.id) return;
      setTypingUsers(prev => {
        if (data.isTyping) {
          if (prev.find(u => u.id === data.userId)) return prev;
          return [...prev, { id: data.userId, name: data.userName, color: getUserColor(data.userId), last_active: new Date() }];
        }
        return prev.filter(u => u.id !== data.userId);
      });
    });

    channel.on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'notes', filter: `id=eq.${note.id}`,
    }, (payload: any) => {
      if (!localChanges && payload.new) {
        setDocVersion(payload.new.version || 1);
      }
    });

    return () => {
      setIsConnected(false);
      channelRef.current = null;
      leaveNote(note.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, user?.id]);

  // Initialize editor when note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      try {
        if (note.content) {
          const contentState = convertFromRaw(JSON.parse(note.content));
          setEditorState(EditorState.createWithContent(contentState));
        } else {
          setEditorState(EditorState.createEmpty());
        }
      } catch {
        setEditorState(EditorState.createWithContent(ContentState.createFromText(note.content || '')));
      }
      setDocVersion(note.version || 1);
      setSaveStatus('saved');
      setLocalChanges(false);
      setIsPinned(!!note.is_pinned);
      setIsLocked(!!note.is_locked);
      setOverrideLock(false);
    } else {
      setTitle('');
      setEditorState(EditorState.createEmpty());
      setIsPinned(false);
      setIsLocked(false);
      setOverrideLock(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  // Auto-save
  useEffect(() => {
    if (!note || effectiveReadOnly) return;
    if (saveTimer) clearTimeout(saveTimer);
    if (saveStatus === 'saved') return;
    setSaveStatus('unsaved');
    setLocalChanges(true);
    const timer = setTimeout(() => { handleSave(); }, 2000);
    setSaveTimer(timer);
    return () => { if (saveTimer) clearTimeout(saveTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, editorState]);

  // Track selection for typing indicators
  useEffect(() => {
    const selection = editorState.getSelection();
    lastSelectionState.current = selection;

    if (!channelRef.current || !note?.id || effectiveReadOnly || !user) return;
    if (throttleRef.current) clearTimeout(throttleRef.current);
    throttleRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: 'broadcast', event: 'typing-status',
        payload: { userId: user.id, userName: user.name, isTyping: saveStatus === 'unsaved' },
      });
    }, 100);
    return () => { if (throttleRef.current) clearTimeout(throttleRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorState, note?.id, saveStatus]);

  const handleKeyCommand = (command: string, editorState: EditorState) => {
    const newState = RichUtils.handleKeyCommand(editorState, command);
    if (newState) { setEditorState(newState); return 'handled'; }
    return 'not-handled';
  };

  const handleSave = async () => {
    if (!note || effectiveReadOnly) return;
    setSaveStatus('saving');
    setIsSaving(true);
    try {
      const contentState = editorState.getCurrentContent();
      const rawContent = JSON.stringify(convertToRaw(contentState));
      const updated = await apiUpdateNote(supabase, note.id, { title, content: rawContent, version: docVersion + 1 });
      channelRef.current?.send({
        type: 'broadcast', event: 'content-change',
        payload: { userId: user?.id, content: rawContent, title, version: updated.version },
      });
      if (onSave) onSave({ id: note.id, title, content: rawContent });
      setSaveStatus('saved');
      setLocalChanges(false);
      setDocVersion(updated.version || docVersion + 1);
    } catch (error) {
      console.error('Error saving note:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const broadcastChanges = useCallback((editorState: EditorState) => {
    if (!channelRef.current || !note?.id || !user) return;
    const rawContent = JSON.stringify(convertToRaw(editorState.getCurrentContent()));
    channelRef.current.send({
      type: 'broadcast', event: 'content-change',
      payload: { userId: user.id, content: rawContent, title, version: docVersion },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, user?.id, docVersion, title]);

  const handleEditorChange = useCallback((newEditorState: EditorState) => {
    setEditorState(newEditorState);
    if (isRemoteUpdate.current) return;
    const currentContent = editorState.getCurrentContent();
    const newContent = newEditorState.getCurrentContent();
    if (currentContent !== newContent) {
      if (throttleRef.current) clearTimeout(throttleRef.current);
      throttleRef.current = setTimeout(() => { broadcastChanges(newEditorState); }, 300);
    }
  }, [editorState, broadcastChanges]);

  const toggleInlineStyle = (style: string) => {
    setEditorState(RichUtils.toggleInlineStyle(editorState, style));
  };

  const toggleBlockType = (blockType: string) => {
    setEditorState(RichUtils.toggleBlockType(editorState, blockType));
  };

  const focusEditor = () => { editorRef.current?.focus(); };

  // Pin/Unpin handler
  const handleTogglePin = async () => {
    if (!note) return;
    try {
      if (isPinned) {
        await unpinNote(supabase, note.id);
        setIsPinned(false);
      } else {
        await pinNote(supabase, note.id);
        setIsPinned(true);
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
    setShowMenu(false);
  };

  // Lock/Unlock handler
  const handleToggleLock = async () => {
    if (!note) return;
    try {
      if (isLocked) {
        await unlockNote(supabase, note.id);
        setIsLocked(false);
        setOverrideLock(false);
      } else {
        await lockNote(supabase, note.id);
        setIsLocked(true);
        setOverrideLock(false);
      }
    } catch (error) {
      console.error('Error toggling lock:', error);
    }
    setShowMenu(false);
  };

  // Hide handler
  const handleHide = async () => {
    if (!note) return;
    try {
      await hideNote(supabase, note.id);
    } catch (error) {
      console.error('Error hiding note:', error);
    }
    setShowMenu(false);
  };

  const currentInlineStyles = editorState.getCurrentInlineStyle();
  const currentBlockType = RichUtils.getCurrentBlockType(editorState);

  // Toolbar button helper
  const ToolbarButton: React.FC<{
    active: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    children: React.ReactNode;
    className?: string;
  }> = ({ active, onMouseDown, children, className = '' }) => (
    <button
      onMouseDown={onMouseDown}
      className={`px-2.5 py-1.5 rounded text-sm transition-colors ${
        active
          ? 'text-accent bg-accent-muted'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'
      } ${className}`}
    >
      {children}
    </button>
  );

  const ToolbarDivider = () => (
    <div className="w-px h-5 bg-border-default mx-1" />
  );

  return (
    <div className="flex flex-col h-full bg-bg-base relative">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          {/* Connection + save status */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-status-success' : 'bg-status-error'}`} />
            {saveStatus === 'saved' && (
              <span className="text-text-tertiary flex items-center gap-1">
                <CheckIcon className="w-3 h-3" /> Saved
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="text-accent animate-pulse-gold">Saving...</span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="text-text-tertiary">Unsaved</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-status-error">Error saving</span>
            )}
          </div>

          {/* Metadata line */}
          {note && (
            <span className="text-xs text-text-tertiary">
              {note.owner_name && `Created by ${note.owner_name}`}
              {note.last_edited_by_name && note.updated_at && (
                <> &middot; Edited by {note.last_edited_by_name} {relativeTime(note.updated_at)}</>
              )}
            </span>
          )}

          {/* Typing indicators */}
          {typingUsers.length > 0 && (
            <span className="text-xs text-text-tertiary italic">
              {typingUsers.length === 1 ? `${typingUsers[0].name} is typing...` : `${typingUsers.length} typing...`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Active users */}
          {activeUsers.map(u => (
            <UserPresence key={u.id} user={u} size="small" />
          ))}

          {/* More menu */}
          {note && (onDelete || onShare || onDuplicate) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
              >
                <EllipsisHorizontalIcon className="w-5 h-5" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-bg-surface border border-border-default rounded-lg shadow-lg py-1 min-w-[160px] animate-fade-in">
                    {onShare && (
                      <button onClick={() => { onShare(note.id); setShowMenu(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover">
                        Share
                      </button>
                    )}
                    {onDuplicate && (
                      <button onClick={() => { onDuplicate(note.id); setShowMenu(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover">
                        Duplicate
                      </button>
                    )}
                    {/* Pin / Unpin */}
                    <button onClick={handleTogglePin}
                      className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover">
                      {isPinned ? 'Unpin note' : 'Pin note'}
                    </button>
                    {/* Lock / Unlock */}
                    <button onClick={handleToggleLock}
                      className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover">
                      {isLocked ? 'Unlock note' : 'Lock note'}
                    </button>
                    {/* Hide */}
                    <button onClick={handleHide}
                      className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover">
                      Hide note
                    </button>
                    {onDelete && (
                      <>
                        <div className="my-1 border-t border-border-subtle" />
                        <button onClick={() => { onDelete(note.id); setShowMenu(false); }}
                          className="w-full text-left px-4 py-2 text-sm text-status-error hover:bg-bg-surface-hover">
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Persistent formatting toolbar */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-border-subtle bg-bg-raised">
        {/* Inline styles: Bold, Italic, Underline */}
        <ToolbarButton
          active={currentInlineStyles.has('BOLD')}
          onMouseDown={(e) => { e.preventDefault(); toggleInlineStyle('BOLD'); }}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          active={currentInlineStyles.has('ITALIC')}
          onMouseDown={(e) => { e.preventDefault(); toggleInlineStyle('ITALIC'); }}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          active={currentInlineStyles.has('UNDERLINE')}
          onMouseDown={(e) => { e.preventDefault(); toggleInlineStyle('UNDERLINE'); }}
        >
          <span className="underline">U</span>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton
          active={currentBlockType === 'header-one'}
          onMouseDown={(e) => { e.preventDefault(); toggleBlockType('header-one'); }}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          active={currentBlockType === 'header-two'}
          onMouseDown={(e) => { e.preventDefault(); toggleBlockType('header-two'); }}
        >
          H2
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          active={currentBlockType === 'unordered-list-item'}
          onMouseDown={(e) => { e.preventDefault(); toggleBlockType('unordered-list-item'); }}
        >
          &bull; List
        </ToolbarButton>
        <ToolbarButton
          active={currentBlockType === 'ordered-list-item'}
          onMouseDown={(e) => { e.preventDefault(); toggleBlockType('ordered-list-item'); }}
        >
          1. List
        </ToolbarButton>

        <ToolbarDivider />

        {/* Code block */}
        <ToolbarButton
          active={currentBlockType === 'code-block'}
          onMouseDown={(e) => { e.preventDefault(); toggleBlockType('code-block'); }}
        >
          {'{ }'}
        </ToolbarButton>
      </div>

      {/* Lock banner */}
      {isLocked && !overrideLock && (
        <div className="bg-accent-muted border border-accent-line rounded-lg px-4 py-3 mx-6 mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-body">
            <LockClosedIcon className="w-4 h-4 text-accent" />
            <span>This note is locked to prevent accidental edits.</span>
          </div>
          <button
            onClick={() => setOverrideLock(true)}
            className="text-accent hover:text-accent-hover text-sm transition-colors"
          >
            Edit anyway
          </button>
        </div>
      )}

      {/* Editor content */}
      <div
        ref={editorContainerRef}
        className="flex-1 overflow-y-auto"
        onClick={focusEditor}
      >
        <div className="max-w-[720px] mx-auto px-6 md:px-12 pt-10 pb-32">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setSaveStatus('unsaved'); }}
            placeholder="Untitled"
            className="w-full text-display-md bg-transparent border-none outline-none placeholder:text-text-tertiary mb-8"
            readOnly={effectiveReadOnly}
          />

          {/* Rich text editor */}
          <div className="prose-editorial">
            <Editor
              ref={editorRef}
              editorState={editorState}
              onChange={handleEditorChange}
              handleKeyCommand={handleKeyCommand}
              placeholder="Start writing..."
              readOnly={effectiveReadOnly}
              spellCheck={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;
