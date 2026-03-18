import React, { useState, useEffect } from 'react';
import NavBar from './NavBar';
import NotesList from './NotesList';
import { useRouter } from 'next/router';

// Types
interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  notebooks?: any[];
  notes?: any[];
  selectedNoteId?: string;
  selectedNotebookId?: string;
  onCreateNote?: () => void;
  onCreateNotebook?: () => void;
  onSelectNotebook?: (notebookId: string) => void;
}

/**
 * Layout Component
 * Main application layout with responsive behavior
 */
const Layout: React.FC<LayoutProps> = ({
  children,
  showSidebar = true,
  notebooks = [],
  notes = [],
  selectedNoteId,
  selectedNotebookId,
  onCreateNote,
  onCreateNotebook,
  onSelectNotebook,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const router = useRouter();

  // Handle responsive layout changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
      
      // Auto-close sidebar on mobile
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Initial check
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Default handlers if not provided
  const defaultCreateNote = () => {
    router.push('/notes/new');
  };

  const defaultCreateNotebook = () => {
    router.push('/notebooks/new');
  };

  return (
    <div className="flex flex-col h-screen bg-background-primary text-text-primary">
      {/* Navigation Bar */}
      <NavBar 
        onToggleSidebar={toggleSidebar} 
        isSidebarOpen={isSidebarOpen} 
        isMobileView={isMobileView}
      />
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && isSidebarOpen && (
          <div className={`${isMobileView ? 'absolute inset-0 z-10' : 'w-64'}`}>
            {isMobileView && (
              <div 
                className="absolute inset-0 bg-black bg-opacity-50 z-0"
                onClick={toggleSidebar}
              />
            )}
            
            <div className={`relative h-full ${isMobileView ? 'w-64 z-10' : 'w-full'}`}>
              <NotesList
                notebooks={notebooks}
                notes={notes}
                selectedNoteId={selectedNoteId}
                selectedNotebookId={selectedNotebookId}
                onCreateNote={onCreateNote || defaultCreateNote}
                onCreateNotebook={onCreateNotebook || defaultCreateNotebook}
                onSelectNotebook={onSelectNotebook}
              />
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
