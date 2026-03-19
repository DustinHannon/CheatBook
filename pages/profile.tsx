import React, { useState, useEffect, useRef } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { createClient } from '../lib/supabase/client';
import {
  getProfile,
  updateProfile,
  getUserStats,
  uploadAvatar,
  getNotebooks,
  Profile,
} from '../lib/api';

const supabase = createClient();

const ProfilePage: NextPage = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [stats, setStats] = useState({ notebookCount: 0, noteCount: 0 });
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileData, statsData, notebooksData] = await Promise.all([
          getProfile(supabase),
          getUserStats(supabase),
          getNotebooks(supabase),
        ]);
        setProfile(profileData);
        setName(profileData.name || '');
        setStats(statsData);
        setNotebooks(notebooksData);
      } catch (err) {
        console.error('Profile load error:', err);
      }
    };
    if (user) loadData();
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const updated = await updateProfile(supabase, { name: name.trim() || undefined });
      setProfile(updated);
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch {
      setSaveMessage('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const avatarUrl = await uploadAvatar(supabase, file);
      setProfile((prev) => (prev ? { ...prev, avatar: avatarUrl } : prev));
    } catch {
      // Upload failed silently
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.push('/login');
  };

  const getInitial = (): string => {
    if (profile?.name) return profile.name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return '?';
  };

  return (
    <ProtectedRoute>
      <Head>
        <title>Settings - CheatBook</title>
      </Head>
      <Layout notebooks={notebooks}>
        <div className="bg-bg-base min-h-full">
          <div className="max-w-xl mx-auto px-6 py-12">
            {/* Title */}
            <h1 className="text-display-sm font-display text-text-primary">Settings</h1>
            <div className="divider-gold w-16 mt-4" />

            {/* Avatar section */}
            <div className="mt-8 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center overflow-hidden">
                {profile?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-bg-base font-display text-3xl font-semibold">
                    {getInitial()}
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                onClick={handleAvatarClick}
                disabled={isUploading}
                className="mt-3 text-sm text-accent hover:text-accent-hover font-body transition disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : 'Change avatar'}
              </button>
            </div>

            {/* Form fields */}
            <div className="mt-8 space-y-6">
              <div>
                <label className="section-label" htmlFor="profile-name">
                  Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full bg-bg-surface border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-0 focus:outline-none text-sm font-body"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="section-label" htmlFor="profile-email">
                  Email
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  className="mt-2 w-full bg-bg-surface border border-border-default rounded-lg px-4 py-3 text-text-tertiary text-sm font-body cursor-not-allowed"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-6 py-3 text-sm font-body transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                {saveMessage && (
                  <span className="text-sm text-text-secondary font-body">
                    {saveMessage}
                  </span>
                )}
              </div>
            </div>

            {/* Stats section */}
            <div className="mt-12">
              <span className="section-label">Activity</span>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-bg-raised border border-border-subtle rounded-lg p-5">
                  <div className="font-display text-2xl text-text-primary">
                    {stats.notebookCount}
                  </div>
                  <div className="text-xs text-text-secondary font-body mt-1">
                    Notebooks
                  </div>
                </div>
                <div className="bg-bg-raised border border-border-subtle rounded-lg p-5">
                  <div className="font-display text-2xl text-text-primary">
                    {stats.noteCount}
                  </div>
                  <div className="text-xs text-text-secondary font-body mt-1">
                    Notes
                  </div>
                </div>
              </div>
            </div>

            {/* Danger zone */}
            <div className="mt-12">
              <span className="section-label">Account</span>
              <div className="mt-4">
                <button
                  onClick={handleSignOut}
                  className="border border-status-error/30 text-status-error hover:bg-status-error/10 rounded-lg px-6 py-3 text-sm font-body transition"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProfilePage;
