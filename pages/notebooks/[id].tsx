import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import NoteCard from '../../components/NoteCard';
import { SkeletonCard } from '../../components/Skeleton';
import { useAuth } from '../../components/AuthContext';
import { createClient } from '../../lib/supabase/client';
import {
  getNotebooks,
  getNotesForNotebook,
  createNote as apiCreateNote,
} from '../../lib/api';

const supabase = createClient();

export default function NotebookPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  const [notebook, setNotebook] = useState<any>(null);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const nbs = await getNotebooks(supabase);
        setNotebooks(nbs);
        if (id && typeof id === 'string') {
          const nb = nbs.find((n: any) => n.id === id);
          setNotebook(nb || null);
        }
      } catch (err) {
        console.error('Error fetching notebooks:', err);
      }
    };
    fetch();
  }, [user, id]);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    const fetchNotes = async () => {
      try {
        const data = await getNotesForNotebook(supabase, id);
        setNotes(data);
      } catch (err) {
        console.error('Error fetching notes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotes();
  }, [id]);

  const handleCreateNote = async () => {
    if (!id || typeof id !== 'string') return;
    try {
      const newNote = await apiCreateNote(supabase, id, 'Untitled');
      router.push(`/notes/${newNote.id}`);
    } catch (err) {
      console.error('Error creating note:', err);
    }
  };

  return (
    <ProtectedRoute>
      <Layout
        notebooks={notebooks}
        notes={notes}
        selectedNotebookId={typeof id === 'string' ? id : undefined}
        onSelectNotebook={(nbId) => router.push(`/notebooks/${nbId}`)}
        onSelectNote={(noteId) => router.push(`/notes/${noteId}`)}
        onCreateNote={handleCreateNote}
      >
        <Head>
          <title>{notebook?.title || 'Notebook'} - CheatBook</title>
        </Head>

        <div className="h-full bg-bg-base overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-display-sm font-display text-text-primary">
                  {notebook?.title || 'Notebook'}
                </h1>
                {notebook?.description && (
                  <p className="text-sm text-text-secondary mt-1">{notebook.description}</p>
                )}
              </div>
              <button
                onClick={handleCreateNote}
                className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-4 py-2 text-sm transition"
              >
                New Note
              </button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : notes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notes.map(note => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onClick={() => router.push(`/notes/${note.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-text-secondary mb-4">No notes in this notebook yet.</p>
                <button
                  onClick={handleCreateNote}
                  className="text-accent hover:text-accent-hover text-sm transition"
                >
                  Create the first note
                </button>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
