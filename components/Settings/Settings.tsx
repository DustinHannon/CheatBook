import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from '../../lib/router-compat';
import { createClient } from '../../lib/supabase/client';
import { useApp } from '../AppContext';
import { useToast } from '../Toast';
import { updateProfile } from '../../lib/api';
import { AuroraBackground } from '../ui/AuroraBackground';
import { Avatar } from '../ui/Avatar';
import { Skeleton } from '../ui/Skeleton';
import type { Member, NotificationPrefs } from '../../lib/types';
import { ProfileSection, type ProfileFields } from './ProfileSection';
import { AccountSection } from './AccountSection';
import { NotificationsSection } from './NotificationsSection';
import { AppearanceSection } from './AppearanceSection';
import { SecuritySection } from './SecuritySection';
import { UsersSection } from './UsersSection';

// ─── Export contract ──────────────────────────────────────────────────
export type SettingsSection = 'profile' | 'account' | 'notifications' | 'appearance' | 'security' | 'users';
export const SETTINGS_SECTIONS = ['profile', 'account', 'notifications', 'appearance', 'security', 'users'] as const;

const supabase = createClient();

const DEFAULT_PREFS: NotificationPrefs = {
  mentions: true, comments: true, incident: true,
  digest: false, desktop: false, sounds: false,
};

interface NavItem {
  key: SettingsSection;
  label: string;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  {
    key: 'profile',
    label: 'Your profile',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>,
  },
  {
    key: 'account',
    label: 'Account & SSO',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /></svg>,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>,
  },
  {
    key: 'appearance',
    label: 'Appearance',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18 4.5 4.5 0 0 0 0-9 4.5 4.5 0 0 1 0-9z" /></svg>,
  },
  {
    key: 'security',
    label: 'Security',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v5c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V6z" /></svg>,
  },
  {
    key: 'users',
    label: 'Users',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.1" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M17.5 19a5.5 5.5 0 0 0-3-4.9" /></svg>,
  },
];

