import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import NavBar from './NavBar';
import NotesList from './NotesList';
import CommandPalette from './CommandPalette';
import { useTeam } from './TeamContext';
import { createClient } from '../lib/supabase/client';
import { getAllTeamNotes } from '../lib/api';

const supabase = createClient();

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  notebooks?: any[];
  notes?: any[];
  selectedNoteId?: string;
  selectedNotebookId?: string;
  onSelectNote?: (noteId: string) => void;
  onSelectNotebook?: (notebookId: string) => void;
  onCreateNote?: (notebookId?: string) => void;
  onCreateNotebook?: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  showSidebar = true,
  notebooks = [],
  notes = [],
  selectedNoteId,
  selectedNotebookId,
  onSelectNote,
  onSelectNotebook,
  onCreateNote,
  onCreateNotebook,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // The sidebar derives its sections (recent / per-notebook / uncategorized)
  // from the FULL team note set, independent of whichever page is mounted (a
  // note/notebook page only loads a scoped subset for its own body).
  const { team } = useTeam();
  const router = useRouter();
  const [sidebarNotes, setSidebarNotes] = useState<any[]>([]);
  // Re-fetch on route change too (not just team change) so the sidebar reflects
  // notes created/edited/deleted/pinned on the page you just navigated from.
  useEffect(() => {
    if (!team?.id) { setSidebarNotes([]); return; }
    let cancelled = false;
    getAllTeamNotes(supabase, team.id)
      .then((n) => { if (!cancelled) setSidebarNotes(n); })
      .catch(() => { /* sidebar falls back to the page-provided notes */ });
    return () => { cancelled = true; };
  }, [team?.id, router.asPath]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileView(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-bg-base text-text-body">
      {/* Navigation Bar */}
      <NavBar
        onToggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        isMobileView={isMobileView}
        onOpenSearch={openSearch}
      />

      {/* Main area below navbar */}
      <div className="flex flex-1 overflow-hidden pt-[52px]">
        {/* Sidebar */}
        {showSidebar && (
          <>
            {/* Mobile overlay backdrop */}
            {isMobileView && isSidebarOpen && (
              <div
                className="fixed inset-0 z-20 bg-bg-overlay"
                onClick={toggleSidebar}
              />
            )}

            <aside
              className={`${
                isMobileView ? 'fixed top-[52px] left-0 bottom-0 z-30' : 'relative'
              } w-[280px] bg-bg-raised border-r border-border-subtle shrink-0 transition-transform duration-[250ms] ease-out-expo ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              } ${!isSidebarOpen && !isMobileView ? 'absolute' : ''}`}
            >
              <NotesList
                notebooks={notebooks}
                notes={sidebarNotes.length > 0 ? sidebarNotes : notes}
                selectedNoteId={selectedNoteId}
                selectedNotebookId={selectedNotebookId}
                onSelectNote={onSelectNote}
                onSelectNotebook={onSelectNotebook}
                onCreateNote={onCreateNote || (() => {})}
                onCreateNotebook={onCreateNotebook || (() => {})}
              />
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* Command Palette */}
      <CommandPalette isOpen={isSearchOpen} onClose={closeSearch} />
    </div>
  );
};

export default Layout;
