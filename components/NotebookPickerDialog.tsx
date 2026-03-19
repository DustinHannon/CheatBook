import React, { useEffect, useCallback } from 'react';
import { FolderIcon } from '@heroicons/react/24/outline';

interface Notebook {
  id: string;
  title: string;
  note_count?: number;
}

interface NotebookPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (notebookId: string) => void;
  notebooks: Notebook[];
}

const NotebookPickerDialog: React.FC<NotebookPickerDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  notebooks,
}) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-bg-overlay backdrop-blur-sm animate-dialog-fade-in" onClick={onClose} />
      <div className="relative bg-bg-surface border border-border-default rounded-xl shadow-lg max-w-sm w-full mx-4 p-6 animate-dialog-scale-in">
        <h3 className="text-display-sm font-display text-text-primary">Choose a notebook</h3>
        <p className="text-sm text-text-secondary mt-1">Where should the new note go?</p>

        <div className="mt-5 space-y-1 max-h-[300px] overflow-y-auto">
          {notebooks.map(nb => (
            <button
              key={nb.id}
              onClick={() => onSelect(nb.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-bg-surface-hover transition-colors group"
            >
              <FolderIcon className="w-5 h-5 text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">{nb.title}</div>
                <div className="text-xs text-text-tertiary">
                  {nb.note_count || 0} {(nb.note_count || 0) === 1 ? 'note' : 'notes'}
                </div>
              </div>
              <svg className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="w-full text-sm text-text-secondary hover:text-text-primary transition text-center py-2"
          >
            Cancel
          </button>
        </div>
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

export default NotebookPickerDialog;
