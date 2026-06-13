import React from 'react';
import { useAppearance } from '../AppearanceContext';
import type { Density, Theme } from '../../lib/types';
import { SectionHead, Eyebrow } from './parts';

const ACCENTS = ['#6ea8fe', '#b794f6', '#5eead4', '#fbbf72'] as const;
const DENSITIES: Density[] = ['compact', 'balanced', 'spacious'];

const Check: React.FC<{ stroke: string; size?: number; width?: number }> = ({ stroke, size = 18, width = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
);

const THEMES: { key: Theme; label: string; preview: string }[] = [
  { key: 'dark', label: 'Glass Dark', preview: 'linear-gradient(140deg,#0b0f17,#10151f)' },
  { key: 'light', label: 'Light', preview: 'linear-gradient(140deg,#ffffff,#e3e8f0)' },
];

/** Appearance: theme cards (Glass Dark / Light), accent swatches, density picker — all live. */
export const AppearanceSection: React.FC = () => {
  const { appearance, setAccent, setDensity, setTheme } = useAppearance();

  return (
    <>
      <SectionHead
        title="Appearance"
        lead="Tune how CheatBook looks. Changes preview instantly and apply across your devices."
      />

      {/* THEME */}
      <Eyebrow style={{ marginBottom: 10 }}>THEME</Eyebrow>
      <div role="radiogroup" aria-label="Theme" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 26 }}>
        {THEMES.map((t) => {
          const selected = appearance.theme === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t.label}
              onClick={() => setTheme(t.key)}
              style={{
                position: 'relative',
                padding: 14,
                borderRadius: 14,
                cursor: 'pointer',
                textAlign: 'left',
                background: selected ? 'var(--accent-soft)' : 'var(--bg-hover)',
                border: selected ? '1.5px solid var(--accent)' : '1px solid var(--hairline)',
              }}
            >
              <div
                style={{
                  height: 60,
                  borderRadius: 9,
                  marginBottom: 11,
                  background: t.preview,
                  border: '1px solid var(--hairline)',
                  boxShadow: t.key === 'dark' ? 'inset 0 0 22px rgba(70,120,225,0.25)' : 'inset 0 0 22px rgba(110,168,254,0.12)',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{t.label}</span>
                {selected && <Check stroke="var(--accent)" size={15} width={2.4} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* ACCENT */}
      <Eyebrow style={{ marginBottom: 10 }}>ACCENT</Eyebrow>
      <div role="radiogroup" aria-label="Accent color" style={{ display: 'flex', gap: 12, marginBottom: 26 }}>
        {ACCENTS.map((c) => {
          const selected = appearance.accent.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Accent ${c}`}
              onClick={() => setAccent(c)}
              className="cb-set-accent"
              style={{
                position: 'relative',
                width: 44,
                height: 44,
                borderRadius: 12,
                cursor: 'pointer',
                padding: 0,
                border: 'none',
                background: c,
              }}
            >
              {selected && (
                <>
                  <span style={{ position: 'absolute', inset: -4, borderRadius: 15, border: '2px solid var(--text-strong)', opacity: 0.85 }} />
                  <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                    <Check stroke="var(--text-on-accent)" size={18} width={3} />
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* DENSITY */}
      <Eyebrow style={{ marginBottom: 10 }}>DENSITY</Eyebrow>
      <div role="radiogroup" aria-label="Density" style={{ display: 'flex', gap: 10 }}>
        {DENSITIES.map((d) => {
          const selected = appearance.density === d;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setDensity(d)}
              className="cb-set-density"
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 44,
                padding: 13,
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                background: 'var(--surface-input)',
                border: '1px solid var(--hairline)',
                color: 'var(--text-2)',
              }}
            >
              {selected && (
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 12,
                    background: 'var(--accent-soft)',
                    border: '1.5px solid rgba(110,168,254,0.5)',
                  }}
                />
              )}
              <span style={{ position: 'relative', color: selected ? 'var(--text-strong)' : 'var(--text-2)' }}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default AppearanceSection;
