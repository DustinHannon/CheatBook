import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import RecentNotes from '../components/Dashboard/RecentNotes';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import InputDialog from '../components/InputDialog';
import NotebookPickerDialog from '../components/NotebookPickerDialog';
import { useAuth } from '../components/AuthContext';
import { useTeam } from '../components/TeamContext';
import { createClient } from '../lib/supabase/client';
import {
  getNotebooks,
  getRecentTeamNotes,
  getRecentActivity,
} from '../lib/api';
import type { Note, ActivityLogEntry } from '../lib/api';
import { PlusIcon } from '@heroicons/react/24/outline';

const supabase = createClient();

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { team, needsTeamSetup, isLoading: isTeamLoading } = useTeam();
  const router = useRouter();

  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [showCreateNotebook, setShowCreateNotebook] = useState(false);
  const [showNotebookPicker, setShowNotebookPicker] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  // Redirect to team setup if needed
  useEffect(() => {
    if (!isTeamLoading && needsTeamSetup && user) {
      router.push('/team-setup');
    }
  }, [isTeamLoading, needsTeamSetup, user, router]);

  // Fetch dashboard data
  useEffect(() => {
    if (!user || !team) return;
    const fetchAll = async () => {
      try {
        const [nbs, recent, activity] = await Promise.all([
          getNotebooks(supabase),
          getRecentTeamNotes(supabase, team.id, 12),
          getRecentActivity(supabase, team.id, 20),
        ]);
        setNotebooks(nbs);
        setRecentNotes(recent);
        setActivities(activity);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [user, team]);

  const handleCreateNotebook = async (title: string) => {
    setCreateError(null);
    if (!user?.id || !team?.id) { setCreateError('Not authenticated'); return; }
    try {
      const { data: nb, error } = await supabase
        .from('notebooks')
        .insert({ title, owner_id: user.id, team_id: team.id })
        .select().single();
      if (error) throw error;
      setNotebooks(prev => [{ ...nb, note_count: 0 }, ...prev]);
      setShowCreateNotebook(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create notebook');
    }
  };

  const quickCreateNote = async (notebookId: string) => {
    if (!user?.id || isCreatingNote) return;
    setIsCreatingNote(true);
    try {
      const { data: newNote, error } = await supabase
        .from('notes')
        .insert({ title: 'Untitled', notebook_id: notebookId, owner_id: user.id, last_edited_by: user.id })
        .select().single();
      if (error) throw error;
      setShowNotebookPicker(false);
      router.push(`/notes/${newNote.id}`);
    } catch (err) {
      console.error('Error creating note:', err);
    } finally {
      setIsCreatingNote(false);
    }
  };

  const handleNewNoteClick = () => {
    if (notebooks.length === 0) {
      setShowCreateNotebook(true);
    } else if (notebooks.length === 1) {
      quickCreateNote(notebooks[0].id);
    } else {
      setShowNotebookPicker(true);
    }
  };

  if (needsTeamSetup) return null;

  return (
    <ProtectedRoute>
      <Layout
        notebooks={notebooks}
        notes={recentNotes}
        onSelectNotebook={(id) => router.push(`/notebooks/${id}`)}
        onSelectNote={(id) => router.push(`/notes/${id}`)}
        onCreateNotebook={() => setShowCreateNotebook(true)}
        onCreateNote={handleNewNoteClick}
      >
        <Head>
          <title>CheatBook</title>
        </Head>

        <div className="h-full bg-bg-base overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 animate-fade-in">
              <div>
                <h1 className="text-display-md font-display text-text-primary">
                  {getGreeting()}, {user?.name || 'there'}
                </h1>
                {team && (
                  <p className="text-sm text-text-secondary mt-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                    {team.name}
                  </p>
                )}
              </div>
              <button
                onClick={handleNewNoteClick}
                disabled={isCreatingNote}
                className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-5 py-2.5 text-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                <PlusIcon className="w-4 h-4" />
                {isCreatingNote ? 'Creating...' : 'New Note'}
              </button>
            </div>

            {/* Recent Notes */}
            <div className="animate-slide-up">
              <RecentNotes
                notes={recentNotes}
                onNoteClick={(id) => router.push(`/notes/${id}`)}
                isLoading={isLoading}
              />
            </div>

            {/* Empty state */}
            {!isLoading && recentNotes.length === 0 && notebooks.length === 0 && (
              <div className="text-center py-16 animate-fade-in">
                <h2 className="text-display-sm font-display text-text-primary mb-3">
                  Welcome to CheatBook
                </h2>
                <p className="text-text-secondary mb-8 max-w-md mx-auto">
                  Create a notebook to start saving notes, scripts, IPs, and anything your IT team needs to remember.
                </p>
                <button
                  onClick={() => setShowCreateNotebook(true)}
                  className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-6 py-3 text-sm transition"
                >
                  Create First Notebook
                </button>
              </div>
            )}

            {/* Has notebooks but no notes */}
            {!isLoading && recentNotes.length === 0 && notebooks.length > 0 && (
              <div className="text-center py-16 animate-fade-in">
                <h2 className="text-display-sm font-display text-text-primary mb-3">
                  Ready to go
                </h2>
                <p className="text-text-secondary mb-8">
                  Select a notebook in the sidebar and create your first note.
                </p>
                <button
                  onClick={handleNewNoteClick}
                  disabled={isCreatingNote}
                  className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-6 py-3 text-sm transition disabled:opacity-50"
                >
                  Create First Note
                </button>
              </div>
            )}

            {/* Activity Feed — below recent notes on desktop */}
            {activities.length > 0 && (
              <div className="mt-10 animate-slide-up">
                <ActivityFeed activities={activities} isLoading={isLoading} />
              </div>
            )}
          </div>
        </div>

        {/* Dialogs */}
        <InputDialog
          isOpen={showCreateNotebook}
          onClose={() => { setShowCreateNotebook(false); setCreateError(null); }}
          onSubmit={handleCreateNotebook}
          title="Create a Notebook"
          placeholder="e.g. Network, Servers, Scripts..."
          submitLabel="Create Notebook"
          error={createError}
        />
        <NotebookPickerDialog
          isOpen={showNotebookPicker}
          onClose={() => setShowNotebookPicker(false)}
          onSelect={quickCreateNote}
          notebooks={notebooks}
        />
      </Layout>
    </ProtectedRoute>
  );
}
