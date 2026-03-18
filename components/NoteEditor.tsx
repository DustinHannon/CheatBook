import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor, EditorState, RichUtils, ContentState, convertToRaw, convertFromRaw, SelectionState, Modifier, ContentBlock } from 'draft-js';
import 'draft-js/dist/Draft.css';
import {
  ArrowDownTrayIcon,
  CheckIcon,
  ExclamationCircleIcon,
  DocumentDuplicateIcon,
  ShareIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import UserPresence from './UserPresence';
import { useRealtime, getUserColor } from './RealtimeContext';
import { useAuth } from './AuthContext';
import { createClient } from '../lib/supabase/client';
import { updateNote as apiUpdateNote, uploadNoteImage } from '../lib/api';
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
}

interface ActiveUser {
  id: string;
  name: string;
  color: string;
  last_active: Date;
  cursor?: {
    position: number;
    selection?: { start: number; end: number };
  };
}

interface NoteEditorProps {
  note: NoteType | null;
  onSave?: (note: { id?: string; title: string; content: string }) => void;
  onDelete?: (noteId: string) => void;
  onShare?: (noteId: string) => void;
  onDuplicate?: (noteId: string) => void;
  readOnly?: boolean;
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
  const [imageUploads, setImageUploads] = useState<Record<string, any>>({});

  const { user } = useAuth();
  const { joinNote, leaveNote } = useRealtime();

  const editorRef = useRef<Editor>(null);
  const lastSelectionState = useRef<SelectionState | null>(null);
  const throttleRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isRemoteUpdate = useRef(false);

