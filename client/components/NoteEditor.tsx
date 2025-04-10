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
import { useSocket } from './SocketContext';

// Type definitions
interface NoteType {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  owner_id: string;
  owner_name?: string;
  notebook_id: string | null;
}

interface ActiveUser {
  id: string;
  name: string;
  color: string;
  last_active: Date;
  cursor?: {
    position: number;
    selection?: {
      start: number;
      end: number;
    };
  };
}

interface NoteEditorProps {
  note: NoteType | null;
  activeUsers?: ActiveUser[];
  onSave: (note: { id?: string; title: string; content: string }) => void;
  onDelete?: (noteId: string) => void;
  onShare?: (noteId: string) => void;
  onDuplicate?: (noteId: string) => void;
  readOnly?: boolean;
  userToken?: string; // JWT token for socket auth
}

/**
 * NoteEditor Component
 * Rich text editor for notes with collaboration features
 */
const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  activeUsers = [],
  onSave,
  onDelete,
  onShare,
  onDuplicate,
  readOnly = false,
  userToken
}) => {
  const [title, setTitle] = useState('');
  const [editorState, setEditorState] = useState(EditorState.createEmpty());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | 'saved' | 'error'>('saved');
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [docVersion, setDocVersion] = useState(1);
  const [localChanges, setLocalChanges] = useState(false);
  const [typingUsers, setTypingUsers] = useState<ActiveUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [imageUploads, setImageUploads] = useState<Record<string, any>>({});
  
  // Use the socket context
  const { socket, isConnected } = useSocket();
  
  const editorRef = useRef<Editor>(null);
  const lastCursorPosition = useRef<number | null>(null);
  const lastSelectionState = useRef<SelectionState | null>(null);
  const throttleRef = useRef<NodeJS.Timeout | null>(null);
  
  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !note?.id) return;
    
    console.log('Setting up socket event listeners for note:', note.id);
    
    // Join the note's room
    socket.emit('join-note', note.id);
    
    // Listen for note version info
    socket.on('note-version', (data) => {
      if (data.noteId === note.id) {
        setDocVersion(data.version);
      }
    });
    
    // Listen for note updates from other users
    socket.on('note-updated', (data) => {
      if (data.noteId === note.id && data.userId !== socket.id) {
        try {
          // Update document version
          setDocVersion(data.version);
          
          // If we have local changes, handle potential conflicts
          if (localChanges) {
            // For simplicity, we'll just overwrite with the server version
            // In a real app, you'd want to implement Operational Transforms or CRDT
            // to properly merge changes
            console.warn('Local changes overwritten by server update');
          }
          
          // Update editor state with new content from server
          const contentState = convertFromRaw(JSON.parse(data.content));
          const newEditorState = EditorState.createWithContent(contentState);
          
          // Try to preserve cursor position if possible
          if (lastSelectionState.current) {
            const withSelection = EditorState.forceSelection(newEditorState, lastSelectionState.current);
            setEditorState(withSelection);
          } else {
            setEditorState(newEditorState);
          }
          
          // Mark as saved when receiving updates
          setSaveStatus('saved');
          setLocalChanges(false);
        } catch (error) {
          console.error('Error applying remote changes:', error);
        }
      }
    });
    
    // Listen for version conflicts
    socket.on('version-conflict', (data) => {
      if (data.noteId === note.id) {
        // Update with the latest content from the server
        try {
          setDocVersion(data.currentVersion);
          const contentState = convertFromRaw(JSON.parse(data.latestContent));
          const newEditorState = EditorState.createWithContent(contentState);
          setEditorState(newEditorState);
          setLocalChanges(false);
          setSaveStatus('saved');
        } catch (error) {
          console.error('Error handling version conflict:', error);
        }
      }
    });
    
    // Listen for cursor updates from other users
    socket.on('cursor-moved', (data) => {
      if (!note || note.id !== note.id) return;
      
      // Update cursor position for the user
      const updatedUsers = activeUsers.map(user => {
        if (user.id === data.userId) {
          return {
            ...user,
            last_active: new Date(),
            cursor: {
              position: data.position,
              selection: data.selection
            }
          };
        }
        return user;
      });
      
      // If user not in the active users list, add them
      if (!updatedUsers.some(user => user.id === data.userId)) {
        updatedUsers.push({
          id: data.userId,
          name: data.userName,
          color: getRandomColor(data.userId),
          last_active: new Date(),
          cursor: {
            position: data.position,
            selection: data.selection
          }
        });
      }
    });
    
    // Listen for typing status updates
    socket.on('typing-updated', (data) => {
      if (data.noteId === note.id) {
        setTypingUsers(data.users.map((user: any) => ({
          id: user.userId,
          name: user.userName,
          color: getRandomColor(user.userId),
          last_active: new Date(user.timestamp),
          cursor: {
            position: user.position
          }
        })));
      }
    });
    
    // Listen for image upload progress
    socket.on('image-upload-progress', (data) => {
      if (data.noteId === note.id) {
        setImageUploads(prev => ({
          ...prev,
          [data.imageId]: {
            id: data.imageId,
            userId: data.userId,
            userName: data.userName,
            filename: data.filename,
            size: data.size,
            progress: data.progress,
            status: data.status
          }
        }));
      }
    });
    
    // Listen for image upload completion
    socket.on('image-upload-complete', (data) => {
      if (data.noteId === note.id) {
        // Update the upload status
        setImageUploads(prev => ({
          ...prev,
          [data.imageId]: {
            ...prev[data.imageId],
            progress: 100,
            status: 'complete',
            url: data.url
          }
        }));
        
        // If it's from another user, insert the image at the specified position
        if (data.userId !== socket.id) {
          insertImageAtPosition(data.url, data.insertPosition);
        }
      }
    });
    
    // Clean up on unmount or when note changes
    return () => {
      console.log('Cleaning up socket event listeners for note:', note.id);
      
      // Leave the note's room
      socket.emit('leave-note', note.id);
      
      // Remove all event listeners
      socket.off('note-version');
      socket.off('note-updated');
      socket.off('version-conflict');
      socket.off('cursor-moved');
      socket.off('typing-updated');
      socket.off('image-upload-progress');
      socket.off('image-upload-complete');
    };
  }, [socket, note?.id]);
  
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
      
      setSaveStatus('saved');
      setLocalChanges(false);
    } else {
      setTitle('Untitled');
      setEditorState(EditorState.createEmpty());
    }
  }, [note?.id]);

  // Auto-save functionality
  useEffect(() => {
    if (!note || readOnly) return;
    
    // Clear previous timer
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    
    // Don't trigger save on initial load
    if (saveStatus === 'saved') return;
    
    // Set status to unsaved
    setSaveStatus('unsaved');
    setLocalChanges(true);
    
    // Schedule auto-save after 2 seconds of inactivity
    const timer = setTimeout(() => {
      handleSave();
    }, 2000);
    
    setSaveTimer(timer);
    
    // Cleanup
    return () => {
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, [title, editorState]);
  
  // Update cursor position and broadcast it
  useEffect(() => {
    if (!socket || !isConnected || !note?.id || readOnly) return;
    
    const currentSelection = editorState.getSelection();
    const currentContent = editorState.getCurrentContent();
    const startKey = currentSelection.getStartKey();
    const startOffset = currentSelection.getStartOffset();
    const endKey = currentSelection.getEndKey();
    const endOffset = currentSelection.getEndOffset();
    const isCollapsed = currentSelection.isCollapsed();
    
    // Calculate cursor position (simplified for example - you'd need more complex logic in real app)
    const cursorPosition = currentContent.getBlockForKey(startKey).getLength() + startOffset;
    
    // Store for potential conflict resolution
    lastCursorPosition.current = cursorPosition;
    lastSelectionState.current = currentSelection;
    
    // Throttle cursor updates to avoid flooding the socket
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
    }
    
    throttleRef.current = setTimeout(() => {
      // Send cursor position update
      socket.emit('cursor-move', {
        noteId: note.id,
        position: cursorPosition,
        selection: isCollapsed ? undefined : {
          start: cursorPosition,
          end: currentContent.getBlockForKey(endKey).getLength() + endOffset
        }
      });
      
      // Update typing status
      const nowTyping = saveStatus === 'unsaved';
      if (nowTyping !== isTyping) {
        setIsTyping(nowTyping);
        socket.emit('typing-status', {
          noteId: note.id,
          isTyping: nowTyping,
          position: cursorPosition
        });
      }
    }, 100); // 100ms throttle
    
    return () => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
    };
  }, [editorState, socket, isConnected, note?.id, saveStatus]);

  // Function to get a consistent color based on user ID
  const getRandomColor = (userId: string) => {
    const colors = [
      '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4', '#84cc16'
    ];
    
    // Simple hash function to get a consistent index
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };
  
  // Insert image at specified position
  const insertImageAtPosition = (imageUrl: string, position: number) => {
    try {
      const contentState = editorState.getCurrentContent();
      const blockMap = contentState.getBlockMap();
      let targetBlock: ContentBlock | undefined;
      let targetOffset: number | undefined;
      
      // This is a simplified approach - real implementation depends on your Draft.js setup
      // Find the block and offset for the target position
      let currentPosition = 0;
      
      // Using BlockMap forEach method with proper type handling
      blockMap.forEach((block: ContentBlock | undefined, key?: string) => {
        if (block && !targetBlock && currentPosition + block.getLength() >= position) {
          targetBlock = block;
          targetOffset = position - currentPosition;
        }
        if (block) {
          currentPosition += block.getLength() + 1; // +1 for newline
        }
      });
      
      if (targetBlock && targetOffset !== undefined) {
        // Create selection at position
        const targetKey = targetBlock.getKey();
        const selectionState = SelectionState.createEmpty(targetKey).merge({
          anchorOffset: targetOffset,
          focusOffset: targetOffset,
        });
        
        // For this example, we'll just insert the image URL as text
        // In a real implementation, you'd use an entity for images
        const textWithImage = `![Image](${imageUrl})`;
        const contentWithImage = Modifier.insertText(
          contentState,
          selectionState,
          textWithImage
        );
        
        const newEditorState = EditorState.push(
          editorState,
          contentWithImage,
          'insert-characters'
        );
        
        setEditorState(newEditorState);
      }
    } catch (error) {
      console.error('Error inserting image:', error);
    }
  };

  // Handle keyboard commands in the editor
  const handleKeyCommand = (command: string, editorState: EditorState) => {
    const newState = RichUtils.handleKeyCommand(editorState, command);
    
    if (newState) {
      setEditorState(newState);
      return 'handled';
    }
    
    return 'not-handled';
  };

  // Save the current note
  const handleSave = async () => {
    if (!note || readOnly) return;
    
    setSaveStatus('saving');
    setIsSaving(true);
    
    try {
      const contentState = editorState.getCurrentContent();
      const rawContent = JSON.stringify(convertToRaw(contentState));
      
      // Save to server
      await onSave({
        id: note.id,
        title,
        content: rawContent,
      });
      
      // Broadcast changes to other users
      if (socket && isConnected) {
        socket.emit('note-update', {
          noteId: note.id,
          content: rawContent,
          localVersion: docVersion,
          shouldSave: true
        });
      }
      
      setSaveStatus('saved');
      setLocalChanges(false);
      
      // Update document version
      setDocVersion(prev => prev + 1);
    } catch (error) {
      console.error('Error saving note:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Send updates for real-time collaboration
  const broadcastChanges = useCallback(
    (editorState: EditorState) => {
      if (!socket || !isConnected || !note?.id) return;
      
      const contentState = editorState.getCurrentContent();
      const rawContent = JSON.stringify(convertToRaw(contentState));
      
      socket.emit('note-update', {
        noteId: note.id,
        content: rawContent,
        localVersion: docVersion,
        shouldSave: false
      });
    },
    [socket, isConnected, note?.id, docVersion]
  );
  
  // Debounced onChange handler for the editor
  const handleEditorChange = useCallback(
    (newEditorState: EditorState) => {
      setEditorState(newEditorState);
      
      // Check if content actually changed to avoid unnecessary broadcasts
      const currentContent = editorState.getCurrentContent();
      const newContent = newEditorState.getCurrentContent();
      
      if (currentContent !== newContent) {
        // Debounce broadcasting changes
        if (throttleRef.current) {
          clearTimeout(throttleRef.current);
        }
        
        throttleRef.current = setTimeout(() => {
          broadcastChanges(newEditorState);
        }, 300); // 300ms debounce
      }
    },
    [editorState, broadcastChanges]
  );

  // Handle toolbar button clicks for formatting
  const toggleInlineStyle = (style: string) => {
    setEditorState(RichUtils.toggleInlineStyle(editorState, style));
  };

  const toggleBlockType = (blockType: string) => {
    setEditorState(RichUtils.toggleBlockType(editorState, blockType));
  };

  // Handle image paste
  const handlePaste = (text: string, html: string | undefined, editorState: EditorState): 'handled' | 'not-handled' => {
    // We could implement image paste handling here
    // For now, we'll just use the default paste behavior
    return 'not-handled';
  };

  // Handle image upload
  const handleImageUpload = (file: File, insertPosition: number) => {
    if (!socket || !isConnected || !note?.id) return;
    
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Announce upload started
    socket.emit('image-upload-started', {
      noteId: note.id,
      imageId,
      filename: file.name,
      size: file.size
    });
    
    // Simulate upload progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;
      
      // Update local state
      setImageUploads(prev => ({
        ...prev,
        [imageId]: {
          id: imageId,
          filename: file.name,
          size: file.size,
          progress,
          status: progress < 100 ? 'uploading' : 'complete'
        }
      }));
      
      // Broadcast progress
      socket.emit('image-upload-progress', {
        noteId: note.id,
        imageId,
        progress
      });
      
      if (progress >= 100) {
        clearInterval(progressInterval);
        
        // Simulate a URL for the uploaded image
        const imageUrl = `https://example.com/uploads/${imageId}`;
        
        // Insert the image at the specified position
        insertImageAtPosition(imageUrl, insertPosition);
        
        // Broadcast upload complete with the position to insert
        socket.emit('image-upload-complete', {
          noteId: note.id,
          imageId,
          url: imageUrl,
          insertPosition
        });
      }
    }, 300);
  };

  // Focus the editor
  const focusEditor = () => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
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
            {activeUsers.map((user) => (
              <UserPresence key={user.id} user={user} />
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
          <div key={upload.id} className="mb-2 bg-surface rounded p-2 text-sm">
            <div className="flex justify-between">
              <span>{upload.filename}</span>
              <span>{upload.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div 
                className="bg-primary h-2.5 rounded-full" 
                style={{width: `${upload.progress}%`}}
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