/** Full-height Settings layout: aurora + top bar + glass section nav + content panel. */
export const Settings: React.FC<{ section: SettingsSection }> = ({ section }) => {
  const router = useRouter();
  const { me, loading, refreshMe, isAdmin } = useApp();
  const { showToast } = useToast();

  // URL guard: non-admins must not reach the admin-only Users section by URL.
  // Wait for me to resolve before deciding, so a slow role read doesn't bounce
  // an admin off mid-load. Once loaded, a non-admin on 'users' is redirected.
  useEffect(() => {
    if (section === 'users' && !loading && me && !isAdmin) {
      router.replace('/settings/profile');
    }
  }, [section, loading, me, isAdmin, router]);

  // Local avatar override for instant feedback after an upload (AppContext
  // doesn't re-fetch members on a profile change, only on notebook changes).
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const effectiveMe: Member | null = useMemo(
    () => (me ? { ...me, avatarUrl: avatarOverride !== null ? (avatarOverride || null) : me.avatarUrl } : null),
    [me, avatarOverride],
  );

  // Local profile-field state (persisted only on Save), seeded from me.
  const [fields, setFields] = useState<ProfileFields>({ name: '', title: '', pronouns: '', team: '', status: '' });
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (me && seededFor.current !== me.id) {
      setFields({
        name: me.name || '',
        title: me.title || '',
        pronouns: me.pronouns || '',
        team: me.team || '',
        status: me.status || '',
      });
      seededFor.current = me.id;
    }
  }, [me]);

  // Notification prefs: optimistic local mirror, seeded from the DB profile.
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const prefsSeeded = useRef(false);
  useEffect(() => {
    if (prefsSeeded.current || !me) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', me.id)
      .single()
      .then(({ data, error }) => {
        // Bail if this effect was torn down (unmount or me changed) before the
        // read resolved — never set the seed flag or state on a stale run.
        if (cancelled) return;
        // On a transient read failure, leave the seed flag unset so a later
        // render can retry — don't lock in DEFAULT_PREFS and clobber stored prefs.
        if (error) return;
        prefsSeeded.current = true;
        const p = data?.notification_prefs as Partial<NotificationPrefs> | null | undefined;
        if (p && typeof p === 'object') setPrefs({ ...DEFAULT_PREFS, ...p });
      });
    return () => { cancelled = true; };
  }, [me]);

  // "All changes saved" teal confirmation.
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Profile fields are the saveable surface; other sections persist on change.
      await updateProfile(supabase, {
        name: fields.name,
        title: fields.title,
        pronouns: fields.pronouns,
        team_name: fields.team,
        status: fields.status,
      });
      await refreshMe(); // propagate the new identity to the sidebar/top-bar/app
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save changes.', 'error');
    } finally {
      setSaving(false);
    }
  }, [saving, fields, showToast, refreshMe]);

  const goSection = (key: SettingsSection) => router.push('/settings/' + key);

  return (
    <div
      style={{
        position: 'relative',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        padding: 14,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <AuroraBackground />

      {/* top bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '6px 8px 16px',
          flex: '0 0 auto',
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/')}
          title="Back to CheatBook"
          aria-label="Back to CheatBook"
          className="cb-set-back"
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            flex: '0 0 auto',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--text-2)',
            cursor: 'pointer',
            background: 'var(--surface-input)',
            border: '1px solid var(--hairline)',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ lineHeight: 1.1 }}>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: 4 }}>
            CHEATBOOK / SETTINGS
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Settings</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && (
            <div
              role="status"
              className="animate-cb-up"
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: 'var(--success)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              All changes saved
            </div>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="cb-set-save"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 44,
              padding: '0 18px',
              borderRadius: 11,
              cursor: saving ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-on-accent)',
              background: 'var(--accent-grad)',
              border: 'none',
              boxShadow: '0 8px 20px -8px rgba(110,168,254,0.8)',
              opacity: saving ? 0.75 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {effectiveMe ? (
            <Avatar name={effectiveMe.name} color={effectiveMe.color} avatarUrl={effectiveMe.avatarUrl} size={38} />
          ) : (
            <Skeleton className="h-[38px] w-[38px] rounded-full" />
          )}
        </div>
      </div>

      {/* body: nav + content */}
      <div
        className="cb-settings-body"
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '236px 1fr',
          gap: 12,
        }}
      >
        {/* section nav */}
        <aside
          className="cb-panel cb-settings-nav"
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0, padding: 12, borderRadius: 18 }}
        >
          <div className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--text-4)', padding: '8px 12px 10px' }}>
            ACCOUNT
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }} aria-label="Settings sections">
            {NAV.filter((n) => n.key !== 'users' || isAdmin).map((item) => {
              const active = item.key === section;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => goSection(item.key)}
                  aria-current={active ? 'page' : undefined}
                  className="cb-set-navrow"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '10px 12px',
                    minHeight: 44,
                    borderRadius: 11,
                    cursor: 'pointer',
                    fontSize: 13.5,
                    fontWeight: 600,
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: active ? 'var(--text-strong)' : 'var(--text-2)',
                  }}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 11,
                        background: 'var(--accent-soft)',
                        border: '1px solid rgba(110,168,254,0.32)',
                      }}
                    />
                  )}
                  <span style={{ position: 'relative', flex: '0 0 auto', display: 'flex' }}>{item.icon}</span>
                  <span style={{ position: 'relative' }}>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div
            style={{
              marginTop: 'auto',
              padding: 12,
              borderRadius: 13,
              background: 'var(--bg-hover)',
              border: '1px solid var(--hairline)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              {effectiveMe ? (
                <Avatar name={effectiveMe.name} color={effectiveMe.color} avatarUrl={effectiveMe.avatarUrl} size={34} />
              ) : (
                <Skeleton className="h-[34px] w-[34px] rounded-full" />
              )}
              <div style={{ minWidth: 0, lineHeight: 1.2 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {effectiveMe?.name || (loading ? '…' : 'You')}
                </div>
                <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>You · MorganWhiteGroup</div>
              </div>
            </div>
          </div>
        </aside>

        {/* content */}
        <section
          className="cb-panel"
          style={{ minHeight: 0, overflowY: 'auto', borderRadius: 18 }}
          aria-live="polite"
        >
          <div style={{ maxWidth: 720, padding: '30px 34px 50px' }}>
            {loading || !effectiveMe ? (
              <SettingsLoading />
            ) : (
              <>
                {section === 'profile' && (
                  <ProfileSection
                    supabase={supabase}
                    me={effectiveMe}
                    fields={fields}
                    onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
                    onAvatarChanged={(url) => setAvatarOverride(url)}
                  />
                )}
                {section === 'account' && <AccountSection me={effectiveMe} />}
                {section === 'notifications' && (
                  <NotificationsSection supabase={supabase} prefs={prefs} onChange={setPrefs} />
                )}
                {section === 'appearance' && <AppearanceSection />}
                {section === 'security' && <SecuritySection supabase={supabase} />}
                {section === 'users' && (isAdmin ? <UsersSection /> : <SettingsLoading />)}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Hover/focus affordances kept in CSS to avoid per-element JS state. */}
      <style jsx global>{`
        .cb-set-back:hover { background: var(--bg-hover); }
        .cb-set-save:hover:not(:disabled) { filter: brightness(1.07); }
        .cb-set-navrow:hover { background: var(--bg-hover); color: var(--text-strong); }
        .cb-set-ghost:hover:not(:disabled) { background: var(--bg-hover); }
        .cb-set-remove:not(:disabled):hover { color: var(--danger); background: var(--danger-soft); }
        .cb-set-danger-btn:hover { background: var(--danger-soft); }
        .cb-set-signout-others:hover:not(:disabled) { background: var(--danger-soft); }
        .cb-set-accent:hover { filter: brightness(1.1); }
        .cb-set-density:hover { background: var(--bg-hover); }
        .cb-set-input:focus { border-color: rgba(110,168,254,0.5); }
        @media (max-width: 760px) {
          .cb-settings-body { grid-template-columns: 1fr !important; grid-auto-rows: min-content; overflow-y: auto; }
          .cb-settings-nav { max-height: none; }
        }
      `}</style>
    </div>
  );
};

/** Skeleton placeholder for the content panel while me loads. */
const SettingsLoading: React.FC = () => (
  <div className="flex flex-col gap-4">
    <Skeleton className="h-6 w-48" />
    <Skeleton className="h-4 w-80" />
    <div className="mt-4 flex items-center gap-5">
      <Skeleton className="h-[84px] w-[84px] rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-64" />
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-4">
      <Skeleton className="h-[44px]" />
      <Skeleton className="h-[44px]" />
      <Skeleton className="h-[44px]" />
      <Skeleton className="h-[44px]" />
    </div>
  </div>
);

export default Settings;
