import React, { useState, FormEvent } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../components/AuthContext';
import { createClient } from '../lib/supabase/client';

const supabase = createClient();

export default function TeamSetup() {
  const { user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) { setError('Please enter a team name'); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('create_team_with_owner', { team_name: teamName.trim() });
      if (rpcError) throw new Error(rpcError.message);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) { setError('Please enter an invite code'); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('join_team_by_code', { code: inviteCode.trim() });
      if (rpcError) throw new Error(rpcError.message);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Head>
        <title>Set Up Your Team - CheatBook</title>
      </Head>
      <div className="min-h-screen flex flex-col md:flex-row bg-bg-base">
        {/* Left decorative panel */}
        <div className="hidden md:flex w-1/2 bg-bg-raised items-center justify-center animate-fade-in">
          <div className="text-center">
            <h1 className="text-display-lg font-display font-semibold text-text-primary">CheatBook</h1>
            <div className="divider-gold w-24 mx-auto my-6" />
            <p className="text-lg text-text-secondary font-body italic">
              Quick notes for the things you need to remember
            </p>
          </div>
        </div>

        {/* Mobile header */}
        <div className="md:hidden py-8 text-center bg-bg-raised">
          <h1 className="text-display-md font-display font-semibold text-text-primary">CheatBook</h1>
          <div className="divider-gold w-16 mx-auto my-4" />
        </div>

        {/* Right panel */}
        <div className="flex-1 md:w-1/2 flex items-center justify-center bg-bg-base px-6 py-12 md:py-0">
          <div className="max-w-sm w-full animate-slide-up">
            {mode === 'choose' && (
              <>
                <h2 className="text-display-sm font-display text-text-primary">Set up your team</h2>
                <p className="text-sm text-text-secondary mt-2">
                  Create a new team or join an existing one with an invite code.
                </p>
                <div className="mt-8 space-y-4">
                  <button
                    onClick={() => setMode('create')}
                    className="w-full bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-4 py-3 text-sm transition"
                  >
                    Create a Team
                  </button>
                  <button
                    onClick={() => setMode('join')}
                    className="w-full bg-bg-surface hover:bg-bg-surface-hover text-text-primary border border-border-default rounded-lg px-4 py-3 text-sm transition"
                  >
                    Join with Invite Code
                  </button>
                </div>
              </>
            )}

            {mode === 'create' && (
              <>
                <h2 className="text-display-sm font-display text-text-primary">Create your team</h2>
                <p className="text-sm text-text-secondary mt-2">
                  Give your IT team a name. You can invite members after.
                </p>
                {error && (
                  <div className="mt-4 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg px-4 py-3 text-sm">
                    {error}
                  </div>
                )}
                <form onSubmit={handleCreate} className="mt-6 space-y-4">
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. IT Department"
                    className="w-full bg-bg-surface border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-0 focus:outline-none text-sm"
                    disabled={isSubmitting}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-4 py-3 text-sm transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Team'}
                  </button>
                  <button type="button" onClick={() => { setMode('choose'); setError(null); }}
                    className="w-full text-sm text-text-secondary hover:text-text-primary transition">
                    Back
                  </button>
                </form>
              </>
            )}

            {mode === 'join' && (
              <>
                <h2 className="text-display-sm font-display text-text-primary">Join a team</h2>
                <p className="text-sm text-text-secondary mt-2">
                  Enter the invite code from your team admin.
                </p>
                {error && (
                  <div className="mt-4 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg px-4 py-3 text-sm">
                    {error}
                  </div>
                )}
                <form onSubmit={handleJoin} className="mt-6 space-y-4">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter invite code"
                    className="w-full bg-bg-surface border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-0 focus:outline-none text-sm font-mono tracking-wider text-center"
                    disabled={isSubmitting}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-4 py-3 text-sm transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Joining...' : 'Join Team'}
                  </button>
                  <button type="button" onClick={() => { setMode('choose'); setError(null); }}
                    className="w-full text-sm text-text-secondary hover:text-text-primary transition">
                    Back
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
