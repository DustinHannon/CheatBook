import React, { useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { updateNotificationPrefs } from '../../lib/api';
import { useToast } from '../Toast';
import type { NotificationPrefs } from '../../lib/types';
import { SectionHead, Eyebrow, RowList, ToggleRow } from './parts';

interface NotificationsSectionProps {
  supabase: SupabaseClient;
  prefs: NotificationPrefs;
  onChange: (next: NotificationPrefs) => void;
}

type PrefKey = keyof NotificationPrefs;

interface NotifItem { key: PrefKey; label: string; desc: string; }
interface NotifGroup { title: string; items: NotifItem[]; }

const GROUPS: NotifGroup[] = [
  {
    title: 'ACTIVITY',
    items: [
      { key: 'mentions', label: 'Mentions', desc: 'When someone @mentions you in a note or comment' },
      { key: 'comments', label: 'Comments', desc: 'Replies on notes you own or follow' },
      { key: 'shared', label: 'Shared with you', desc: 'When a teammate shares a note or space' },
      { key: 'incident', label: 'Incident assignments', desc: 'When you are added to an active incident' },
    ],
  },
  {
    title: 'EMAIL',
    items: [
      { key: 'digest', label: 'Weekly knowledge digest', desc: 'A Monday summary of what changed across your spaces' },
    ],
  },
  {
    title: 'DELIVERY',
    items: [
      { key: 'desktop', label: 'Desktop notifications', desc: 'Push alerts to this browser' },
      { key: 'sounds', label: 'Notification sounds', desc: 'Play a sound for new activity' },
    ],
  },
];

/** Notifications: three grouped toggle lists bound to me.notification_prefs, persisted on toggle. */
export const NotificationsSection: React.FC<NotificationsSectionProps> = ({ supabase, prefs, onChange }) => {
  const { showToast } = useToast();

  const requestDesktop = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('This browser does not support desktop notifications.', 'error');
      return false;
    }
    let permission = Notification.permission;
    if (permission === 'default') {
      try { permission = await Notification.requestPermission(); }
      catch { permission = 'denied'; }
    }
    if (permission !== 'granted') {
      showToast('Desktop notifications are blocked in your browser settings.', 'error');
      return false;
    }
    try {
      new Notification('CheatBook', { body: 'Desktop notifications are on. This is a sample alert.' });
    } catch { /* some browsers require a service worker; the permission grant is enough */ }
    return true;
  }, [showToast]);

  const toggle = useCallback(async (key: PrefKey) => {
    const turningOn = !prefs[key];

    // Desktop notifications need an OS-level permission grant before we enable.
    if (key === 'desktop' && turningOn) {
      const ok = await requestDesktop();
      if (!ok) return;
    }

    const next: NotificationPrefs = { ...prefs, [key]: turningOn };
    onChange(next); // optimistic
    try {
      await updateNotificationPrefs(supabase, next);
    } catch (err) {
      onChange(prefs); // roll back
      showToast(err instanceof Error ? err.message : 'Could not save preference.', 'error');
    }
  }, [prefs, onChange, supabase, requestDesktop, showToast]);

  return (
    <>
      <SectionHead
        title="Notifications"
        lead="Choose what reaches you and how. You can always find everything in your activity feed."
      />
      {GROUPS.map((group) => (
        <React.Fragment key={group.title}>
          <Eyebrow style={{ margin: '6px 0 8px' }}>{group.title}</Eyebrow>
          <RowList style={{ marginBottom: 22 }}>
            {group.items.map((item) => (
              <ToggleRow
                key={item.key}
                label={item.label}
                desc={item.desc}
                on={!!prefs[item.key]}
                onToggle={() => toggle(item.key)}
              />
            ))}
          </RowList>
        </React.Fragment>
      ))}
    </>
  );
};

export default NotificationsSection;
