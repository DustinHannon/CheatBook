import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Settings, SettingsSection, SETTINGS_SECTIONS } from '../../components/Settings/Settings';

export default function SettingsPage() {
  const router = useRouter();
  const raw = typeof router.query.section === 'string' ? router.query.section : 'profile';
  const isValid = (SETTINGS_SECTIONS as readonly string[]).includes(raw);

  // Unknown/invalid section: send to the canonical Profile route rather than
  // silently rendering Profile under a wrong URL.
  useEffect(() => {
    if (router.isReady && !isValid) router.replace('/settings/profile');
  }, [router, router.isReady, isValid]);

  if (router.isReady && !isValid) return null;

  return (
    <ProtectedRoute>
      <Settings section={raw as SettingsSection} />
    </ProtectedRoute>
  );
}
