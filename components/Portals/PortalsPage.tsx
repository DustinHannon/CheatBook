import React, { useCallback, useEffect, useState } from 'react';
import { Menu, Plus, Link as LinkIcon } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { useApp } from '../AppContext';
import { useAppearance } from '../AppearanceContext';
import { useToast } from '../Toast';
import { Skeleton } from '../ui/Skeleton';
import { ConfirmDialog } from '../ConfirmDialog';
import { PortalCategorySection } from './PortalCategorySection';
import { CategoryDialog, LinkDialog } from './PortalDialogs';
import {
  getPortals, createPortalCategory, updatePortalCategory, deletePortalCategory,
  createPortalLink, updatePortalLink, deletePortalLink,
} from '../../lib/api';
import type { PortalCategory, PortalLink, PortalDensity } from '../../lib/types';

const supabase = createClient();
const COLLAPSE_KEY = 'cb-portal-collapsed';

function loadCollapsed(): Set<string> {
  try { const raw = window.localStorage.getItem(COLLAPSE_KEY); if (raw) return new Set(JSON.parse(raw) as string[]); } catch { /* private mode */ }
  return new Set();
}
function saveCollapsed(s: Set<string>) {
  try { window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(Array.from(s))); } catch { /* private mode */ }
}

function useIsMobile(): boolean {
  const [w, setW] = useState<number | null>(null);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (w ?? 1440) < 760;
}

type CatDialogState = { mode: 'new' } | { mode: 'edit'; category: PortalCategory } | null;
type LinkDialogState = { mode: 'new'; categoryId?: string } | { mode: 'edit'; link: PortalLink } | null;

const DensityToggle: React.FC<{ value: PortalDensity; onChange: (d: PortalDensity) => void }> = ({ value, onChange }) => (
  <div className="flex" style={{ padding: 3, borderRadius: 11, background: 'var(--surface-input)', border: '1px solid var(--hairline)' }} role="group" aria-label="Card density">
    {(['comfortable', 'compact'] as PortalDensity[]).map((d) => {
      const active = value === d;
      return (
        <button
          key={d} type="button" onClick={() => onChange(d)} aria-pressed={active}
          style={{
            height: 30, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
            color: active ? 'var(--accent)' : 'var(--text-3)',
            background: active ? 'var(--accent-soft)' : 'transparent',
            border: active ? '1px solid var(--accent)' : '1px solid transparent',
          }}
        >
          {d}
        </button>
      );
    })}
  </div>
);

