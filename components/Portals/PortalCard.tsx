import React, { useState } from 'react';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { hexa } from '../../lib/colors';
import { PortalIcon } from '../../lib/portal-icons';
import type { PortalLink, PortalDensity } from '../../lib/types';

interface Props {
  link: PortalLink;
  density: PortalDensity;
  isAdmin: boolean;
  onEdit: (link: PortalLink) => void;
  onDelete: (link: PortalLink) => void;
}

/**
 * A single portal link: a glass card that opens the site in a new tab. Admin
 * edit/delete controls sit as ABSOLUTE siblings of the <a> (never nested — an
 * anchor can't contain buttons) and only intercept clicks while hovered.
 */
export const PortalCard: React.FC<Props> = ({ link, density, isAdmin, onEdit, onDelete }) => {
  const [hover, setHover] = useState(false);
  const compact = density === 'compact';
  const tile = compact ? 32 : 40;
  const color = link.color || '#6ea8fe';

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      // Reveal the admin controls on keyboard focus too (focus-within), so they
      // aren't mouse-only — mirrors SpaceRow's tab-reachable kebab.
      onFocus={() => setHover(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(false); }}
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        title={link.label}
        style={{
          display: 'flex',
          alignItems: compact || !link.description ? 'center' : 'flex-start',
          gap: compact ? 10 : 12,
          padding: compact ? '11px 12px' : '15px',
          borderRadius: 14,
          height: '100%',
          textDecoration: 'none',
          background: hover ? 'var(--bg-hover-2)' : 'var(--bg-hover)',
          border: `1px solid ${hover ? hexa(color, 0.5) : 'var(--hairline)'}`,
          transform: hover ? 'translateY(-2px)' : 'none',
          transition: 'transform .14s ease, border-color .14s ease, background .14s ease',
        }}
      >
        <span
          className="grid flex-none place-items-center"
          style={{ width: tile, height: tile, borderRadius: 10, color, background: hexa(color, 0.16), border: `1px solid ${hexa(color, 0.3)}` }}
        >
          <PortalIcon name={link.icon} size={compact ? 16 : 20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 700, color: 'var(--text-2)' }}>
            {link.label}
          </span>
          {!compact && link.description && (
            <span className="line-clamp-2 block" style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-4)', marginTop: 3 }}>
              {link.description}
            </span>
          )}
        </span>
        {!isAdmin && (
          <ExternalLink
            size={13}
            style={{ flex: '0 0 auto', color: 'var(--text-4)', opacity: hover ? 1 : 0.45, marginTop: compact ? 0 : 2 }}
          />
        )}
      </a>

      {isAdmin && (
        <div
          className="absolute flex gap-1"
          style={{ top: 6, right: 6, opacity: hover ? 1 : 0, transition: 'opacity .14s ease', pointerEvents: hover ? 'auto' : 'none' }}
        >
          <button
            type="button" aria-label={`Edit ${link.label}`} title="Edit" onClick={() => onEdit(link)}
            className="grid place-items-center"
            style={{ width: 24, height: 24, borderRadius: 7, color: 'var(--text-3)', background: 'var(--surface-raised)', border: '1px solid var(--hairline)', cursor: 'pointer' }}
          >
            <Pencil size={12} />
          </button>
          <button
            type="button" aria-label={`Delete ${link.label}`} title="Delete" onClick={() => onDelete(link)}
            className="grid place-items-center"
            style={{ width: 24, height: 24, borderRadius: 7, color: 'var(--danger)', background: 'var(--surface-raised)', border: '1px solid var(--hairline)', cursor: 'pointer' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PortalCard;
