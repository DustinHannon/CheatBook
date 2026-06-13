import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import * as Y from 'yjs';
import { Bold, ListChecks, Code2, ImageIcon, Paperclip } from 'lucide-react';
import { createClient } from '../lib/supabase/client';
import { SupabaseYjsProvider, SyncStatus } from '../lib/yjs/SupabaseProvider';
import { saveNoteSnapshot, uploadNoteImage } from '../lib/api';
import type { Note, Member } from '../lib/types';

const supabase = createClient();
const lowlight = createLowlight(common);

export interface EditorPeer { id: string; name: string; color: string }

interface NoteEditorProps {
  note: Note;
  me: Member;
  editable: boolean;
  onPeersChange?: (peers: EditorPeer[]) => void;
  onStatusChange?: (status: SyncStatus) => void;
  onAttach?: () => void;
}

/** Collaborative note body: TipTap + Yjs over Supabase, live carets, autosave. */
export const NoteEditor: React.FC<NoteEditorProps> = (props) => {
  const { note } = props;
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('connecting');
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<SupabaseYjsProvider | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new SupabaseYjsProvider(supabase, note.id, ydoc, (s) => {
      setStatus(s);
      props.onStatusChange?.(s);
    });
    docRef.current = ydoc;
    providerRef.current = provider;
    setReady(true);
    return () => {
      provider.destroy();
      ydoc.destroy();
      docRef.current = null;
      providerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  if (!ready || !docRef.current || !providerRef.current) {
    return <div className="px-1 py-8 text-sm text-text-3">Connecting to the live document…</div>;
  }

  return (
    <EditorInner
      key={note.id}
      ydoc={docRef.current}
      provider={providerRef.current}
      synced={status !== 'connecting'}
      status={status}
      {...props}
    />
  );
};

interface InnerProps extends NoteEditorProps {
  ydoc: Y.Doc;
  provider: SupabaseYjsProvider;
  synced: boolean;
  status: SyncStatus;
}

const EditorInner: React.FC<InnerProps> = ({
  ydoc, provider, status, note, me, editable, onPeersChange, onAttach,
}) => {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ undoRedo: false, codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: 'Start writing — or add a block below…' }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({
        provider,
        user: { name: me.name, color: me.color },
      }),
    ],
    editorProps: {
      attributes: { class: 'cb-prose max-w-none focus:outline-none' },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files || []);
        const img = files.find((f) => f.type.startsWith('image/'));
        if (img) { void insertImage(img); return true; }
        return false;
      },
      handleDrop(_view, event) {
        const files = Array.from((event as DragEvent).dataTransfer?.files || []);
        const img = files.find((f) => f.type.startsWith('image/'));
        if (img) { event.preventDefault(); void insertImage(img); return true; }
        return false;
      },
    },
    onUpdate({ editor }) {
      if (!editable) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveNoteSnapshot(supabase, note.id, editor.getJSON()).catch(() => {});
      }, 2000);
    },
  });

  const insertImage = useCallback(async (file: File) => {
    if (!editor) return;
    try {
      const { url } = await uploadNoteImage(supabase, note.id, file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch { /* surfaced via parent toast on attach path */ }
  }, [editor, note.id]);

  // Seed the shared doc from the persisted body exactly once across ALL clients.
  // Gated on a real 'synced' status (so the provider has cold-loaded persisted
  // CRDT state first — never seed while offline) and on a SHARED Yjs flag set in
  // a transaction, so two concurrent first-openers can't double-seed into the
  // merged fragment. The flag propagates over the same broadcast channel.
  useEffect(() => {
    if (!editor || status !== 'synced') return;
    const cfg = ydoc.getMap('config');
    const frag = ydoc.getXmlFragment('default');
    if (!cfg.get('seeded') && frag.length === 0 && note.body) {
      ydoc.transact(() => cfg.set('seeded', true));
      // Re-check emptiness in case content arrived between the guard and the write.
      if (frag.length === 0) {
        try { editor.commands.setContent(note.body as object, { emitUpdate: true }); } catch { /* ignore */ }
      }
    }
  }, [editor, status, ydoc, note.body]);

  // Keep ProseMirror editability in sync with the live lock state (note.isLocked
  // can flip via the realtime team subscription without remounting the editor).
  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);

  // Report editing peers (excluding self) to the parent toolbar.
  useEffect(() => {
    if (!editor) return;
    const aw = provider.awareness;
    const update = () => {
      const peers: EditorPeer[] = [];
      aw.getStates().forEach((state, clientId) => {
        if (clientId === ydoc.clientID) return;
        const u = (state as { user?: { name?: string; color?: string } }).user;
        if (u?.name) peers.push({ id: String(clientId), name: u.name, color: u.color || '#6ea8fe' });
      });
      onPeersChange?.(peers);
    };
    aw.on('change', update);
    update();
    return () => { aw.off('change', update); };
  }, [editor, provider, ydoc, onPeersChange]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const ToolBtn: React.FC<{ label: string; active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ label, active, onClick, children }) => (
    <button
      type="button" title={label} aria-label={label} onClick={onClick}
      className="grid h-[30px] w-[30px] place-items-center rounded-lg text-text-3 transition hover:bg-white/[0.06] hover:text-text disabled:opacity-40"
      style={active ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
      disabled={!editable}
    >
      {children}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <input
        ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void insertImage(f); e.target.value = ''; }}
      />
      <div className="min-h-0 flex-1">
        <EditorContent editor={editor} />
      </div>

      {/* bottom bar: formatting + live sync status */}
      <div className="flex items-center gap-2 border-t border-white/[0.06] px-[18px] py-[11px]">
        <div className="flex gap-[3px]">
          <ToolBtn label="Bold" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></ToolBtn>
          <ToolBtn label="Checklist" active={editor?.isActive('taskList')} onClick={() => editor?.chain().focus().toggleTaskList().run()}><ListChecks size={16} /></ToolBtn>
          <ToolBtn label="Code block" active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 size={16} /></ToolBtn>
          <ToolBtn label="Insert image" onClick={() => fileInput.current?.click()}><ImageIcon size={16} /></ToolBtn>
          {onAttach && <ToolBtn label="Attach file" onClick={onAttach}><Paperclip size={16} /></ToolBtn>}
        </div>
        <div className="ml-auto flex items-center gap-2 font-mono text-[10.5px] text-text-4">
          <span
            className="h-[6px] w-[6px] rounded-full"
            style={{ background: status === 'offline' ? '#fb87a4' : '#5eead4', animation: status === 'synced' ? 'cbPulse 1.6s infinite' : undefined }}
          />
          {status === 'synced' ? 'All changes saved · synced' : status === 'offline' ? 'Offline · reconnecting…' : 'Syncing…'}
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;
export type { Editor };
