import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Notebook {
  id: string;
  title: string;
}

interface CreateNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (notebookId: string, title: string) => void;
  notebooks: Notebook[];
}

const CreateNoteDialog: React.FC<CreateNoteDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
  notebooks,
}) => {
  const [title, setTitle] = useState('');
  const [selectedNotebookId, setSelectedNotebookId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSelectedNotebookId(notebooks.length > 0 ? notebooks[0].id : '');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, notebooks]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedNotebookId) return;
    onCreate(selectedNotebookId, title.trim());
    setTitle('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-bg-overlay backdrop-blur-sm animate-dialog-fade-in" onClick={onClose} />
      <div className="relative bg-bg-surface border border-border-default rounded-xl shadow-lg max-w-md w-full mx-4 p-6 animate-dialog-scale-in">
        <h3 className="text-display-sm font-display text-text-primary">Create a Note</h3>
        <p className="text-sm text-text-secondary mt-1">Add a new note to your team.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Notebook selector — only show if multiple notebooks */}
          {notebooks.length > 1 && (
            <div>
              <label className="section-label block mb-2">Notebook</label>
              <select
                value={selectedNotebookId}
                onChange={(e) => setSelectedNotebookId(e.target.value)}
                className="w-full bg-bg-base border border-border-default rounded-lg px-4 py-3 text-text-primary text-sm font-body focus:border-accent focus:ring-0 focus:outline-none appearance-none cursor-pointer"
              >
                {notebooks.map(nb => (
                  <option key={nb.id} value={nb.id}>{nb.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note title */}
          <div>
            <label className="section-label block mb-2">Title</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Printer IPs, VPN Setup, Deploy Script..."
              className="w-full bg-bg-base border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-0 focus:outline-none text-sm font-body"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-bg-surface-hover text-text-secondary rounded-lg px-4 py-2.5 text-sm hover:bg-bg-surface-active transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !selectedNotebookId}
              className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-5 py-2.5 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create Note
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes dialogFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dialogScaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-dialog-fade-in {
          animation: dialogFadeIn 0.2s ease-out both;
        }
        .animate-dialog-scale-in {
          animation: dialogScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </div>
  );
};

export default CreateNoteDialog;
