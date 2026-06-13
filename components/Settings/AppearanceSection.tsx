import React from 'react';
import { useAppearance } from '../AppearanceContext';
import type { Density } from '../../lib/types';
import { SectionHead, Eyebrow } from './parts';

const ACCENTS = ['#6ea8fe', '#b794f6', '#5eead4', '#fbbf72'] as const;
const DENSITIES: Density[] = ['compact', 'balanced', 'spacious'];

const Check: React.FC<{ stroke: string; size?: number; width?: number }> = ({ stroke, size = 18, width = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
);

/** Appearance: theme cards (Glass Dark active / Light soon), accent swatches, density picker — all live. */
export const AppearanceSection: React.FC = () => {
  const { appearance, setAccent, setDensity } = useAppearance();

  return (
    <>
      <SectionHead
        title="Appearance"
        lead="Tune how CheatBook looks. Changes preview instantly and apply across your devices."
      />

      {/* THEME */}
      <Eyebrow style={{ marginBottom: 10 }}>THEME</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 26 }}>
        {/* Glass Dark — active */}
        <div
          style={{
            position: 'relative',
            padding: 14,
            borderRadius: 14,
            background: 'rgba(110,168,254,0.08)',
            border: '1.5px solid rgba(110,168,254,0.5)',
          }}
        >
          <div
            style={{
              height: 60,
              borderRadius: 9,
              marginBottom: 11,
              background: 'linear-gradient(140deg,#0b0f17,#10151f)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 0 22px rgba(70,120,225,0.25)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#eef2f8' }}>Glass Dark</span>
            <Check stroke="#6ea8fe" size={15} width={2.4} />
          </div>
        </div>
        {/* Light — disabled, SOON */}
        <div
          aria-disabled="true"
          style={{
            position: 'relative',
            padding: 14,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.08)',
            opacity: 0.55,
          }}
        >
          <div
            style={{
              height: 60,
              borderRadius: 9,
              marginBottom: 11,
              background: 'linear-gradient(140deg,#e7ecf3,#cdd6e3)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#cdd6e3' }}>Light</span>
            <span
              className="font-mono"
              style={{ fontSize: 9, color: '#6f7c92', padding: '2px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.06)' }}
            >
              SOON
            </span>
          </div>
        </div>
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
                  <span style={{ position: 'absolute', inset: -4, borderRadius: 15, border: '2px solid #fff', opacity: 0.85 }} />
                  <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                    <Check stroke="#0a0f1a" size={18} width={3} />
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
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#b6c0d0',
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
              <span style={{ position: 'relative', color: selected ? '#eef2f8' : '#b6c0d0' }}>
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
