// ─── Relative-time formatting (no dependency) ───

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** "just now" / "4m ago" / "2h ago" / "yesterday" / "3d ago" / "2w ago" / "1y ago". */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const d = now - t;
  if (d < MIN) return 'just now';
  if (d < HOUR) return `${Math.floor(d / MIN)}m ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h ago`;
  if (d < 2 * DAY) return 'yesterday';
  if (d < WEEK) return `${Math.floor(d / DAY)}d ago`;
  if (d < MONTH) return `${Math.floor(d / WEEK)}w ago`;
  if (d < YEAR) return `${Math.floor(d / MONTH)}mo ago`;
  return `${Math.floor(d / YEAR)}y ago`;
}

/** Coarser age label for the "stale knowledge" surface: "14 months old" / "1 year old". */
export function staleAge(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const d = now - t;
  const months = Math.floor(d / MONTH);
  const years = Math.floor(d / YEAR);
  if (years >= 1) return years === 1 ? '1 year old' : `${years} years old`;
  if (months >= 1) return months === 1 ? '1 month old' : `${months} months old`;
  return `${Math.max(1, Math.floor(d / DAY))} days old`;
}

/** "FRIDAY · JUN 12, 2026" eyebrow for the dashboard greeting. */
export function dashboardDate(now: number = Date.now()): string {
  const d = new Date(now);
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Greeting by local hour. */
export function greeting(now: number = Date.now()): string {
  const h = new Date(now).getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Human file size: "184 KB" / "1.1 MB". */
export function fileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
