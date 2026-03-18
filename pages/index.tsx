import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import NoteEditor from '../components/NoteEditor';
import ImagePaste from '../components/ImagePaste';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { createClient } from '../lib/supabase/client';
import {
  getNotebooks,
  getNotesForNotebook,
  createNotebook as apiCreateNotebook,
  createNote as apiCreateNote,
  deleteNote as apiDeleteNote,
  getNote,
  uploadNoteImage,
} from '../lib/api';

const supabase = createClient();

export default function Home() {
  const { user } = useAuth();
  const [selectedNotebook, setSelectedNotebook] = useState<any>(null);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notebooks on mount
  useEffect(() => {
    if (!user) return;
    const fetchNotebooks = async () => {
      try {
        const { owned, shared } = await getNotebooks(supabase);
        setNotebooks([...owned, ...shared]);
      } catch (err) {
        console.error('Error fetching notebooks:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotebooks();
  }, [user]);

  // Fetch notes when notebook is selected
  useEffect(() => {
    if (!selectedNotebook) { setNotes([]); return; }
    const fetchNotes = async () => {
      try {
        const notebookNotes = await getNotesForNotebook(supabase, selectedNotebook.id);
        setNotes(notebookNotes);
        if (notebookNotes.length > 0 && !selectedNote) {
          setSelectedNote(notebookNotes[0]);
        }
      } catch (err) {
        console.error('Error fetching notes:', err);
      }
    };
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNotebook?.id]);

  const handleSelectNotebook = useCallback((notebookId: string) => {
    const notebook = notebooks.find(nb => nb.id === notebookId);
    setSelectedNotebook(notebook || null);
    setSelectedNote(null);
  }, [notebooks]);

  const handleSelectNote = useCallback(async (noteId: string) => {
    try {
      const fullNote = await getNote(supabase, noteId);
      setSelectedNote(fullNote);
    } catch (err) {
      console.error('Error fetching note:', err);
      const note = notes.find(n => n.id === noteId);
      setSelectedNote(note || null);
    }
  }, [notes]);

  const handleSaveNote = async (updatedNote: { id?: string; title: string; content: string }) => {
    if (updatedNote.id) {
      setNotes(prev => prev.map(note =>
        note.id === updatedNote.id
          ? { ...note, title: updatedNote.title, content: updatedNote.content, updated_at: new Date().toISOString() }
          : note
      ));
    }
  };

  const handleCreateNotebook = async () => {
    const title = prompt('Notebook name:');
    if (!title) return;
    try {
      const newNotebook = await apiCreateNotebook(supabase, title);
      setNotebooks(prev => [{ ...newNotebook, note_count: 0 }, ...prev]);
      setSelectedNotebook({ ...newNotebook, note_count: 0 });
    } catch (err) {
      console.error('Error creating notebook:', err);
    }
  };

  const handleCreateNote = async () => {
    if (!selectedNotebook) return;
    try {
      const newNote = await apiCreateNote(supabase, selectedNotebook.id, 'Untitled');
      setNotes(prev => [newNote, ...prev]);
      setSelectedNote(newNote);
    } catch (err) {
      console.error('Error creating note:', err);
    }
  };

  const handleImagePaste = async (file: File) => {
    if (!selectedNote) return;
    try {
      await uploadNoteImage(supabase, selectedNote.id, file);
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await apiDeleteNote(supabase, noteId);
      const updatedNotes = notes.filter(note => note.id !== noteId);
      setNotes(updatedNotes);
      setSelectedNote(updatedNotes[0] || null);
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleDuplicateNote = async (noteId: string) => {
    const noteToDuplicate = notes.find(note => note.id === noteId);
    if (!noteToDuplicate || !selectedNotebook) return;
    try {
      const newNote = await apiCreateNote(supabase, selectedNotebook.id, `${noteToDuplicate.title} (Copy)`, noteToDuplicate.content);
      setNotes(prev => [...prev, newNote]);
      setSelectedNote(newNote);
    } catch (err) {
      console.error('Error duplicating note:', err);
    }
  };

  return (
    <ProtectedRoute>
      <Layout
        notebooks={notebooks}
        notes={notes}
        selectedNotebookId={selectedNotebook?.id}
        selectedNoteId={selectedNote?.id}
        onSelectNotebook={handleSelectNotebook}
        onSelectNote={handleSelectNote}
        onCreateNotebook={handleCreateNotebook}
        onCreateNote={handleCreateNote}
      >
        <Head>
          <title>CheatBook</title>
          <meta name="description" content="A real-time collaborative note-taking app" />
        </Head>

        {selectedNote ? (
          <ImagePaste onImagePaste={handleImagePaste} cursorPosition={0}>
            <NoteEditor
              note={selectedNote}
              onSave={handleSaveNote}
              onDelete={handleDeleteNote}
              onDuplicate={handleDuplicateNote}
            />
          </ImagePaste>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full bg-bg-base">
            <div className="text-center animate-fade-in">
              {notebooks.length === 0 && !isLoading ? (
                <>
                  <h2 className="text-display-sm font-display text-text-primary mb-3">
                    Welcome to CheatBook
                  </h2>
                  <p className="text-text-secondary mb-8">
                    Create a notebook to get started.
                  </p>
                  <button
                    onClick={handleCreateNotebook}
                    className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-6 py-3 text-sm transition"
                  >
                    Create First Notebook
                  </button>
                </>
              ) : selectedNotebook && notes.length === 0 ? (
                <>
                  <h2 className="text-display-sm font-display text-text-primary mb-3">
                    No notes yet
                  </h2>
                  <p className="text-text-secondary mb-8">
                    Create your first note in this notebook.
                  </p>
                  <button
                    onClick={handleCreateNote}
                    className="bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-6 py-3 text-sm transition"
                  >
                    Create Note
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-display-sm font-display text-text-primary mb-3">
                    Select a note
                  </h2>
                  <p className="text-text-secondary">
                    Choose a notebook and note from the sidebar.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
