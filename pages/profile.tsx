import React, { useState, useEffect, useRef } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { createClient } from '../lib/supabase/client';
import {
  updateProfile,
  uploadAvatar,
  getNotebooks,
  Profile,
} from '../lib/api';
import { useTeam } from '../components/TeamContext';
import { ClipboardDocumentIcon, UserMinusIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const supabase = createClient();

const ProfilePage: NextPage = () => {
  const { user, logout } = useAuth();
  const { team, teamMembers, isAdmin, inviteMember, removeMember, updateRole } = useTeam();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [stats, setStats] = useState({ notebookCount: 0, noteCount: 0 });
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const loadData = async () => {
      try {
        // Fetch profile directly using user.id from AuthContext
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileErr) {
          console.error('Profile fetch error:', profileErr);
          return;
        }

        if (profileData) {
          setProfile(profileData);
          setName(profileData.name || '');
        }

        // Fetch stats
        const [nbCount, noteCount] = await Promise.all([
          supabase.from('notebooks').select('id', { count: 'exact' }).eq('owner_id', user.id),
          supabase.from('notes').select('id', { count: 'exact' }).eq('owner_id', user.id),
        ]);
        setStats({ notebookCount: nbCount.count || 0, noteCount: noteCount.count || 0 });

        // Fetch notebooks for layout
        const nbs = await getNotebooks(supabase);
        setNotebooks(nbs);
      } catch (err) {
        console.error('Profile load error:', err);
      }
    };
    loadData();
  }, [user?.id]);

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

            {/* Team section */}
            {team && (
              <div className="mt-12">
                <span className="section-label">Team</span>
                <div className="mt-4 bg-bg-raised border border-border-subtle rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-text-primary">{team.name}</h3>
                    <span className="text-xs text-text-tertiary">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Invite code */}
                  <div className="mt-4 p-3 bg-bg-base rounded-lg border border-border-subtle">
                    <div className="text-xs text-text-tertiary mb-1">Invite code — share this with teammates</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-accent tracking-wider">{team.invite_code}</code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(team.invite_code);
                          setCodeCopied(true);
                          setTimeout(() => setCodeCopied(false), 2000);
                        }}
                        className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                        title="Copy invite code"
                      >
                        <ClipboardDocumentIcon className="w-4 h-4" />
                      </button>
                      {codeCopied && <span className="text-xs text-accent">Copied!</span>}
                    </div>
                  </div>

                  {/* Members list */}
                  <div className="mt-4 pt-4 border-t border-border-subtle">
                    <div className="text-xs text-text-tertiary mb-3">Members</div>
                    {teamMembers.length === 0 && (
                      <p className="text-sm text-text-tertiary py-2">Loading members...</p>
                    )}
                    <div className="space-y-2">
                    {teamMembers.map(member => (
                      <div key={member.user_id} className="flex items-center justify-between py-2 px-1">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-bg-base text-sm font-semibold">
                            {(member.profiles?.name || member.profiles?.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm text-text-primary">{member.profiles?.name || member.profiles?.email || 'Unknown'}</div>
                            <div className="text-xs text-text-tertiary">{member.profiles?.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdmin && member.user_id !== user?.id ? (
                            <button
                              onClick={async () => {
                                const newRole = member.role === 'admin' ? 'member' : 'admin';
                                try {
                                  await updateRole(member.user_id, newRole);
                                } catch (err) {
                                  console.error('Failed to update role:', err);
                                }
                              }}
                              className={`text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                                member.role === 'admin'
                                  ? 'bg-accent-muted text-accent hover:bg-accent/20'
                                  : 'bg-bg-surface text-text-tertiary hover:bg-bg-surface-hover hover:text-text-secondary'
                              }`}
                              title={member.role === 'admin' ? 'Click to demote to member' : 'Click to promote to admin'}
                            >
                              {member.role === 'admin' && <ShieldCheckIcon className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                              {member.role}
                            </button>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              member.role === 'admin'
                                ? 'bg-accent-muted text-accent'
                                : 'bg-bg-surface text-text-tertiary'
                            }`}>
                              {member.role === 'admin' && <ShieldCheckIcon className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                              {member.role}
                            </span>
                          )}
                          {isAdmin && member.user_id !== user?.id && (
                            <button
                              onClick={async () => {
                                if (confirm(`Remove ${member.profiles?.name || member.profiles?.email}?`)) {
                                  try {
                                    await removeMember(member.user_id);
                                  } catch (err) {
                                    console.error('Failed to remove:', err);
                                  }
                                }
                              }}
                              className="p-1 rounded text-text-tertiary hover:text-status-error hover:bg-bg-surface-hover transition-colors"
                              title="Remove member"
                            >
                              <UserMinusIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>

                  {/* Invite member */}
                  {isAdmin && (
                    <div className="mt-4 pt-4 border-t border-border-subtle">
                      <div className="text-xs text-text-tertiary mb-2">Invite by email</div>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="colleague@company.com"
                          className="flex-1 bg-bg-base border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-0 focus:outline-none text-sm"
                        />
                        <button
                          onClick={async () => {
                            if (!inviteEmail.trim()) return;
                            setInviteStatus('');
                            try {
                              await inviteMember(inviteEmail.trim());
                              setInviteEmail('');
                              setInviteStatus('Invited!');
                              setTimeout(() => setInviteStatus(''), 3000);
                            } catch (err: any) {
                              setInviteStatus(err?.message || 'Failed');
                              setTimeout(() => setInviteStatus(''), 3000);
                            }
                          }}
                          className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-4 py-2 text-sm transition"
                        >
                          Invite
                        </button>
                      </div>
                      {inviteStatus && (
                        <div className={`mt-2 text-xs ${inviteStatus === 'Invited!' ? 'text-status-success' : 'text-status-error'}`}>
                          {inviteStatus}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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
