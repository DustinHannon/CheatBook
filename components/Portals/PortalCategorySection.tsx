import React from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { hexa } from '../../lib/colors';
import { PortalIcon } from '../../lib/portal-icons';
import { PortalCard } from './PortalCard';
import type { PortalCategory, PortalLink, PortalDensity } from '../../lib/types';

interface Props {
  category: PortalCategory;
  density: PortalDensity;
  collapsed: boolean;
  isAdmin: boolean;
  onToggle: () => void;
  onAddLink: (categoryId: string) => void;
  onEditCategory: (c: PortalCategory) => void;
  onDeleteCategory: (c: PortalCategory) => void;
  onEditLink: (l: PortalLink) => void;
  onDeleteLink: (l: PortalLink) => void;
}

const HeaderBtn: React.FC<{ label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }> = ({ label, danger, onClick, children }) => (
  <button
    type="button" aria-label={label} title={label} onClick={onClick}
    className="grid flex-none place-items-center hover:bg-hover"
    style={{ width: 30, height: 30, borderRadius: 8, color: danger ? 'var(--danger)' : 'var(--text-3)', background: 'transparent', border: '1px solid var(--hairline)', cursor: 'pointer' }}
  >
    {children}
  </button>
);

/** A collapsible category: colored icon header + count, then a responsive card grid. */
export const PortalCategorySection: React.FC<Props> = ({
  category, density, collapsed, isAdmin, onToggle, onAddLink, onEditCategory, onDeleteCategory, onEditLink, onDeleteLink,
}) => {
  const color = category.color || '#6ea8fe';
  const gridMin = density === 'compact' ? 152 : 224;

  return (
    <section style={{ marginBottom: 24 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: collapsed ? 0 : 14 }}>
        <button
          type="button" onClick={onToggle} aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2.5"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 2px', textAlign: 'left' }}
        >
          <span className="flex-none" style={{ color: 'var(--text-4)', display: 'grid', placeItems: 'center' }}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </span>
          <span
            className="grid flex-none place-items-center"
            style={{ width: 28, height: 28, borderRadius: 8, color, background: hexa(color, 0.16), border: `1px solid ${hexa(color, 0.3)}` }}
          >
            <PortalIcon name={category.icon} size={15} />
          </span>
          <span className="truncate" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>
            {category.name}
          </span>
          <span className="cb-mono flex-none" style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
            {category.links.length}
          </span>
        </button>

        {isAdmin && (
          <div className="flex flex-none items-center gap-1">
            <HeaderBtn label="Add link to this category" onClick={() => onAddLink(category.id)}><Plus size={15} /></HeaderBtn>
            <HeaderBtn label={`Edit ${category.name}`} onClick={() => onEditCategory(category)}><Pencil size={13} /></HeaderBtn>
            <HeaderBtn label={`Delete ${category.name}`} danger onClick={() => onDeleteCategory(category)}><Trash2 size={13} /></HeaderBtn>
          </div>
        )}
      </div>

      {!collapsed && (
        category.links.length === 0 ? (
          <div className="cb-mono" style={{ fontSize: 12, color: 'var(--text-4)', padding: '2px 2px 4px 42px' }}>
            {isAdmin ? 'No links yet — add one with +' : 'No links yet.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: `repeat(auto-fill, minmax(${gridMin}px, 1fr))` }}>
            {category.links.map((l) => (
              <PortalCard key={l.id} link={l} density={density} isAdmin={isAdmin} onEdit={onEditLink} onDelete={onDeleteLink} />
            ))}
          </div>
        )
      )}
    </section>
  );
};

export default PortalCategorySection;
