import React, { useEffect, useRef, useCallback } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Modal shell values lifted verbatim from the command-palette modal in
// designideas/design-references/CheatBook.dc.html (lines 523–524).
const BACKDROP_STYLE: React.CSSProperties = {
  background: 'var(--backdrop)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
};
const PANEL_STYLE: React.CSSProperties = {
  background: 'var(--modal-grad)',
  backdropFilter: 'blur(40px) saturate(170%)',
  WebkitBackdropFilter: 'blur(40px) saturate(170%)',
  border: '1px solid var(--modal-border)',
  boxShadow: 'var(--modal-shadow)',
};

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

/**
 * Glass confirmation modal: centered over a blurred, dimmed backdrop.
 * Click-out + Esc cancel. Confirm button is focused on open; focus is trapped.
 * `danger` turns the confirm button pink (#fb87a4).
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Focus the confirm button on open; restore focus on close.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const id = requestAnimationFrame(() => confirmRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  // Esc closes; Tab is trapped within the panel.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onCancel],
  );

  if (!open) return null;

  const confirmGrad = danger
    ? 'linear-gradient(160deg,color-mix(in srgb,var(--danger) 80%,#fff),var(--danger))'
    : 'var(--accent-grad)';

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        ...BACKDROP_STYLE,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cb-confirm-title"
        aria-describedby={message ? 'cb-confirm-message' : undefined}
        className="animate-cb-up"
        style={{
          width: 'min(420px,92vw)',
          borderRadius: 18,
          overflow: 'hidden',
          padding: '24px 24px 20px',
          ...PANEL_STYLE,
        }}
      >
        <h2
          id="cb-confirm-title"
          className="font-sans"
          style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}
        >
          {title}
        </h2>
        {message && (
          <p
            id="cb-confirm-message"
            style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-3)' }}
          >
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 40,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-2)',
              background: 'var(--bg-hover)',
              border: '1px solid var(--hairline)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 40,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-on-accent)',
              background: confirmGrad,
              border: 'none',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
