import React, { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { hexa } from '../../lib/colors';
import { PortalIcon, PORTAL_ICON_KEYS, PORTAL_PALETTE } from '../../lib/portal-icons';
import type { PortalCategory, PortalLink } from '../../lib/types';

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 14px', borderRadius: 11,
  background: 'var(--surface-input)', border: '1px solid var(--hairline)', outline: 'none',
  color: 'var(--text-strong)', fontSize: 14, fontFamily: "'Manrope',sans-serif",
};

const FieldLabel: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="cb-mono" style={{ marginTop: 18, marginBottom: 8, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)' }}>
    {children}
  </div>
);

const CancelBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button type="button" onClick={onClick}
    style={{ height: 40, minHeight: 44, padding: '0 16px', borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text-2)', background: 'var(--bg-hover)', border: '1px solid var(--hairline)' }}>
    Cancel
  </button>
);

const SaveBtn: React.FC<{ disabled?: boolean; label?: string; onClick: () => void }> = ({ disabled, label = 'Save', onClick }) => (
  <button type="button" disabled={disabled} onClick={onClick}
    style={{ height: 40, minHeight: 44, padding: '0 18px', borderRadius: 11, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text-on-accent)', background: 'var(--accent-grad)', border: 'none', opacity: disabled ? 0.5 : 1 }}>
    {label}
  </button>
);

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

/** Shared glass modal shell (mirrors ConfirmDialog): backdrop click + Escape close, focus restore, Tab trapped within the panel. */
const PortalModal: React.FC<{ title: string; onClose: () => void; children: ReactNode; footer: ReactNode }> = ({ title, onClose, children, footer }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    return () => { restoreRef.current?.focus?.(); };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={onKeyDown}
      style={{ position: 'fixed', inset: 0, zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--backdrop)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-labelledby={titleId} className="animate-cb-up"
        style={{ width: 'min(460px,92vw)', maxHeight: '90vh', overflowY: 'auto', borderRadius: 18, padding: '24px 24px 20px', background: 'var(--modal-grad)', backdropFilter: 'blur(40px) saturate(170%)', WebkitBackdropFilter: 'blur(40px) saturate(170%)', border: '1px solid var(--modal-border)', boxShadow: 'var(--modal-shadow)' }}
      >
        <h2 id={titleId} style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>{title}</h2>
        {children}
        <div style={{ display: 'flex', gap: 10, marginTop: 24, alignItems: 'center' }}>{footer}</div>
      </div>
    </div>
  );
};

const IconPicker: React.FC<{ value: string; color: string; onChange: (k: string) => void }> = ({ value, color, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, maxHeight: 168, overflowY: 'auto', padding: 2 }}>
    {PORTAL_ICON_KEYS.map((k) => {
      const sel = k === value;
      return (
        <button
          key={k} type="button" aria-label={k} aria-pressed={sel} title={k} onClick={() => onChange(k)}
          className="grid place-items-center"
          style={{ height: 34, borderRadius: 9, cursor: 'pointer', color: sel ? color : 'var(--text-3)', background: sel ? hexa(color, 0.16) : 'var(--bg-hover)', border: sel ? `1px solid ${hexa(color, 0.55)}` : '1px solid var(--hairline)' }}
        >
          <PortalIcon name={k} size={16} />
        </button>
      );
    })}
  </div>
);

const ColorSwatches: React.FC<{ value: string; onChange: (c: string) => void }> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="Color" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
    {PORTAL_PALETTE.map((c) => {
      const sel = value.toLowerCase() === c.toLowerCase();
      return (
        <button
          key={c} type="button" role="radio" aria-checked={sel} aria-label={`Color ${c}`} onClick={() => onChange(c)}
          style={{ width: 32, height: 32, borderRadius: 9, cursor: 'pointer', padding: 0, background: c, border: sel ? '2px solid var(--text-strong)' : '2px solid transparent', boxShadow: `0 0 10px ${hexa(c, 0.5)}` }}
        />
      );
    })}
  </div>
);

// Accept a bare host ("vcenter.example.com") or a full URL; force http(s) only.
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch { /* not a URL */ }
  return null;
}

// ─── Category dialog ───
export const CategoryDialog: React.FC<{
  initial?: PortalCategory | null;
  onSubmit: (v: { name: string; color: string; icon: string }) => void;
  onClose: () => void;
}> = ({ initial, onSubmit, onClose }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? PORTAL_PALETTE[0]);
  const [icon, setIcon] = useState(initial?.icon ?? 'folder');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const id = requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); }); return () => cancelAnimationFrame(id); }, []);

  const trimmed = name.trim();
  const submit = () => { if (trimmed) onSubmit({ name: trimmed, color, icon }); };

  return (
    <PortalModal
      title={initial ? 'Edit category' : 'New category'}
      onClose={onClose}
      footer={<><div style={{ flex: 1 }} /><CancelBtn onClick={onClose} /><SaveBtn disabled={!trimmed} onClick={submit} /></>}
    >
      <FieldLabel>Name</FieldLabel>
      <input
        ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && trimmed) { e.preventDefault(); submit(); } }}
        aria-label="Category name" autoComplete="off" placeholder="e.g. Infrastructure" style={inputStyle}
      />
      <FieldLabel>Icon</FieldLabel>
      <IconPicker value={icon} color={color} onChange={setIcon} />
      <FieldLabel>Color</FieldLabel>
      <ColorSwatches value={color} onChange={setColor} />
    </PortalModal>
  );
};

// ─── Link dialog ───
export const LinkDialog: React.FC<{
  initial?: PortalLink | null;
  categories: PortalCategory[];
  defaultCategoryId?: string;
  onSubmit: (v: { label: string; url: string; description: string | null; icon: string; color: string; categoryId: string }) => void;
  onClose: () => void;
}> = ({ initial, categories, defaultCategoryId, onSubmit, onClose }) => {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'globe');
  const [color, setColor] = useState(initial?.color ?? PORTAL_PALETTE[0]);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const id = requestAnimationFrame(() => inputRef.current?.focus()); return () => cancelAnimationFrame(id); }, []);

  const trimmedLabel = label.trim();
  const normalized = normalizeUrl(url);
  const valid = !!trimmedLabel && !!normalized && !!categoryId;
  const submit = () => { if (valid) onSubmit({ label: trimmedLabel, url: normalized as string, description: description.trim() || null, icon, color, categoryId }); };

  return (
    <PortalModal
      title={initial ? 'Edit link' : 'Add link'}
      onClose={onClose}
      footer={<><div style={{ flex: 1 }} /><CancelBtn onClick={onClose} /><SaveBtn disabled={!valid} label={initial ? 'Save' : 'Add link'} onClick={submit} /></>}
    >
      <FieldLabel>Label</FieldLabel>
      <input ref={inputRef} value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Link label" autoComplete="off" placeholder="e.g. vCenter" style={inputStyle} />
      <FieldLabel>URL</FieldLabel>
      <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link URL" autoComplete="off" placeholder="https://…" inputMode="url" style={inputStyle} />
      <FieldLabel>Description (optional)</FieldLabel>
      <input value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Link description (optional)" autoComplete="off" placeholder="Short note shown on the card" maxLength={280} style={inputStyle} />
      <FieldLabel>Category</FieldLabel>
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category" style={{ ...inputStyle, cursor: 'pointer' }}>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <FieldLabel>Icon</FieldLabel>
      <IconPicker value={icon} color={color} onChange={setIcon} />
      <FieldLabel>Color</FieldLabel>
      <ColorSwatches value={color} onChange={setColor} />
    </PortalModal>
  );
};