  // Set up Supabase Realtime channel
  useEffect(() => {
    if (!note?.id || !user) return;

    const channel = joinNote(note.id, user.id, user.name);
    channelRef.current = channel;
    setIsConnected(true);

    // Listen for presence changes
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
              cursor: presence.cursor_position ? { position: presence.cursor_position } : undefined,
            });
          }
        }
      }
      setActiveUsers(users);
    });

    // Listen for broadcast content changes from other users
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

        if (data.title) {
          setTitle(data.title);
        }
        setDocVersion(data.version || docVersion);
        setSaveStatus('saved');
        setLocalChanges(false);
        isRemoteUpdate.current = false;
      } catch (error) {
        console.error('Error applying remote changes:', error);
        isRemoteUpdate.current = false;
      }
    });

    // Listen for typing status
    channel.on('broadcast', { event: 'typing-status' }, (payload: any) => {
      const data = payload.payload;
      if (data.userId === user.id) return;

      setTypingUsers(prev => {
        if (data.isTyping) {
          const exists = prev.find(u => u.id === data.userId);
          if (exists) return prev;
          return [...prev, {
            id: data.userId,
            name: data.userName,
            color: getUserColor(data.userId),
            last_active: new Date(),
          }];
        } else {
          return prev.filter(u => u.id !== data.userId);
        }
      });
    });

    // Listen for image upload notifications
    channel.on('broadcast', { event: 'image-upload' }, (payload: any) => {
      const data = payload.payload;
      if (data.userId === user.id) return;

      setImageUploads(prev => ({
        ...prev,
        [data.imageId]: data,
      }));

      if (data.status === 'complete' && data.url) {
        insertImageAtPosition(data.url, data.insertPosition || 0);
        setTimeout(() => {
          setImageUploads(prev => {
            const next = { ...prev };
            delete next[data.imageId];
            return next;
          });
        }, 2000);
      }
    });

    // Listen for DB changes (fallback sync)
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'notes',
      filter: `id=eq.${note.id}`,
    }, (payload: any) => {
      // Only apply if we don't have local changes
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
      setTitle(note.title || 'Untitled');
      try {
        if (note.content) {
          const contentState = convertFromRaw(JSON.parse(note.content));
          setEditorState(EditorState.createWithContent(contentState));
        } else {
          setEditorState(EditorState.createEmpty());
        }
      } catch (error) {
        console.error('Error parsing note content:', error);
        setEditorState(EditorState.createWithContent(
          ContentState.createFromText(note.content || '')
        ));
      }
      setDocVersion(note.version || 1);
      setSaveStatus('saved');
      setLocalChanges(false);
    } else {
      setTitle('Untitled');
      setEditorState(EditorState.createEmpty());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  // Auto-save
  useEffect(() => {
    if (!note || readOnly) return;
    if (saveTimer) clearTimeout(saveTimer);
    if (saveStatus === 'saved') return;

    setSaveStatus('unsaved');
    setLocalChanges(true);

    const timer = setTimeout(() => {
      handleSave();
    }, 2000);
    setSaveTimer(timer);

    return () => { if (saveTimer) clearTimeout(saveTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, editorState]);

  // Broadcast cursor/typing via presence updates
  useEffect(() => {
    if (!channelRef.current || !note?.id || readOnly || !user) return;

    const currentSelection = editorState.getSelection();
    lastSelectionState.current = currentSelection;

    if (throttleRef.current) clearTimeout(throttleRef.current);

    throttleRef.current = setTimeout(() => {
      const nowTyping = saveStatus === 'unsaved';
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing-status',
        payload: {
          userId: user.id,
          userName: user.name,
          isTyping: nowTyping,
        },
      });
    }, 100);

    return () => { if (throttleRef.current) clearTimeout(throttleRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorState, note?.id, saveStatus]);

  const insertImageAtPosition = (imageUrl: string, position: number) => {
    try {
      const contentState = editorState.getCurrentContent();
      const blockMap = contentState.getBlockMap();
      let targetBlock: ContentBlock | undefined;
      let targetOffset: number | undefined;
      let currentPosition = 0;

      blockMap.forEach((block: ContentBlock | undefined) => {
        if (block && !targetBlock && currentPosition + block.getLength() >= position) {
          targetBlock = block;
          targetOffset = position - currentPosition;
        }
        if (block) currentPosition += block.getLength() + 1;
      });

      if (targetBlock && targetOffset !== undefined) {
        const targetKey = targetBlock.getKey();
        const selectionState = SelectionState.createEmpty(targetKey).merge({
          anchorOffset: targetOffset,
          focusOffset: targetOffset,
        });

        const textWithImage = `![Image](${imageUrl})`;
        const contentWithImage = Modifier.insertText(contentState, selectionState, textWithImage);
        const newEditorState = EditorState.push(editorState, contentWithImage, 'insert-characters');
        setEditorState(newEditorState);
      }
    } catch (error) {
      console.error('Error inserting image:', error);
    }
  };

  const handleKeyCommand = (command: string, editorState: EditorState) => {
    const newState = RichUtils.handleKeyCommand(editorState, command);
    if (newState) {
      setEditorState(newState);
      return 'handled';
    }
    return 'not-handled';
  };

  const handleSave = async () => {
    if (!note || readOnly) return;

    setSaveStatus('saving');
    setIsSaving(true);

    try {
      const contentState = editorState.getCurrentContent();
      const rawContent = JSON.stringify(convertToRaw(contentState));

      // Save to Supabase
      const updated = await apiUpdateNote(supabase, note.id, {
        title,
        content: rawContent,
        version: docVersion + 1,
      });

      // Broadcast to other users
      channelRef.current?.send({
        type: 'broadcast',
        event: 'content-change',
        payload: {
          userId: user?.id,
          content: rawContent,
          title,
          version: updated.version,
        },
      });

      // Notify parent
      if (onSave) {
        onSave({ id: note.id, title, content: rawContent });
      }

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

  const broadcastChanges = useCallback(
    (editorState: EditorState) => {
      if (!channelRef.current || !note?.id || !user) return;

      const contentState = editorState.getCurrentContent();
      const rawContent = JSON.stringify(convertToRaw(contentState));

      channelRef.current.send({
        type: 'broadcast',
        event: 'content-change',
        payload: {
          userId: user.id,
          content: rawContent,
          title,
          version: docVersion,
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note?.id, user?.id, docVersion, title]
  );

  const handleEditorChange = useCallback(
    (newEditorState: EditorState) => {
      setEditorState(newEditorState);

      if (isRemoteUpdate.current) return;

      const currentContent = editorState.getCurrentContent();
      const newContent = newEditorState.getCurrentContent();

      if (currentContent !== newContent) {
        if (throttleRef.current) clearTimeout(throttleRef.current);
        throttleRef.current = setTimeout(() => {
          broadcastChanges(newEditorState);
        }, 300);
      }
    },
    [editorState, broadcastChanges]
  );

  const toggleInlineStyle = (style: string) => {
    setEditorState(RichUtils.toggleInlineStyle(editorState, style));
  };

  const toggleBlockType = (blockType: string) => {
    setEditorState(RichUtils.toggleBlockType(editorState, blockType));
  };

  const handlePaste = (text: string, html: string | undefined, editorState: EditorState): 'handled' | 'not-handled' => {
    return 'not-handled';
  };

  const focusEditor = () => {
    if (editorRef.current) editorRef.current.focus();
  };

  return (
    <div className="flex flex-col h-full bg-background-primary">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface">
        <div className="flex space-x-2">
          <button
            onClick={() => toggleInlineStyle('BOLD')}
            className={`p-1.5 rounded ${
              editorState.getCurrentInlineStyle().has('BOLD')
                ? 'bg-primary-light text-primary'
                : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <span className="font-bold">B</span>
          </button>
          <button
            onClick={() => toggleInlineStyle('ITALIC')}
            className={`p-1.5 rounded ${
              editorState.getCurrentInlineStyle().has('ITALIC')
                ? 'bg-primary-light text-primary'
                : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <span className="italic">I</span>
          </button>
          <button
            onClick={() => toggleInlineStyle('UNDERLINE')}
            className={`p-1.5 rounded ${
              editorState.getCurrentInlineStyle().has('UNDERLINE')
                ? 'bg-primary-light text-primary'
                : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <span className="underline">U</span>
          </button>
          <div className="h-6 mx-2 border-r border-border" />
          <button
            onClick={() => toggleBlockType('header-one')}
            className={`p-1.5 rounded text-sm ${
              RichUtils.getCurrentBlockType(editorState) === 'header-one'
                ? 'bg-primary-light text-primary'
                : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            H1
          </button>
          <button
            onClick={() => toggleBlockType('header-two')}
            className={`p-1.5 rounded text-sm ${
              RichUtils.getCurrentBlockType(editorState) === 'header-two'
                ? 'bg-primary-light text-primary'
                : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            H2
          </button>
          <button
            onClick={() => toggleBlockType('unordered-list-item')}
            className={`p-1.5 rounded text-sm ${
              RichUtils.getCurrentBlockType(editorState) === 'unordered-list-item'
                ? 'bg-primary-light text-primary'
                : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            • List
          </button>
          <button
            onClick={() => toggleBlockType('ordered-list-item')}
            className={`p-1.5 rounded text-sm ${
              RichUtils.getCurrentBlockType(editorState) === 'ordered-list-item'
                ? 'bg-primary-light text-primary'
                : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            1. List
          </button>
        </div>

        {/* Right side toolbar */}
        <div className="flex items-center space-x-2">
          {/* Connection status */}
          <div className="mr-2">
            <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-red-500'}`}></span>
            <span className="ml-1 text-xs text-text-secondary">
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>

          {/* Active users */}
          <div className="flex items-center mr-4">
            {activeUsers.map((u) => (
              <UserPresence key={u.id} user={u} />
            ))}
          </div>

          {/* Typing indicators */}
          {typingUsers.length > 0 && (
            <div className="text-xs text-text-secondary mr-3 italic">
              {typingUsers.length === 1
                ? `${typingUsers[0].name} is typing...`
                : `${typingUsers.length} users are typing...`}
            </div>
          )}

          {/* Save status */}
          <div className="flex items-center text-sm mr-2">
            {saveStatus === 'unsaved' && (
              <span className="text-text-tertiary">Unsaved changes</span>
            )}
            {saveStatus === 'saving' && (
              <span className="text-yellow-500 flex items-center">
                <ArrowDownTrayIcon className="h-4 w-4 mr-1 animate-pulse" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-green-500 flex items-center">
                <CheckIcon className="h-4 w-4 mr-1" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-500 flex items-center">
                <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                Error saving
              </span>
            )}
          </div>

          {/* Action buttons */}
          {note && (
            <>
              {onShare && (
                <button
                  onClick={() => onShare(note.id)}
                  className="p-1.5 rounded text-text-secondary hover:bg-surface-hover"
                  title="Share note"
                >
                  <ShareIcon className="h-5 w-5" />
                </button>
              )}
              {onDuplicate && (
                <button
                  onClick={() => onDuplicate(note.id)}
                  className="p-1.5 rounded text-text-secondary hover:bg-surface-hover"
                  title="Duplicate note"
                >
                  <DocumentDuplicateIcon className="h-5 w-5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(note.id)}
                  className="p-1.5 rounded text-text-secondary hover:bg-surface-hover"
                  title="Delete note"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto p-4" onClick={focusEditor}>
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaveStatus('unsaved');
          }}
          placeholder="Untitled"
          className="w-full text-2xl font-bold mb-4 bg-transparent border-none outline-none text-text-primary"
          readOnly={readOnly}
        />

        {/* Image upload progress indicators */}
        {Object.values(imageUploads).map((upload: any) => (
          <div key={upload.imageId} className="mb-2 bg-surface rounded p-2 text-sm">
            <div className="flex justify-between">
              <span>{upload.fileName || 'Uploading...'}</span>
              <span>{upload.progress || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div
                className="bg-primary h-2.5 rounded-full"
                style={{ width: `${upload.progress || 0}%` }}
              ></div>
            </div>
          </div>
        ))}

        {/* Rich text editor */}
        <div className="prose prose-sm max-w-none">
          <Editor
            ref={editorRef}
            editorState={editorState}
            onChange={handleEditorChange}
            handleKeyCommand={handleKeyCommand}
            handlePastedText={handlePaste}
            placeholder="Start writing..."
            readOnly={readOnly}
            spellCheck={true}
          />
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;
