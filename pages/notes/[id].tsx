import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import NoteEditor from '../../components/NoteEditor';
import ImagePaste from '../../components/ImagePaste';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { createClient } from '../../lib/supabase/client';
import {
  getNotebooks,
  getNotesForNotebook,
  getNote,
  deleteNote as apiDeleteNote,
  uploadNoteImage,
} from '../../lib/api';

const supabase = createClient();

export default function NotePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  const [note, setNote] = useState<any>(null);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notebooks
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const nbs = await getNotebooks(supabase);
        setNotebooks(nbs);
      } catch (err) {
        console.error('Error fetching notebooks:', err);
      }
    };
    fetchData();
  }, [user]);

  // Fetch note by ID
  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    const fetchNote = async () => {
      try {
        const fullNote = await getNote(supabase, id);
        setNote(fullNote);
        if (fullNote.notebook_id) {
          setSelectedNotebookId(fullNote.notebook_id);
          const nbNotes = await getNotesForNotebook(supabase, fullNote.notebook_id);
          setNotes(nbNotes);
        }
      } catch (err) {
        console.error('Error fetching note:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNote();
  }, [id]);

  const handleSelectNotebook = useCallback(async (notebookId: string) => {
    setSelectedNotebookId(notebookId);
    try {
      const nbNotes = await getNotesForNotebook(supabase, notebookId);
      setNotes(nbNotes);
    } catch (err) {
      console.error('Error fetching notes:', err);
    }
  }, []);

  const handleSelectNote = useCallback((noteId: string) => {
    router.push(`/notes/${noteId}`);
  }, [router]);

  const handleSaveNote = async (updatedNote: { id?: string; title: string; content: string }) => {
    if (updatedNote.id) {
      setNote((prev: any) => prev ? { ...prev, title: updatedNote.title, content: updatedNote.content, updated_at: new Date().toISOString() } : prev);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await apiDeleteNote(supabase, noteId);
      router.push('/');
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleCreateNote = async () => {
    if (!selectedNotebookId || !user?.id) return;
    try {
      const { data: newNote, error } = await supabase
        .from('notes')
        .insert({ title: 'Untitled', notebook_id: selectedNotebookId, owner_id: user.id, last_edited_by: user.id })
        .select()
        .single();
      if (error) throw error;
      router.push(`/notes/${newNote.id}`);
    } catch (err) {
      console.error('Error creating note:', err);
    }
  };

  const handleImagePaste = async (file: File) => {
    if (!note) return;
    try {
      await uploadNoteImage(supabase, note.id, file);
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  };

  const handleDuplicateNote = async () => {
    if (!note || !selectedNotebookId || !user?.id) return;
    try {
      const { data: newNote, error } = await supabase
        .from('notes')
        .insert({ title: `${note.title} (Copy)`, content: note.content, notebook_id: selectedNotebookId, owner_id: user.id, last_edited_by: user.id })
        .select()
        .single();
      if (error) throw error;
      router.push(`/notes/${newNote.id}`);
    } catch (err) {
      console.error('Error duplicating note:', err);
    }
  };

  return (
    <ProtectedRoute>
      <Layout
        notebooks={notebooks}
        notes={notes}
        selectedNotebookId={selectedNotebookId || undefined}
        selectedNoteId={note?.id}
        onSelectNotebook={handleSelectNotebook}
        onSelectNote={handleSelectNote}
        onCreateNote={handleCreateNote}
      >
        <Head>
          <title>{note?.title || 'Note'} - CheatBook</title>
        </Head>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center h-full bg-bg-base">
            <span className="text-text-tertiary animate-pulse font-display text-xl">Loading...</span>
          </div>
        ) : note ? (
          <ImagePaste onImagePaste={handleImagePaste} cursorPosition={0}>
            <NoteEditor
              note={note}
              onSave={handleSaveNote}
              onDelete={handleDeleteNote}
              onDuplicate={handleDuplicateNote}
            />
          </ImagePaste>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full bg-bg-base">
            <div className="text-center">
              <h2 className="text-display-sm font-display text-text-primary mb-3">Note not found</h2>
              <button onClick={() => router.push('/')} className="text-accent hover:text-accent-hover text-sm transition">
                Back to dashboard
              </button>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
