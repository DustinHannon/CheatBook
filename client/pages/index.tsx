import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import NoteEditor from '../components/NoteEditor';
import ImagePaste from '../components/ImagePaste';
import ProtectedRoute from '../components/ProtectedRoute';

// Sample data for demonstration
const SAMPLE_NOTEBOOKS = [
  {
    id: '1',
    title: 'Work Notes',
    description: 'Professional tasks and meetings',
    owner_id: 'user1',
    note_count: 5,
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    title: 'Personal',
    description: 'Personal projects and ideas',
    owner_id: 'user1',
    note_count: 3,
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const SAMPLE_NOTES = [
  {
    id: '1',
    title: 'Meeting with design team',
    content: JSON.stringify({
      blocks: [
        {
          key: '9eqrc',
          text: 'Discuss new UI components and design system updates.',
          type: 'unstyled',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [],
          data: {},
        },
      ],
      entityMap: {},
    }),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    owner_id: 'user1',
    owner_name: 'Current User',
    notebook_id: '1',
  },
  {
    id: '2',
    title: 'Project roadmap',
    content: JSON.stringify({
      blocks: [
        {
          key: 'a1b2c',
          text: 'Q1 Goals: Launch beta version of the app',
          type: 'header-one',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [],
          data: {},
        },
        {
          key: 'd3e4f',
          text: 'Implement key features:',
          type: 'unstyled',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [],
          data: {},
        },
        {
          key: 'g5h6i',
          text: 'User authentication',
          type: 'unordered-list-item',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [],
          data: {},
        },
        {
          key: 'j7k8l',
          text: 'Note editor with real-time collaboration',
          type: 'unordered-list-item',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [],
          data: {},
        },
      ],
      entityMap: {},
    }),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
    owner_id: 'user1',
    owner_name: 'Current User',
    notebook_id: '1',
  },
  {
    id: '3',
    title: 'Vacation ideas',
    content: JSON.stringify({
      blocks: [
        {
          key: 'm9n0p',
          text: 'Places to visit this summer:',
          type: 'unstyled',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [],
          data: {},
        },
        {
          key: 'q1r2s',
          text: 'Costa Rica',
          type: 'unordered-list-item',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [],
          data: {},
        },
        {
          key: 't3u4v',
          text: 'Japan',
          type: 'unordered-list-item',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [],
          data: {},
        },
      ],
      entityMap: {},
    }),
    updated_at: new Date(Date.now() - 259200000).toISOString(),
    owner_id: 'user1',
    owner_name: 'Current User',
    notebook_id: '2',
  },
];

const SAMPLE_ACTIVE_USERS = [
  {
    id: 'user2',
    name: 'Jane Smith',
    color: '#4f46e5',
    last_active: new Date(),
  },
  {
    id: 'user3',
    name: 'Bob Johnson',
    color: '#16a34a',
    last_active: new Date(Date.now() - 30000),
  },
];

// Types for real-time collaboration
interface ActiveUser {
  id: string;
  name: string;
  color: string;
  last_active: Date;
}

// Main Home component
export default function Home() {
  const [selectedNotebook, setSelectedNotebook] = useState<any>(null);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>(SAMPLE_NOTES);
  const [notebooks, setNotebooks] = useState<any[]>(SAMPLE_NOTEBOOKS);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>(SAMPLE_ACTIVE_USERS);
  const [userToken, setUserToken] = useState<string | null>(null);
  
  // Simulate getting a user token on component mount
  useEffect(() => {
    // In a real app, you would get this from your authentication system
    const simulatedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXIxIiwibmFtZSI6IkN1cnJlbnQgVXNlciIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTYxNjc2MjM5OCwiZXhwIjoxNjE2ODQ4Nzk4fQ.example-token';
    setUserToken(simulatedToken);
  }, []);
  
  // In a real application, you would fetch notes and notebooks from your API
  useEffect(() => {
    // Simulate fetching data
    setNotebooks(SAMPLE_NOTEBOOKS);
  }, []);
  
  // Handle selecting a notebook
  const handleSelectNotebook = (notebookId: string) => {
    const notebook = notebooks.find(nb => nb.id === notebookId);
    setSelectedNotebook(notebook || null);
    
    // Filter notes based on selected notebook
    if (notebook) {
      const filteredNotes = SAMPLE_NOTES.filter(note => note.notebook_id === notebookId);
      setNotes(filteredNotes);
      setSelectedNote(filteredNotes[0] || null);
    } else {
      setNotes([]);
      setSelectedNote(null);
    }
  };
  
  // Handle selecting a note
  const handleSelectNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    setSelectedNote(note || null);
  };
  
  // Handle saving a note
  const handleSaveNote = async (updatedNote: { id?: string; title: string; content: string }) => {
    // In a real app, you would send the update to your API
    // For this demo, we'll just update the state
    
    if (updatedNote.id) {
      // Update existing note
      const updatedNotes = notes.map(note => {
        if (note.id === updatedNote.id) {
          return {
            ...note,
            title: updatedNote.title,
            content: updatedNote.content,
            updated_at: new Date().toISOString()
          };
        }
        return note;
      });
      
      setNotes(updatedNotes);
      setSelectedNote(updatedNotes.find(note => note.id === updatedNote.id) || null);
    } else {
      // Create new note
      const newNote = {
        id: `new_${Date.now()}`,
        title: updatedNote.title,
        content: updatedNote.content,
        updated_at: new Date().toISOString(),
        owner_id: 'user1',
        owner_name: 'Current User',
        notebook_id: selectedNotebook?.id || null
      };
      
      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);
      setSelectedNote(newNote);
    }
    
    return Promise.resolve();
  };
  
  // Handle image paste/upload
  const handleImagePaste = async (file: File, cursorPosition: number) => {
    if (!selectedNote) return;
    
    // In a real app, you would upload the file to your server
    // For this demo, we'll just simulate a delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Log that we would normally upload the file
    console.log('Image pasted and would be uploaded:', {
      fileName: file.name,
      fileSize: file.size,
      noteId: selectedNote.id,
      cursorPosition
    });
    
    // Return a dummy URL that would normally come from your server
    return Promise.resolve();
  };
  
  // Handle deleting a note
  const handleDeleteNote = (noteId: string) => {
    // In a real app, you would send a delete request to your API
    // For this demo, we'll just update the state
    const noteToDelete = notes.find(note => note.id === noteId);
    if (!noteToDelete) return;
    
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    setSelectedNote(updatedNotes[0] || null);
  };
  
  // Handle sharing a note
  const handleShareNote = (noteId: string) => {
    // In a real app, you would open a sharing dialog
    // For this demo, we'll just log to console
    console.log('Share note:', noteId);
    alert(`Sharing note ${noteId} (Demo - would open sharing dialog)`);
  };
  
  // Handle duplicating a note
  const handleDuplicateNote = (noteId: string) => {
    // In a real app, you would send a duplicate request to your API
    // For this demo, we'll just duplicate it in state
    const noteToDuplicate = notes.find(note => note.id === noteId);
    if (!noteToDuplicate) return;
    
    const duplicatedNote = {
      ...noteToDuplicate,
      id: `duplicate_${Date.now()}`,
      title: `${noteToDuplicate.title} (Copy)`,
      updated_at: new Date().toISOString()
    };
    
    const updatedNotes = [...notes, duplicatedNote];
    setNotes(updatedNotes);
    setSelectedNote(duplicatedNote);
  };
  
  return (
    <ProtectedRoute>
      <Layout 
        notebooks={notebooks}
        selectedNotebookId={selectedNotebook?.id}
        onSelectNotebook={handleSelectNotebook}
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
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary truncate">
                {selectedNotebook.title}
              </h2>
              <p className="text-sm text-text-tertiary truncate">
                {selectedNotebook.note_count} {selectedNotebook.note_count === 1 ? 'note' : 'notes'}
              </p>
            </div>
          )}
          
          <div className="overflow-y-auto h-full pb-20">
            {notes.length > 0 ? (
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
            ) : (
              <div className="p-4 text-center text-text-tertiary">
                <p>No notes found.</p>
                <p className="text-sm mt-2">Select a notebook or create a new note.</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedNote ? (
            <ImagePaste 
              onImagePaste={handleImagePaste}
              cursorPosition={0} // This would be obtained from the editor state in a real implementation
            >
              <NoteEditor
                note={selectedNote}
                activeUsers={activeUsers}
                onSave={handleSaveNote}
                onDelete={handleDeleteNote}
                onShare={handleShareNote}
                onDuplicate={handleDuplicateNote}
                userToken={userToken || undefined}
              />
            </ImagePaste>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-background-primary">
              <div className="text-center p-6">
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  Select or Create a Note
                </h2>
                <p className="text-text-secondary">
                  Choose a note from the sidebar or create a new one to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
      </Layout>
    </ProtectedRoute>
  );
}
