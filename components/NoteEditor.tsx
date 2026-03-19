import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tinymce/tinymce-react';
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

// Convert Draft.js JSON to HTML for backward compatibility
function draftJsonToHtml(jsonString: string): string {
  try {
    const raw = JSON.parse(jsonString);
    if (!raw || !Array.isArray(raw.blocks)) return jsonString;

    const styleMap: Record<string, [string, string]> = {
      BOLD: ['<strong>', '</strong>'],
      ITALIC: ['<em>', '</em>'],
      UNDERLINE: ['<u>', '</u>'],
      CODE: ['<code>', '</code>'],
    };

    let html = '';
    let inList: string | null = null;

    for (const block of raw.blocks) {
      const text = block.text || '';
      const type = block.type || 'unstyled';

      // Build styled text
      let styledText = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const activeStyles = (block.inlineStyleRanges || [])
          .filter((r: any) => i >= r.offset && i < r.offset + r.length)
          .map((r: any) => r.style);

        let open = '', close = '';
        for (const s of activeStyles) {
          const t = styleMap[s];
          if (!t) continue;
          const prevActive = (block.inlineStyleRanges || [])
            .filter((r: any) => (i - 1) >= r.offset && (i - 1) < r.offset + r.length)
            .map((r: any) => r.style);
          if (!prevActive.includes(s)) open += t[0];
          const nextActive = (block.inlineStyleRanges || [])
            .filter((r: any) => (i + 1) >= r.offset && (i + 1) < r.offset + r.length)
            .map((r: any) => r.style);
          if (!nextActive.includes(s)) close = t[1] + close;
        }
        styledText += open + ch + close;
      }

      const isList = type === 'unordered-list-item' || type === 'ordered-list-item';
      const listTag = type === 'unordered-list-item' ? 'ul' : 'ol';

      if (isList && inList !== listTag) {
        if (inList) html += `</${inList}>`;
        html += `<${listTag}>`;
        inList = listTag;
      } else if (!isList && inList) {
        html += `</${inList}>`;
        inList = null;
      }

      switch (type) {
        case 'header-one': html += `<h1>${styledText}</h1>`; break;
        case 'header-two': html += `<h2>${styledText}</h2>`; break;
        case 'header-three': html += `<h3>${styledText}</h3>`; break;
        case 'blockquote': html += `<blockquote>${styledText}</blockquote>`; break;
        case 'code-block': html += `<pre><code>${styledText}</code></pre>`; break;
        case 'unordered-list-item':
        case 'ordered-list-item': html += `<li>${styledText}</li>`; break;
        default: html += text ? `<p>${styledText}</p>` : '<p><br></p>';
      }
    }
    if (inList) html += `</${inList}>`;
    return html;
  } catch {
    return jsonString || '';
  }
}

