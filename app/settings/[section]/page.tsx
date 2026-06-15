'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '../../../lib/router-compat';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { Settings, SETTINGS_SECTIONS } from '../../../components/Settings/Settings';
import type { SettingsSection } from '../../../components/Settings/Settings';

export default function SettingsPage() {
  const params = useParams();
  const raw = typeof params?.section === 'string' ? params.section : 'profile';
  const isValid = (SETTINGS_SECTIONS as readonly string[]).includes(raw);
  const router = useRouter();

  // Unknown/invalid section → canonical Profile route (rather than rendering
  // Profile under a wrong URL).
  useEffect(() => {
    if (!isValid) router.replace('/settings/profile');
  }, [isValid, router]);

  if (!isValid) return null;

  return (
    <ProtectedRoute>
      <Settings section={raw as SettingsSection} />
    </ProtectedRoute>
  );
}
