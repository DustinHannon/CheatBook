import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import PinnedNotes from '../components/Dashboard/PinnedNotes';
import RecentNotes from '../components/Dashboard/RecentNotes';
import CategoryChips from '../components/Dashboard/CategoryChips';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import InputDialog from '../components/InputDialog';
import NotebookPickerDialog from '../components/NotebookPickerDialog';
import { useAuth } from '../components/AuthContext';
import { useTeam } from '../components/TeamContext';
import { createClient } from '../lib/supabase/client';
import {
  getNotebooks,
  getPinnedNotes,
  getRecentTeamNotes,
  getCategories,
  getRecentActivity,
} from '../lib/api';
import type { Note, Category, ActivityLogEntry } from '../lib/api';
import { FolderIcon, PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

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
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([]);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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

  // Fetch all dashboard data
  useEffect(() => {
    if (!user || !team) return;
    const fetchAll = async () => {
      try {
        const [nbs, pinned, recent, cats, activity] = await Promise.all([
          getNotebooks(supabase),
          getPinnedNotes(supabase, team.id),
          getRecentTeamNotes(supabase, team.id, 12),
          getCategories(supabase, team.id),
          getRecentActivity(supabase, team.id, 20),
        ]);
        setNotebooks(nbs);
        setPinnedNotes(pinned);
        setRecentNotes(recent);
        setCategories(cats);
        setActivities(activity);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [user, team]);

  const handleNoteClick = (noteId: string) => {
    router.push(`/notes/${noteId}`);
  };

  // Create notebook via InputDialog
  const handleCreateNotebook = async (title: string) => {
    setCreateError(null);
    if (!user?.id || !team?.id) {
      setCreateError('Not authenticated or no team');
      return;
    }
    try {
      const { data: nb, error } = await supabase
        .from('notebooks')
        .insert({ title, owner_id: user.id, team_id: team.id })
        .select()
        .single();
      if (error) throw error;
      setNotebooks(prev => [{ ...nb, note_count: 0 }, ...prev]);
      setShowCreateNotebook(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create notebook');
    }
  };

  // Quick-create a blank note in a notebook and navigate to editor
  const quickCreateNote = async (notebookId: string) => {
    if (!user?.id || isCreatingNote) return;
    setIsCreatingNote(true);
    try {
      const { data: newNote, error } = await supabase
        .from('notes')
        .insert({ title: 'Untitled', notebook_id: notebookId, owner_id: user.id, last_edited_by: user.id })
        .select()
        .single();
      if (error) throw error;
      setShowNotebookPicker(false);
      router.push(`/notes/${newNote.id}`);
    } catch (err) {
      console.error('Error creating note:', err);
    } finally {
      setIsCreatingNote(false);
    }
  };

  // "New Note" button handler
  const handleNewNoteClick = () => {
    if (notebooks.length === 0) {
      setShowCreateNotebook(true);
    } else if (notebooks.length === 1) {
      quickCreateNote(notebooks[0].id);
    } else {
      setShowNotebookPicker(true);
    }
  };

  // Filter recent notes by category
  const filteredNotes = selectedCategory
    ? recentNotes.filter(n => n.categories?.some(c => c.id === selectedCategory))
    : recentNotes;

  if (needsTeamSetup) return null;

  return (
    <ProtectedRoute>
      <Layout
        notebooks={notebooks}
        onSelectNotebook={(id) => router.push(`/notebooks/${id}`)}
        onSelectNote={(id) => router.push(`/notes/${id}`)}
        onCreateNotebook={() => setShowCreateNotebook(true)}
        onCreateNote={handleNewNoteClick}
        showSidebar={false}
      >
        <Head>
          <title>CheatBook</title>
        </Head>

        <div className="h-full bg-bg-base overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-10 animate-fade-in">
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCreateNotebook(true)}
                  className="bg-bg-surface hover:bg-bg-surface-hover text-text-secondary border border-border-default rounded-lg px-4 py-2.5 text-sm transition flex items-center gap-2"
                >
                  <FolderIcon className="w-4 h-4" />
                  New Notebook
                </button>
                <button
                  onClick={handleNewNoteClick}
                  disabled={isCreatingNote}
                  className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-5 py-2.5 text-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  <PlusIcon className="w-4 h-4" />
                  {isCreatingNote ? 'Creating...' : 'New Note'}
                </button>
              </div>
            </div>

            <div className="flex gap-8">
              {/* Main content */}
              <div className="flex-1 min-w-0">
                {/* Pinned Notes */}
                {pinnedNotes.length > 0 && (
                  <div className="mb-10 animate-slide-up stagger-1">
                    <PinnedNotes notes={pinnedNotes} onNoteClick={handleNoteClick} />
                  </div>
                )}

                {/* Category filter */}
                {categories.length > 0 && recentNotes.length > 0 && (
                  <div className="mb-6 animate-slide-up stagger-2">
                    <CategoryChips
                      categories={categories}
                      selectedId={selectedCategory}
                      onSelect={setSelectedCategory}
                    />
                  </div>
                )}

                {/* Recent Notes */}
                {(filteredNotes.length > 0 || isLoading) && (
                  <div className="animate-slide-up stagger-3">
                    <RecentNotes
                      notes={filteredNotes}
                      onNoteClick={handleNoteClick}
                      isLoading={isLoading}
                    />
                  </div>
                )}

                {/* Notebooks grid — show when notebooks exist but no notes */}
                {!isLoading && recentNotes.length === 0 && notebooks.length > 0 && (
                  <div className="animate-slide-up">
                    <h3 className="section-label mb-4">Your Notebooks</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {notebooks.map(nb => (
                        <div
                          key={nb.id}
                          className="bg-bg-raised border border-border-subtle rounded-lg p-5 hover:bg-bg-surface-hover hover:-translate-y-0.5 transition-all group"
                        >
                          <div className="flex items-start justify-between">
                            <div
                              className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                              onClick={() => router.push(`/notebooks/${nb.id}`)}
                            >
                              <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
                                <FolderIcon className="w-5 h-5 text-accent" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-medium text-text-primary truncate">{nb.title}</h4>
                                <p className="text-xs text-text-tertiary mt-0.5">
                                  {nb.note_count || 0} {(nb.note_count || 0) === 1 ? 'note' : 'notes'}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => quickCreateNote(nb.id)}
                              disabled={isCreatingNote}
                              className="opacity-0 group-hover:opacity-100 transition-opacity bg-accent hover:bg-accent-hover text-bg-base rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
                            >
                              <PlusIcon className="w-3 h-3" />
                              Note
                            </button>
                          </div>
                          {nb.description && (
                            <p className="text-sm text-text-secondary mt-3 line-clamp-2">{nb.description}</p>
                          )}
                        </div>
                      ))}

                      {/* Add notebook card */}
                      <button
                        onClick={() => setShowCreateNotebook(true)}
                        className="border border-dashed border-border-default rounded-lg p-5 flex items-center justify-center gap-2 text-text-tertiary hover:text-text-secondary hover:border-border-emphasis transition-colors min-h-[88px]"
                      >
                        <PlusIcon className="w-4 h-4" />
                        <span className="text-sm">Add Notebook</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty state — no notebooks at all */}
                {!isLoading && notebooks.length === 0 && recentNotes.length === 0 && (
                  <div className="text-center py-20 animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-accent-muted flex items-center justify-center mx-auto mb-6">
                      <DocumentTextIcon className="w-8 h-8 text-accent" />
                    </div>
                    <h2 className="text-display-sm font-display text-text-primary mb-3">
                      Welcome to CheatBook
                    </h2>
                    <p className="text-text-secondary mb-8 max-w-md mx-auto">
                      Create your first notebook to start saving notes, scripts, IPs, and anything your IT team needs to remember.
                    </p>
                    <button
                      onClick={() => setShowCreateNotebook(true)}
                      className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-6 py-3 text-sm transition"
                    >
                      Create First Notebook
                    </button>
                  </div>
                )}
              </div>

              {/* Activity Feed — desktop only */}
              <div className="hidden lg:block w-72 flex-shrink-0 animate-slide-up stagger-4">
                <ActivityFeed activities={activities} isLoading={isLoading} />
              </div>
            </div>
          </div>
        </div>

        {/* Create Notebook Dialog */}
        <InputDialog
          isOpen={showCreateNotebook}
          onClose={() => { setShowCreateNotebook(false); setCreateError(null); }}
          onSubmit={handleCreateNotebook}
          title="Create a Notebook"
          placeholder="e.g. Network, Servers, Scripts..."
          submitLabel="Create Notebook"
          error={createError}
        />

        {/* Notebook Picker for new note */}
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