function parseContent(content: string | null): string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.blocks)) return draftJsonToHtml(content);
  } catch { /* not JSON */ }
  return content;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave, onDelete, onShare, onDuplicate, readOnly = false }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | 'saved' | 'error'>('saved');
  const [docVersion, setDocVersion] = useState(1);
  const [localChanges, setLocalChanges] = useState(false);
  const [typingUsers, setTypingUsers] = useState<ActiveUser[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [overrideLock, setOverrideLock] = useState(false);

  const { user } = useAuth();
  const { joinNote, leaveNote } = useRealtime();

  const editorRef = useRef<any>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isRemoteUpdate = useRef(false);
  const contentRef = useRef(content);
  contentRef.current = content;

  const effectiveReadOnly = readOnly || (isLocked && !overrideLock);

  // Real-time channel
  useEffect(() => {
    if (!note?.id || !user) return;
    const channel = joinNote(note.id, user.id, user.name);
    channelRef.current = channel;
    setIsConnected(true);

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: ActiveUser[] = [];
      for (const [, presences] of Object.entries(state)) {
        for (const p of presences as any[]) {
          if (p.user_id !== user.id) {
            users.push({ id: p.user_id, name: p.user_name, color: p.color, last_active: new Date(p.online_at) });
          }
        }
      }
      setActiveUsers(users);
    });

    channel.on('broadcast', { event: 'content-change' }, (payload: any) => {
      const data = payload.payload;
      if (data.userId === user.id) return;
      isRemoteUpdate.current = true;
      setContent(data.content || '');
      if (data.title) setTitle(data.title);
      setDocVersion(data.version || docVersion);
      setSaveStatus('saved');
      setLocalChanges(false);
      if (editorRef.current) editorRef.current.setContent(data.content || '');
      setTimeout(() => { isRemoteUpdate.current = false; }, 100);
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

    return () => { setIsConnected(false); channelRef.current = null; leaveNote(note.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, user?.id]);

  // Load note content
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      const html = parseContent(note.content);
      setContent(html);
      if (editorRef.current) editorRef.current.setContent(html);
      setDocVersion(note.version || 1);
      setSaveStatus('saved');
      setLocalChanges(false);
      setIsPinned(!!note.is_pinned);
      setIsLocked(!!note.is_locked);
      setOverrideLock(false);
    } else {
      setTitle(''); setContent(''); setIsPinned(false); setIsLocked(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  // Auto-save (triggered when saveStatus changes to unsaved)
  useEffect(() => {
    if (!note || effectiveReadOnly || saveStatus !== 'unsaved') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setLocalChanges(true);
    saveTimerRef.current = setTimeout(() => { handleSave(); }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus, title]);

  const handleSave = async () => {
    if (!note || effectiveReadOnly) return;
    setSaveStatus('saving');
    // Read latest content from TinyMCE editor instance
    const currentContent = editorRef.current ? editorRef.current.getContent() : contentRef.current;
    try {
      const updated = await apiUpdateNote(supabase, note.id, { title, content: currentContent, version: docVersion + 1 });
      channelRef.current?.send({
        type: 'broadcast', event: 'content-change',
        payload: { userId: user?.id, content: currentContent, title, version: updated.version },
      });
      if (onSave) onSave({ id: note.id, title, content: currentContent });
      setSaveStatus('saved');
      setLocalChanges(false);
      setDocVersion(updated.version || docVersion + 1);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
    }
  };

  const handleEditorChange = useCallback((newContent: string) => {
    if (isRemoteUpdate.current) return;
    // Don't set React state for content — let TinyMCE manage it internally
    // Just update the ref for saving and mark as unsaved
    contentRef.current = newContent;
    setSaveStatus('unsaved');
    channelRef.current?.send({
      type: 'broadcast', event: 'typing-status',
      payload: { userId: user?.id, userName: user?.name, isTyping: true },
    });
  }, [user?.id, user?.name]);

  const handleTogglePin = async () => {
    if (!note) return;
    try { isPinned ? await unpinNote(supabase, note.id) : await pinNote(supabase, note.id); setIsPinned(!isPinned); }
    catch (err) { console.error(err); }
    setShowMenu(false);
  };

  const handleToggleLock = async () => {
    if (!note) return;
    try { isLocked ? await unlockNote(supabase, note.id) : await lockNote(supabase, note.id); setIsLocked(!isLocked); setOverrideLock(false); }
    catch (err) { console.error(err); }
    setShowMenu(false);
  };

  const handleHide = async () => {
    if (!note) return;
    try { await hideNote(supabase, note.id); } catch (err) { console.error(err); }
    setShowMenu(false);
  };

  const contentStyle = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    body { font-family: 'DM Sans', system-ui, sans-serif; font-size: 15px; line-height: 1.7; color: #e4e4e7; background: #0a0a0b; padding: 0 12px; max-width: 720px; margin: 0 auto; }
    h1, h2, h3 { font-family: 'Cormorant Garamond', Georgia, serif; color: #fafafa; margin-top: 1.5em; margin-bottom: 0.5em; }
    h1 { font-size: 1.75rem; font-weight: 600; } h2 { font-size: 1.375rem; font-weight: 500; } h3 { font-size: 1.125rem; font-weight: 500; }
    p { margin: 0.5em 0; } a { color: #d4a574; }
    blockquote { border-left: 3px solid #d4a574; padding-left: 1em; margin: 1em 0; color: #a1a1aa; font-style: italic; }
    pre { font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; background: #18181b; border: 1px solid #27272a; border-radius: 6px; padding: 1em; overflow-x: auto; color: #e4e4e7; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; background: #18181b; border: 1px solid #1f1f23; border-radius: 3px; padding: 0.15em 0.4em; }
    ul, ol { margin: 0.75em 0; padding-left: 1.5em; } li { margin: 0.25em 0; } li::marker { color: #d4a574; }
    strong { color: #fafafa; } img { max-width: 100%; border-radius: 6px; margin: 1em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; } th, td { border: 1px solid #27272a; padding: 8px 12px; } th { background: #18181b; color: #fafafa; }
    hr { border: none; border-top: 1px solid rgba(212,165,116,0.3); margin: 2em 0; }
    ::selection { background: rgba(212,165,116,0.15); color: #fafafa; }
  `;

  return (
    <div className="flex flex-col h-full bg-bg-base relative">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-status-success' : 'bg-status-error'}`} />
            {saveStatus === 'saved' && <span className="text-text-tertiary flex items-center gap-1"><CheckIcon className="w-3 h-3" /> Saved</span>}
            {saveStatus === 'saving' && <span className="text-accent animate-pulse">Saving...</span>}
            {saveStatus === 'unsaved' && <span className="text-text-tertiary">Unsaved</span>}
            {saveStatus === 'error' && <span className="text-status-error">Error saving</span>}
          </div>
          {note && (
            <span className="text-xs text-text-tertiary hidden sm:inline">
              {note.owner_name && `Created by ${note.owner_name}`}
              {note.last_edited_by_name && note.updated_at && <> &middot; Edited by {note.last_edited_by_name} {relativeTime(note.updated_at)}</>}
            </span>
          )}
          {typingUsers.length > 0 && (
            <span className="text-xs text-text-tertiary italic">
              {typingUsers.length === 1 ? `${typingUsers[0].name} is typing...` : `${typingUsers.length} typing...`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeUsers.map(u => <UserPresence key={u.id} user={u} size="small" />)}
          {note && (
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors">
                <EllipsisHorizontalIcon className="w-5 h-5" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-bg-surface border border-border-default rounded-lg shadow-lg py-1 min-w-[160px] animate-fade-in">
                    {onShare && <button onClick={() => { onShare(note.id); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover">Share</button>}
                    {onDuplicate && <button onClick={() => { onDuplicate(note.id); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover">Duplicate</button>}
                    <button onClick={handleTogglePin} className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover">{isPinned ? 'Unpin note' : 'Pin note'}</button>
                    <button onClick={handleToggleLock} className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover">{isLocked ? 'Unlock note' : 'Lock note'}</button>
                    <button onClick={handleHide} className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover">Hide note</button>
                    {onDelete && (
                      <><div className="my-1 border-t border-border-subtle" /><button onClick={() => { onDelete(note.id); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-status-error hover:bg-bg-surface-hover">Delete</button></>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lock banner */}
      {isLocked && !overrideLock && (
        <div className="bg-accent-muted border border-accent-line rounded-lg px-4 py-3 mx-6 mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-body">
            <LockClosedIcon className="w-4 h-4 text-accent" />
            <span>This note is locked to prevent accidental edits.</span>
          </div>
          <button onClick={() => setOverrideLock(true)} className="text-accent hover:text-accent-hover text-sm transition-colors">Edit anyway</button>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[780px] mx-auto px-6 md:px-12 pt-8 pb-16">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setSaveStatus('unsaved'); }}
            placeholder="Untitled"
            className="w-full text-display-md bg-transparent border-none outline-none placeholder:text-text-tertiary mb-6"
            readOnly={effectiveReadOnly}
          />
          <Editor
            licenseKey="gpl"
            tinymceScriptSrc="/tinymce/tinymce.min.js"
            onInit={(_evt, editor) => { editorRef.current = editor; }}
            initialValue={content}
            disabled={effectiveReadOnly}
            onEditorChange={handleEditorChange}
            init={{
              height: 500,
              min_height: 400,
              menubar: false,
              statusbar: false,
              branding: false,
              promotion: false,
              skin: 'oxide-dark',
              content_css: 'dark',
              content_style: contentStyle,
              toolbar: 'bold italic underline strikethrough | blocks | bullist numlist | blockquote codesample | link image table | hr removeformat',
              plugins: 'lists link image table code codesample autolink autoresize',
              autoresize_bottom_margin: 100,
              block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Code=pre',
              placeholder: 'Start writing...',
              resize: false,
              toolbar_mode: 'wrap',
              link_default_target: '_blank',
              setup: (editor) => {
                editor.on('keydown', (e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                    e.preventDefault();
                    handleSave();
                  }
                });
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;
