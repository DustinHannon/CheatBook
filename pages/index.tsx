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

interface ActiveUser {
  id: string;
  name: string;
  color: string;
  last_active: Date;
}

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
    if (!selectedNotebook) {
      setNotes([]);
      return;
    }

    const fetchNotes = async () => {
      try {
        const notebookNotes = await getNotesForNotebook(supabase, selectedNotebook.id);
        setNotes(notebookNotes);
        if (notebookNotes.length > 0) {
          setSelectedNote(notebookNotes[0]);
        } else {
          setSelectedNote(null);
        }
      } catch (err) {
        console.error('Error fetching notes:', err);
      }
    };

    fetchNotes();
  }, [selectedNotebook?.id]);

  const handleSelectNotebook = useCallback((notebookId: string) => {
    const notebook = notebooks.find(nb => nb.id === notebookId);
    setSelectedNotebook(notebook || null);
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
      const updatedNotes = notes.map(note => {
        if (note.id === updatedNote.id) {
          return { ...note, title: updatedNote.title, content: updatedNote.content, updated_at: new Date().toISOString() };
        }
        return note;
      });
      setNotes(updatedNotes);
      setSelectedNote(updatedNotes.find(note => note.id === updatedNote.id) || null);
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
    if (!selectedNotebook) {
      alert('Please select a notebook first.');
      return;
    }

    try {
      const newNote = await apiCreateNote(supabase, selectedNotebook.id, 'Untitled');
      setNotes(prev => [newNote, ...prev]);
      setSelectedNote(newNote);
    } catch (err) {
      console.error('Error creating note:', err);
    }
  };

  const handleImagePaste = async (file: File, cursorPosition: number) => {
    if (!selectedNote) return;

    try {
      await uploadNoteImage(supabase, selectedNote.id, file);
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await apiDeleteNote(supabase, noteId);
      const updatedNotes = notes.filter(note => note.id !== noteId);
      setNotes(updatedNotes);
      setSelectedNote(updatedNotes[0] || null);
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleShareNote = (noteId: string) => {
    alert('Sharing will be available in the redesign.');
  };

  const handleDuplicateNote = async (noteId: string) => {
    const noteToDuplicate = notes.find(note => note.id === noteId);
    if (!noteToDuplicate || !selectedNotebook) return;

    try {
      const newNote = await apiCreateNote(
        supabase,
        selectedNotebook.id,
        `${noteToDuplicate.title} (Copy)`,
        noteToDuplicate.content
      );
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
        selectedNotebookId={selectedNotebook?.id}
        onSelectNotebook={handleSelectNotebook}
        onCreateNotebook={handleCreateNotebook}
        onCreateNote={handleCreateNote}
      >
        <Head>
          <title>CheatBook - Your Collaborative Notes</title>
          <meta name="description" content="A real-time multi-user note-taking web app" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <main className="flex h-full">
          {/* Sidebar with notes list */}
          <div className="w-64 border-r border-border bg-background-secondary">
            {selectedNotebook && (
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary truncate">
                    {selectedNotebook.title}
                  </h2>
                  <p className="text-sm text-text-tertiary truncate">
                    {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                  </p>
                </div>
                <button
                  onClick={handleCreateNote}
                  className="p-1.5 rounded text-text-secondary hover:bg-surface-hover"
                  title="New note"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            )}

            <div className="overflow-y-auto h-full pb-20">
              {isLoading ? (
                <div className="p-4 text-center text-text-tertiary animate-pulse">Loading...</div>
              ) : notes.length > 0 ? (
                <ul className="divide-y divide-border">
                  {notes.map(note => (
                    <li
                      key={note.id}
                      className={`px-4 py-3 cursor-pointer hover:bg-surface-hover
                        ${selectedNote?.id === note.id ? 'bg-surface' : ''}`}
                      onClick={() => handleSelectNote(note.id)}
                    >
                      <h3 className="font-medium text-text-primary truncate">
                        {note.title}
                      </h3>
                      <p className="text-xs text-text-tertiary mt-1">
                        Updated {new Date(note.updated_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : selectedNotebook ? (
                <div className="p-4 text-center text-text-tertiary">
                  <p>No notes yet.</p>
                  <button
                    onClick={handleCreateNote}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Create your first note
                  </button>
                </div>
              ) : (
                <div className="p-4 text-center text-text-tertiary">
                  <p>Select a notebook to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedNote ? (
              <ImagePaste
                onImagePaste={handleImagePaste}
                cursorPosition={0}
              >
                <NoteEditor
                  note={selectedNote}
                  onSave={handleSaveNote}
                  onDelete={handleDeleteNote}
                  onShare={handleShareNote}
                  onDuplicate={handleDuplicateNote}
                />
              </ImagePaste>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-background-primary">
                <div className="text-center p-6">
                  <h2 className="text-xl font-semibold text-text-primary mb-2">
                    {notebooks.length === 0 ? 'Welcome to CheatBook' : 'Select or Create a Note'}
                  </h2>
                  <p className="text-text-secondary">
                    {notebooks.length === 0
                      ? 'Create a notebook to get started.'
                      : 'Choose a note from the sidebar or create a new one to get started.'}
                  </p>
                  {notebooks.length === 0 && (
                    <button
                      onClick={handleCreateNotebook}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Create First Notebook
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </Layout>
    </ProtectedRoute>
  );
}
