import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import PinnedNotes from '../components/Dashboard/PinnedNotes';
import RecentNotes from '../components/Dashboard/RecentNotes';
import CategoryChips from '../components/Dashboard/CategoryChips';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import { useAuth } from '../components/AuthContext';
import { useTeam } from '../components/TeamContext';
import { createClient } from '../lib/supabase/client';
import {
  getNotebooks,
  getPinnedNotes,
  getRecentTeamNotes,
  getCategories,
  getRecentActivity,
  createNotebook as apiCreateNotebook,
  createNote as apiCreateNote,
} from '../lib/api';
import type { Note, Category, ActivityLogEntry } from '../lib/api';

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

  // Redirect to team setup if needed (only after team loading completes)
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

  const handleCreateNotebook = async () => {
    const title = prompt('Notebook name:');
    if (!title) return;
    try {
      const nb = await apiCreateNotebook(supabase, title);
      setNotebooks(prev => [{ ...nb, note_count: 0 }, ...prev]);
    } catch (err) {
      console.error('Error creating notebook:', err);
    }
  };

  const handleQuickCreate = async () => {
    if (notebooks.length === 0) {
      handleCreateNotebook();
      return;
    }
    // Create in the first notebook
    try {
      const newNote = await apiCreateNote(supabase, notebooks[0].id, 'Untitled');
      router.push(`/notes/${newNote.id}`);
    } catch (err) {
      console.error('Error creating note:', err);
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
        onCreateNotebook={handleCreateNotebook}
        onCreateNote={handleQuickCreate}
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
              <button
                onClick={handleQuickCreate}
                className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-5 py-2.5 text-sm transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Note
              </button>
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
                {categories.length > 0 && (
                  <div className="mb-6 animate-slide-up stagger-2">
                    <CategoryChips
                      categories={categories}
                      selectedId={selectedCategory}
                      onSelect={setSelectedCategory}
                    />
                  </div>
                )}

                {/* Recent Notes */}
                <div className="animate-slide-up stagger-3">
                  <RecentNotes
                    notes={filteredNotes}
                    onNoteClick={handleNoteClick}
                    isLoading={isLoading}
                  />
                </div>

                {/* Empty state */}
                {!isLoading && recentNotes.length === 0 && (
                  <div className="text-center py-20 animate-fade-in">
                    <h2 className="text-display-sm font-display text-text-primary mb-3">
                      Welcome to CheatBook
                    </h2>
                    <p className="text-text-secondary mb-8 max-w-md mx-auto">
                      Create your first notebook to start saving notes, scripts, IPs, and anything your IT team needs to remember.
                    </p>
                    <button
                      onClick={handleCreateNotebook}
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
      </Layout>
    </ProtectedRoute>
  );
}
