import React from 'react';

// ─── Shared Settings primitives ───────────────────────────────────────
// Visual values lifted verbatim from designideas/design-references/Settings.dc.html.

/** Uppercase mono eyebrow label (e.g. "THEME", "ACTIVE SESSIONS"). */
export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({
  children, className = '', style,
}) => (
  <div
    className={`font-mono ${className}`}
    style={{
      fontSize: 9.5,
      letterSpacing: '0.12em',
      color: '#6f7c92',
      ...style,
    }}
  >
    {children}
  </div>
);

/** Section heading + lead paragraph block used atop every section. */
export const SectionHead: React.FC<{ title: string; lead: string }> = ({ title, lead }) => (
  <>
    <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#e7ecf3' }}>
      {title}
    </h2>
    <p style={{ margin: '0 0 26px', fontSize: 13, color: '#8b97ab', lineHeight: 1.55 }}>{lead}</p>
  </>
);

/** Labeled text input. Mono uppercase label + dark inset field with accent focus ring. */
export const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  full?: boolean;
  type?: 'text' | 'email';
  autoComplete?: string;
}> = ({ label, value, onChange, placeholder, full, type = 'text', autoComplete }) => {
  const id = `cb-set-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label
        htmlFor={id}
        className="font-mono"
        style={{ display: 'block', fontSize: 9.5, letterSpacing: '0.1em', color: '#9aa6ba', marginBottom: 7 }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="cb-set-input"
        style={{
          width: '100%',
          height: 44,
          padding: '0 13px',
          borderRadius: 11,
          background: 'rgba(8,11,18,0.45)',
          border: '1px solid rgba(255,255,255,0.1)',
          outline: 'none',
          color: '#eef2f8',
          fontSize: 13.5,
        }}
      />
    </div>
  );
};

/** Sliding toggle switch — accent track when on, neutral knob when off. */
export const Toggle: React.FC<{ on: boolean; onToggle: () => void; label: string }> = ({ on, onToggle, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onToggle}
    style={{
      position: 'relative',
      width: 44,
      height: 26,
      borderRadius: 20,
      flex: '0 0 auto',
      cursor: 'pointer',
      padding: 0,
      border: 'none',
      background: on ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
      transition: 'background 0.16s ease',
    }}
  >
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 3,
        left: on ? 21 : 3,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: on ? '#fff' : '#aeb9ca',
        boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
        transition: 'left 0.16s ease, background 0.16s ease',
      }}
    />
  </button>
);

/** One row inside a grouped toggle list (label + description + switch). */
export const ToggleRow: React.FC<{
  label: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
}> = ({ label, desc, on, onToggle }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.025)' }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#eef2f8' }}>{label}</div>
      <div style={{ fontSize: 11.5, color: '#8b97ab', marginTop: 2 }}>{desc}</div>
    </div>
    <Toggle on={on} onToggle={onToggle} label={label} />
  </div>
);

/** Stacked rows container with hairline dividers and a rounded clip (the "card list"). */
export const RowList: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.07)',
      ...style,
    }}
  >
    {children}
  </div>
);

/** A single read-only "label · value · optional pill" row (account identity table). */
export const InfoRow: React.FC<{ label: string; value: React.ReactNode; pill?: string }> = ({ label, value, pill }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.025)' }}>
    <span style={{ fontSize: 12.5, color: '#8b97ab', width: 120, flex: '0 0 auto' }}>{label}</span>
    <span style={{ flex: 1, fontSize: 13.5, color: '#eef2f8' }}>{value}</span>
    {pill && (
      <span
        className="font-mono"
        style={{ fontSize: 9.5, color: '#6f7c92', padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)' }}
      >
        {pill}
      </span>
    )}
  </div>
);
