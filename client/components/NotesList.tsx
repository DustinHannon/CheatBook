import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  PlusIcon, 
  FolderIcon, 
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

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

interface NotebookType {
  id: string;
  title: string;
  description?: string;
  owner_id: string;
  note_count: number;
  updated_at: string;
}

interface NotesListProps {
  notebooks: NotebookType[];
  notes: NoteType[];
  selectedNoteId?: string;
  onCreateNote: () => void;
  onCreateNotebook: () => void;
}

/**
 * NotesList Component
 * Displays a sidebar list of notebooks and notes
 */
const NotesList: React.FC<NotesListProps> = ({
  notebooks,
  notes,
  selectedNoteId,
  onCreateNote,
  onCreateNotebook,
}) => {
  const router = useRouter();
  const [expandedNotebooks, setExpandedNotebooks] = useState<{ [key: string]: boolean }>({});
  const [showAllNotes, setShowAllNotes] = useState(true);

  // Toggle notebook expansion
  const toggleNotebook = (notebookId: string) => {
    setExpandedNotebooks(prev => ({
      ...prev,
      [notebookId]: !prev[notebookId]
    }));
  };

  // Toggle all notes section
  const toggleAllNotes = () => {
    setShowAllNotes(!showAllNotes);
  };

  // Format date as relative time (e.g., "2 hours ago")
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) {
      return diffDay === 1 ? 'Yesterday' : `${diffDay} days ago`;
    } else if (diffHour > 0) {
      return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    } else if (diffMin > 0) {
      return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    } else {
      return 'Just now';
    }
  };

  // Get notes for a specific notebook
  const getNotesForNotebook = (notebookId: string) => {
    return notes.filter(note => note.notebook_id === notebookId);
  };

  // Get notes without a notebook
  const getUncategorizedNotes = () => {
    return notes.filter(note => !note.notebook_id);
  };

  // Get recent notes (limited to 5)
  const getRecentNotes = () => {
    return [...notes]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  };

  return (
    <div className="w-full h-full bg-background-secondary border-r border-border overflow-y-auto">
      {/* Header with actions */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <h2 className="text-lg font-medium text-text-primary">Notes</h2>
        <div className="flex space-x-2">
          <button
            onClick={onCreateNote}
            className="p-2 rounded-full bg-primary-light text-primary hover:bg-primary hover:text-white transition-colors"
            title="Create new note"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
          <button
            onClick={onCreateNotebook}
            className="p-2 rounded-full bg-primary-light text-primary hover:bg-primary hover:text-white transition-colors"
            title="Create new notebook"
          >
            <FolderIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Recent Notes Section */}
      <div className="mb-4">
        <div 
          className="flex items-center px-4 py-3 cursor-pointer hover:bg-surface-hover"
          onClick={toggleAllNotes}
        >
          {showAllNotes ? (
            <ChevronDownIcon className="h-4 w-4 text-text-secondary mr-2" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-text-secondary mr-2" />
          )}
          <span className="font-medium text-text-primary">Recent Notes</span>
        </div>

        {showAllNotes && (
          <div className="space-y-1 pb-2">
            {getRecentNotes().map(note => (
              <Link
                key={note.id}
                href={`/notes/${note.id}`}
                className={`block px-6 py-2 hover:bg-surface-hover ${
                  selectedNoteId === note.id ? 'bg-surface-active border-l-2 border-primary' : ''
                }`}
              >
                <div className="flex items-center">
                  <DocumentTextIcon className="h-4 w-4 text-text-secondary mr-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{note.title || 'Untitled'}</p>
                    <p className="text-xs text-text-tertiary flex items-center">
                      <span className="truncate">{formatRelativeTime(note.updated_at)}</span>
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Notebooks Section */}
      <div className="mb-4">
        <h3 className="px-4 py-2 text-sm font-medium text-text-tertiary uppercase tracking-wider">
          Notebooks
        </h3>
        <div className="space-y-1">
          {notebooks.map(notebook => (
            <div key={notebook.id}>
              <div 
                className="flex items-center px-4 py-2 cursor-pointer hover:bg-surface-hover"
                onClick={() => toggleNotebook(notebook.id)}
              >
                {expandedNotebooks[notebook.id] ? (
                  <ChevronDownIcon className="h-4 w-4 text-text-secondary mr-2" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-text-secondary mr-2" />
                )}
                <FolderIcon className="h-5 w-5 text-primary mr-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{notebook.title}</p>
                </div>
                <span className="text-xs text-text-tertiary">{notebook.note_count}</span>
              </div>

              {expandedNotebooks[notebook.id] && (
                <div className="space-y-1 pb-2">
                  {getNotesForNotebook(notebook.id).map(note => (
                    <Link
                      key={note.id}
                      href={`/notes/${note.id}`}
                      className={`block pl-10 pr-4 py-2 hover:bg-surface-hover ${
                        selectedNoteId === note.id ? 'bg-surface-active border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <DocumentTextIcon className="h-4 w-4 text-text-secondary mr-2" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{note.title || 'Untitled'}</p>
                          <p className="text-xs text-text-tertiary">{formatRelativeTime(note.updated_at)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      router.push(`/notebooks/${notebook.id}/new`);
                    }}
                    className="block w-full text-left pl-10 pr-4 py-2 hover:bg-surface-hover"
                  >
                    <div className="flex items-center text-primary">
                      <PlusIcon className="h-4 w-4 mr-2" />
                      <span className="text-sm">Add note</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Uncategorized Notes Section */}
      <div className="mb-4">
        <h3 className="px-4 py-2 text-sm font-medium text-text-tertiary uppercase tracking-wider">
          Uncategorized
        </h3>
        <div className="space-y-1">
          {getUncategorizedNotes().map(note => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className={`block px-6 py-2 hover:bg-surface-hover ${
                selectedNoteId === note.id ? 'bg-surface-active border-l-2 border-primary' : ''
              }`}
            >
              <div className="flex items-center">
                <DocumentTextIcon className="h-4 w-4 text-text-secondary mr-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{note.title || 'Untitled'}</p>
                  <p className="text-xs text-text-tertiary">{formatRelativeTime(note.updated_at)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotesList; 