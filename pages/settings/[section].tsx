import React from 'react';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Settings, SettingsSection, SETTINGS_SECTIONS } from '../../components/Settings/Settings';

export default function SettingsPage() {
  const router = useRouter();
  const raw = typeof router.query.section === 'string' ? router.query.section : 'profile';
  const section: SettingsSection = (SETTINGS_SECTIONS as readonly string[]).includes(raw)
    ? (raw as SettingsSection)
    : 'profile';
  return (
    <ProtectedRoute>
      <Settings section={section} />
    </ProtectedRoute>
  );
}