export const PortalsPage: React.FC = () => {
  const { isAdmin, isPending, openNav } = useApp();
  const { appearance, setPortalDensity } = useAppearance();
  const { showToast } = useToast();
  const isMobile = useIsMobile();
  const density: PortalDensity = appearance.portalDensity ?? 'comfortable';

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<PortalCategory[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [catDialog, setCatDialog] = useState<CatDialogState>(null);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState>(null);
  const [deleteCat, setDeleteCat] = useState<PortalCategory | null>(null);
  const [deleteLink, setDeleteLink] = useState<PortalLink | null>(null);

  useEffect(() => { setCollapsed(loadCollapsed()); }, []);

  const reload = useCallback(async () => {
    try { setCategories(await getPortals(supabase)); } catch { showToast('Could not load portals.', 'error'); }
  }, [showToast]);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      try { const d = await getPortals(supabase); if (on) setCategories(d); }
      catch { if (on) showToast('Could not load portals.', 'error'); }
      finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, [showToast]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveCollapsed(next);
      return next;
    });
  }, []);

  // ── Admin: category ──
  const submitCategory = async (v: { name: string; color: string; icon: string }) => {
    const editing = catDialog && catDialog.mode === 'edit' ? catDialog.category : null;
    setCatDialog(null);
    try {
      if (editing) await updatePortalCategory(supabase, editing.id, v);
      else await createPortalCategory(supabase, v);
      await reload();
      showToast(editing ? 'Category updated.' : 'Category created.', 'success');
    } catch { showToast('Could not save category.', 'error'); }
  };
  const confirmDeleteCategory = async () => {
    const t = deleteCat; setDeleteCat(null);
    if (!t) return;
    try { await deletePortalCategory(supabase, t.id); await reload(); showToast('Category deleted.', 'success'); }
    catch { showToast('Could not delete category.', 'error'); }
  };

  // ── Admin: link ──
  const submitLink = async (v: { label: string; url: string; description: string | null; icon: string; color: string; categoryId: string }) => {
    const editing = linkDialog && linkDialog.mode === 'edit' ? linkDialog.link : null;
    setLinkDialog(null);
    try {
      if (editing) await updatePortalLink(supabase, editing.id, v);
      else await createPortalLink(supabase, v);
      await reload();
      showToast(editing ? 'Link updated.' : 'Link added.', 'success');
    } catch { showToast('Could not save link.', 'error'); }
  };
  const confirmDeleteLink = async () => {
    const t = deleteLink; setDeleteLink(null);
    if (!t) return;
    try { await deletePortalLink(supabase, t.id); await reload(); showToast('Link removed.', 'success'); }
    catch { showToast('Could not remove link.', 'error'); }
  };

  const pad = isMobile ? '22px 16px 48px' : '34px 40px 60px';
  const MenuButton = isMobile ? (
    <button
      type="button" onClick={openNav} aria-label="Open navigation"
      className="grid flex-none place-items-center self-center text-text-2 hover:bg-hover"
      style={{ width: 44, height: 44, borderRadius: 9, border: '1px solid var(--hairline)' }}
    >
      <Menu size={18} />
    </button>
  ) : null;

  return (
    <section className="cb-panel relative flex min-h-0 w-full flex-col overflow-y-auto" style={{ borderRadius: 20 }} aria-label="Portals">
      <div style={{ maxWidth: 1080, width: '100%', margin: '0 auto', padding: pad }}>
        {/* Header */}
        <div className="mb-[26px] flex flex-wrap items-end gap-x-4 gap-y-3">
          {MenuButton}
          <div className="min-w-0">
            <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--accent)', marginBottom: 6 }}>
              CHEATBOOK / PORTALS
            </div>
            <h1 className="m-0 text-text" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>
              Portals
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <DensityToggle value={density} onChange={setPortalDensity} />
            {isAdmin && categories.length > 0 && (
              <button
                type="button" onClick={() => setLinkDialog({ mode: 'new' })}
                className="flex items-center gap-2 hover:bg-hover"
                style={{ height: 38, padding: '0 14px', borderRadius: 11, fontSize: 13, fontWeight: 700, color: 'var(--text-2)', background: 'var(--bg-hover)', border: '1px solid var(--hairline)', cursor: 'pointer' }}
              >
                <LinkIcon size={15} /> Add link
              </button>
            )}
            {isAdmin && (
              <button
                type="button" onClick={() => setCatDialog({ mode: 'new' })}
                className="flex items-center gap-2 hover:brightness-[1.07]"
                style={{ height: 38, padding: '0 16px', borderRadius: 11, fontSize: 13, fontWeight: 700, color: 'var(--text-on-accent)', background: 'var(--accent-grad)', cursor: 'pointer', border: 'none', boxShadow: '0 8px 20px -8px rgba(110,168,254,0.8)' }}
              >
                <Plus size={15} /> New category
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {isPending ? (
          <div style={{ padding: '40px 22px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--hairline)', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            An admin needs to approve your access before portals appear.
          </div>
        ) : loading ? (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(224px, 1fr))' }}>
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[74px] rounded-[14px]" />)}
          </div>
        ) : categories.length === 0 ? (
          <div style={{ padding: '48px 24px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--hairline)', textAlign: 'center' }}>
            <div className="grid place-items-center" style={{ width: 56, height: 56, margin: '0 auto 18px', borderRadius: 16, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid rgba(110,168,254,0.32)' }}>
              <LinkIcon size={26} />
            </div>
            <h2 className="m-0" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>No portals yet</h2>
            <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--text-3)' }}>
              {isAdmin ? 'Create a category to start adding links to the tools and sites your team uses.' : 'An admin hasn’t added any links yet.'}
            </p>
            {isAdmin && (
              <button
                type="button" onClick={() => setCatDialog({ mode: 'new' })}
                className="mx-auto mt-5 flex items-center gap-2 hover:brightness-[1.07]"
                style={{ height: 38, padding: '0 16px', borderRadius: 11, fontSize: 13, fontWeight: 700, color: 'var(--text-on-accent)', background: 'var(--accent-grad)', cursor: 'pointer', border: 'none' }}
              >
                <Plus size={15} /> New category
              </button>
            )}
          </div>
        ) : (
          categories.map((c) => (
            <PortalCategorySection
              key={c.id}
              category={c}
              density={density}
              collapsed={collapsed.has(c.id)}
              isAdmin={isAdmin}
              onToggle={() => toggle(c.id)}
              onAddLink={(categoryId) => setLinkDialog({ mode: 'new', categoryId })}
              onEditCategory={(category) => setCatDialog({ mode: 'edit', category })}
              onDeleteCategory={(category) => setDeleteCat(category)}
              onEditLink={(link) => setLinkDialog({ mode: 'edit', link })}
              onDeleteLink={(link) => setDeleteLink(link)}
            />
          ))
        )}
      </div>

      {/* Admin dialogs */}
      {catDialog && (
        <CategoryDialog
          initial={catDialog.mode === 'edit' ? catDialog.category : null}
          onSubmit={submitCategory}
          onClose={() => setCatDialog(null)}
        />
      )}
      {linkDialog && (
        <LinkDialog
          initial={linkDialog.mode === 'edit' ? linkDialog.link : null}
          categories={categories}
          defaultCategoryId={linkDialog.mode === 'new' ? linkDialog.categoryId : undefined}
          onSubmit={submitLink}
          onClose={() => setLinkDialog(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleteCat}
        danger
        title="Delete this category?"
        message={
          deleteCat && deleteCat.links.length > 0
            ? `“${deleteCat.name}” and its ${deleteCat.links.length} link${deleteCat.links.length === 1 ? '' : 's'} will be permanently deleted for everyone.`
            : `“${deleteCat?.name ?? ''}” will be permanently deleted.`
        }
        confirmLabel="Delete category"
        onConfirm={confirmDeleteCategory}
        onCancel={() => setDeleteCat(null)}
      />
      <ConfirmDialog
        open={!!deleteLink}
        danger
        title="Remove this link?"
        message={`“${deleteLink?.label ?? ''}” will be removed for everyone.`}
        confirmLabel="Remove link"
        onConfirm={confirmDeleteLink}
        onCancel={() => setDeleteLink(null)}
      />
    </section>
  );
};

export default PortalsPage;
