import React, { useEffect, useRef, useState, useCallback } from 'react';

interface InputDialogProps {
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

// Modal shell values lifted verbatim from the command-palette modal in
// designideas/design-references/CheatBook.dc.html (lines 523–524).
const BACKDROP_STYLE: React.CSSProperties = {
  background: 'rgba(4,6,11,0.6)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
};
const PANEL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg,rgba(26,32,44,0.92),rgba(16,20,30,0.92))',
  backdropFilter: 'blur(40px) saturate(170%)',
  WebkitBackdropFilter: 'blur(40px) saturate(170%)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 40px 100px -30px rgba(0,0,0,0.9),inset 0 1px 0 rgba(255,255,255,0.08)',
};

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

/**
 * Glass input modal: same shell as ConfirmDialog. Labeled text input is
 * autofocused and pre-filled with `initialValue`. Enter submits, Esc / click-out
 * cancel. The trimmed value is passed to onSubmit; empty submissions are ignored.
 */
export const InputDialog: React.FC<InputDialogProps> = ({
  open,
  title,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'Save',
  onSubmit,
  onCancel,
}) => {
  const panelRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(initialValue);

  // Reset + focus + select the prefilled value on each open.
  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(id);
      restoreRef.current?.focus?.();
    };
  }, [open, initialValue]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return; // ignore empty
    onSubmit(trimmed);
  }, [value, onSubmit]);

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

  const trimmedEmpty = value.trim().length === 0;

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
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cb-input-title"
        className="animate-cb-up"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{
          width: 'min(440px,92vw)',
          borderRadius: 18,
          overflow: 'hidden',
          padding: '24px 24px 20px',
          ...PANEL_STYLE,
        }}
      >
        <h2
          id="cb-input-title"
          className="font-sans"
          style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#eef2f8', letterSpacing: '-0.01em' }}
        >
          {title}
        </h2>

        {label && (
          <label
            htmlFor="cb-input-field"
            className="cb-mono"
            style={{
              display: 'block',
              marginTop: 18,
              marginBottom: 8,
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#6f7c92',
            }}
          >
            {label}
          </label>
        )}

        <input
          id="cb-input-field"
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            marginTop: label ? 0 : 18,
            width: '100%',
            height: 44,
            padding: '0 14px',
            borderRadius: 11,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            outline: 'none',
            color: '#eef2f8',
            fontSize: 14,
            fontFamily: "'Manrope',sans-serif",
          }}
        />

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
              color: '#cdd6e3',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={trimmedEmpty}
            style={{
              flex: 1,
              height: 40,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              cursor: trimmedEmpty ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 700,
              color: '#0a0f1a',
              background: 'var(--accent-grad)',
              border: 'none',
              opacity: trimmedEmpty ? 0.5 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InputDialog;
