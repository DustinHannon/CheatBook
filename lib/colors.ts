// ─── Color helpers: member avatar derivation + stable per-user color ───

const PALETTE = [
  '#6ea8fe', '#b794f6', '#5eead4', '#fbbf72',
  '#fb87a4', '#7dd3fc', '#86efac', '#f6c177',
];

/** rgba() string from a hex color + alpha. */
export function hexa(hex: string, a: number): string {
  const h = (hex || '#6ea8fe').replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Deterministic palette color from a user id (fallback when profile.color unset). */
export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Initials from a display name. */
export function initials(name: string | null | undefined): string {
  const n = (name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Avatar visual tokens derived from a member's stable color. */
export function avatarTokens(color: string) {
  return {
    color,
    bg: hexa(color, 0.18),
    ring: hexa(color, 0.35),
  };
}
