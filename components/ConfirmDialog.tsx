import React, { useEffect, useCallback } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'default';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
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

  const confirmButtonClass =
    confirmVariant === 'danger'
      ? 'bg-status-error text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity'
      : 'bg-accent text-bg-base rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg-overlay animate-confirm-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-surface border border-border-default rounded-xl shadow-lg max-w-sm w-full mx-4 p-6 animate-confirm-scale-in">
        <h3 className="font-semibold text-text-primary text-lg">{title}</h3>
        <p className="text-sm text-text-secondary mt-2">{message}</p>

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="bg-bg-surface-hover text-text-secondary rounded-lg px-4 py-2 text-sm hover:bg-bg-surface-active transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={confirmButtonClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes confirmFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes confirmScaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-confirm-fade-in {
          animation: confirmFadeIn 0.2s ease-out both;
        }
        .animate-confirm-scale-in {
          animation: confirmScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </div>
  );
};

export default ConfirmDialog;
