import React, { useState } from 'react';
import {
  PlusIcon,
  FolderIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderPlusIcon,
  DocumentPlusIcon,
} from '@heroicons/react/24/outline';

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
  selectedNotebookId?: string;
  onSelectNote?: (noteId: string) => void;
  onSelectNotebook?: (notebookId: string) => void;
  onCreateNote: () => void;
  onCreateNotebook: () => void;
}

const NotesList: React.FC<NotesListProps> = ({
  notebooks,
  notes,
  selectedNoteId,
  selectedNotebookId,
  onSelectNote,
  onSelectNotebook,
  onCreateNote,
  onCreateNotebook,
}) => {
  const [expandedNotebooks, setExpandedNotebooks] = useState<Record<string, boolean>>({});
  const [showRecentNotes, setShowRecentNotes] = useState(true);
  const [showNotebooks, setShowNotebooks] = useState(true);
  const [showUncategorized, setShowUncategorized] = useState(true);

  const toggleNotebook = (notebookId: string) => {
    setExpandedNotebooks((prev) => ({
      ...prev,
      [notebookId]: !prev[notebookId],
    }));
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) {
      return diffDay === 1 ? 'Yesterday' : `${diffDay}d ago`;
    } else if (diffHour > 0) {
      return `${diffHour}h ago`;
    } else if (diffMin > 0) {
      return `${diffMin}m ago`;
    } else {
      return 'Just now';
    }
  };

  const getNotesForNotebook = (notebookId: string) => {
    return notes.filter((note) => note.notebook_id === notebookId);
  };

  const getUncategorizedNotes = () => {
    return notes.filter((note) => !note.notebook_id);
  };

  const getRecentNotes = () => {
    return [...notes]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  };

  const handleSelectNote = (noteId: string) => {
    if (onSelectNote) {
      onSelectNote(noteId);
    }
  };

  const handleSelectNotebook = (notebookId: string) => {
    if (onSelectNotebook) {
      onSelectNotebook(notebookId);
    }
  };

  const isNoteSelected = (noteId: string) => selectedNoteId === noteId;
  const isNotebookSelected = (notebookId: string) => selectedNotebookId === notebookId;

  return (
    <div className="w-full h-full bg-bg-raised overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <span className="section-label">LIBRARY</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreateNote}
            className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-bg-surface-hover focus:outline-none"
            title="New note"
          >
            <DocumentPlusIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onCreateNotebook}
            className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-bg-surface-hover focus:outline-none"
            title="New notebook"
          >
            <FolderPlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Gold divider */}
      <hr className="divider-gold mx-5" />

      {/* Recent Notes Section */}
      <div className="mt-2">
        <button
          onClick={() => setShowRecentNotes(!showRecentNotes)}
          className="w-full flex items-center gap-2 px-5 py-2 hover:bg-bg-surface-hover focus:outline-none"
        >
          {showRecentNotes ? (
            <ChevronDownIcon className="h-3 w-3 text-text-tertiary shrink-0" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 text-text-tertiary shrink-0" />
          )}
          <span className="section-label">Recent Notes</span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-200 ease-out-expo ${
            showRecentNotes ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {getRecentNotes().map((note) => (
            <button
              key={note.id}
              onClick={() => handleSelectNote(note.id)}
              className={`w-full text-left px-5 pl-8 py-2 hover:bg-bg-surface-hover transition-colors ${
                isNoteSelected(note.id)
                  ? 'border-l-2 border-accent bg-accent-muted'
                  : 'border-l-2 border-transparent'
              }`}
            >
              <p className="text-sm font-medium text-text-primary truncate">
                {note.title || 'Untitled'}
              </p>
              <p className="text-xs text-text-tertiary">{formatRelativeTime(note.updated_at)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Notebooks Section */}
      <div className="mt-2">
        <button
          onClick={() => setShowNotebooks(!showNotebooks)}
          className="w-full flex items-center gap-2 px-5 py-2 hover:bg-bg-surface-hover focus:outline-none"
        >
          {showNotebooks ? (
            <ChevronDownIcon className="h-3 w-3 text-text-tertiary shrink-0" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 text-text-tertiary shrink-0" />
          )}
          <span className="section-label">Notebooks</span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-200 ease-out-expo ${
            showNotebooks ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {notebooks.map((notebook) => (
            <div key={notebook.id}>
              {/* Notebook row */}
              <button
                onClick={() => {
                  toggleNotebook(notebook.id);
                  handleSelectNotebook(notebook.id);
                }}
                className={`w-full text-left flex items-center px-5 py-2 hover:bg-bg-surface-hover transition-colors ${
                  isNotebookSelected(notebook.id)
                    ? 'border-l-2 border-accent bg-accent-muted'
                    : 'border-l-2 border-transparent'
                }`}
              >
                {expandedNotebooks[notebook.id] ? (
                  <ChevronDownIcon className="h-3 w-3 text-text-tertiary mr-2 shrink-0" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3 text-text-tertiary mr-2 shrink-0" />
                )}
                <FolderIcon className="h-4 w-4 text-accent mr-2 shrink-0" />
                <span className="text-sm font-medium text-text-primary truncate flex-1">
                  {notebook.title}
                </span>
                <span className="text-xs text-text-tertiary ml-2 shrink-0">
                  {notebook.note_count}
                </span>
              </button>

              {/* Expanded notebook notes */}
              <div
                className={`overflow-hidden transition-all duration-200 ease-out-expo ${
                  expandedNotebooks[notebook.id]
                    ? 'max-h-[1000px] opacity-100'
                    : 'max-h-0 opacity-0'
                }`}
              >
                {getNotesForNotebook(notebook.id).map((note) => (
                  <button
                    key={note.id}
                    onClick={() => handleSelectNote(note.id)}
                    className={`w-full text-left px-5 pl-12 py-2 hover:bg-bg-surface-hover transition-colors ${
                      isNoteSelected(note.id)
                        ? 'border-l-2 border-accent bg-accent-muted'
                        : 'border-l-2 border-transparent'
                    }`}
                  >
                    <p className="text-sm font-medium text-text-primary truncate">
                      {note.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {formatRelativeTime(note.updated_at)}
                    </p>
                  </button>
                ))}

                {/* Add note button inside notebook */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateNote();
                  }}
                  className="w-full text-left px-5 pl-12 py-2 hover:bg-bg-surface-hover flex items-center gap-1.5 text-text-tertiary hover:text-accent transition-colors"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span className="text-xs">Add note</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Uncategorized Section */}
      <div className="mt-2 mb-4">
        <button
          onClick={() => setShowUncategorized(!showUncategorized)}
          className="w-full flex items-center gap-2 px-5 py-2 hover:bg-bg-surface-hover focus:outline-none"
        >
          {showUncategorized ? (
            <ChevronDownIcon className="h-3 w-3 text-text-tertiary shrink-0" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 text-text-tertiary shrink-0" />
          )}
          <span className="section-label">Uncategorized</span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-200 ease-out-expo ${
            showUncategorized ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {getUncategorizedNotes().map((note) => (
            <button
              key={note.id}
              onClick={() => handleSelectNote(note.id)}
              className={`w-full text-left px-5 pl-8 py-2 hover:bg-bg-surface-hover transition-colors ${
                isNoteSelected(note.id)
                  ? 'border-l-2 border-accent bg-accent-muted'
                  : 'border-l-2 border-transparent'
              }`}
            >
              <p className="text-sm font-medium text-text-primary truncate">
                {note.title || 'Untitled'}
              </p>
              <p className="text-xs text-text-tertiary">{formatRelativeTime(note.updated_at)}</p>
            </button>
          ))}

          {getUncategorizedNotes().length === 0 && (
            <p className="px-5 pl-8 py-2 text-xs text-text-tertiary">No uncategorized notes</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesList;
