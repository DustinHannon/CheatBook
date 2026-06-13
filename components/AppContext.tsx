import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode, useMemo } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from './AuthContext';
import { usePresence } from './PresenceContext';
import {
  getCurrentMember, getMembers, getSpaces, getNotes, getActivity,
  getUserTeamId, setStar as apiSetStar, setPinned as apiSetPinned,
  createNote as apiCreateNote, createSpace as apiCreateSpace, logActivity,
} from '../lib/api';
import type { Member, Space, Note, ActivityEvent } from '../lib/types';

type AppContextType = {
  loading: boolean;
  teamId: string | null;
  me: Member | null;
  members: Member[];          // with live `online` flag merged in
  spaces: Space[];
  notes: Note[];
  activity: ActivityEvent[];
  // overlays
  paletteOpen: boolean;
  accountOpen: boolean;
  navOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  toggleAccount: () => void;
  closeAccount: () => void;
  openNav: () => void;
  closeNav: () => void;
  // data ops
  refreshNotes: () => Promise<void>;
  refreshSpaces: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  refreshMe: () => Promise<void>;
  toggleStar: (noteId: string) => Promise<void>;
  setPinned: (noteId: string, pinned: boolean) => Promise<void>;
  createNote: (spaceId: string, title?: string) => Promise<Note | null>;
  createSpace: (name: string, color?: string) => Promise<Space | null>;
  memberById: (id: string) => Member | undefined;
  starredCount: number;
};

const AppContext = createContext<AppContextType>({} as AppContextType);
const supabase = createClient();

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { onlineIds } = usePresence();

  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [rawMembers, setRawMembers] = useState<Member[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const teamIdRef = useRef<string | null>(null);

  const refreshNotes = useCallback(async () => {
    if (!teamIdRef.current) return;
    try { setNotes(await getNotes(supabase, teamIdRef.current)); } catch { /* keep prior */ }
  }, []);
  const refreshSpaces = useCallback(async () => {
    if (!teamIdRef.current) return;
    try { setSpaces(await getSpaces(supabase, teamIdRef.current)); } catch { /* keep prior */ }
  }, []);
  const refreshActivity = useCallback(async () => {
    if (!teamIdRef.current) return;
    try { setActivity(await getActivity(supabase, teamIdRef.current)); } catch { /* keep prior */ }
  }, []);
  const refreshMe = useCallback(async () => {
    try { setMe(await getCurrentMember(supabase)); } catch { /* keep prior */ }
  }, []);

  // Initial load on auth.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Clear all derived state on logout/user-switch so the prior session's data
      // can't linger and the live team channel (keyed on teamId) tears down.
      teamIdRef.current = null;
      setTeamId(null); setMe(null); setRawMembers([]); setSpaces([]); setNotes([]); setActivity([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const tid = await getUserTeamId(supabase);
        if (cancelled) return;
        teamIdRef.current = tid;
        setTeamId(tid);
        const [meRes, membersRes, spacesRes, notesRes, activityRes] = await Promise.allSettled([
          getCurrentMember(supabase),
          tid ? getMembers(supabase, tid) : Promise.resolve([]),
          tid ? getSpaces(supabase, tid) : Promise.resolve([]),
          tid ? getNotes(supabase, tid) : Promise.resolve([]),
          tid ? getActivity(supabase, tid) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        if (meRes.status === 'fulfilled') setMe(meRes.value);
        if (membersRes.status === 'fulfilled') setRawMembers(membersRes.value);
        if (spacesRes.status === 'fulfilled') setSpaces(spacesRes.value);
        if (notesRes.status === 'fulfilled') setNotes(notesRes.value);
        if (activityRes.status === 'fulfilled') setActivity(activityRes.value);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  // Live team updates: refetch notes + activity on relevant DB changes (debounced).
  useEffect(() => {
    if (!teamId) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => { if (t) clearTimeout(t); t = setTimeout(() => { refreshNotes(); refreshActivity(); }, 400); };
    const channel = supabase
      .channel(`cb-team:${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notebooks' }, () => { refreshSpaces(); })
      .subscribe();
    return () => { if (t) clearTimeout(t); supabase.removeChannel(channel); };
  }, [teamId, refreshNotes, refreshActivity, refreshSpaces]);

  // Merge live presence into members + me.
  const members = useMemo(
    () => rawMembers.map((m) => ({ ...m, online: onlineIds.has(m.id) })),
    [rawMembers, onlineIds],
  );

  const memberById = useCallback((id: string) => members.find((m) => m.id === id), [members]);

  const toggleStar = useCallback(async (noteId: string) => {
    let next = false;
    setNotes((prev) => prev.map((n) => {
      if (n.id !== noteId) return n;
      next = !n.starredByMe;
      return { ...n, starredByMe: next };
    }));
    try { await apiSetStar(supabase, noteId, next); }
    catch { setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, starredByMe: !next } : n))); }
  }, []);

  const setPinned = useCallback(async (noteId: string, pinned: boolean) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, pinned } : n)));
    try { await apiSetPinned(supabase, noteId, pinned); }
    catch { setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, pinned: !pinned } : n))); }
  }, []);

  const createNote = useCallback(async (spaceId: string, title?: string) => {
    try {
      const note = await apiCreateNote(supabase, spaceId, title);
      setNotes((prev) => [note, ...prev]);
      if (teamIdRef.current) logActivity(supabase, teamIdRef.current, 'created', 'note', note.id, note.title);
      return note;
    } catch { return null; }
  }, []);

  const createSpace = useCallback(async (name: string, color?: string) => {
    try {
      const sp = await apiCreateSpace(supabase, name, color);
      setSpaces((prev) => [...prev, sp].sort((a, b) => a.sortOrder - b.sortOrder));
      return sp;
    } catch { return null; }
  }, []);

  const starredCount = useMemo(() => notes.filter((n) => n.starredByMe).length, [notes]);

  return (
    <AppContext.Provider value={{
      loading, teamId, me, members, spaces, notes, activity,
      paletteOpen, accountOpen, navOpen,
      openPalette: () => setPaletteOpen(true),
      closePalette: () => setPaletteOpen(false),
      toggleAccount: () => setAccountOpen((v) => !v),
      closeAccount: () => setAccountOpen(false),
      openNav: () => { setNavOpen(true); setAccountOpen(false); },
      closeNav: () => setNavOpen(false),
      refreshNotes, refreshSpaces, refreshActivity, refreshMe,
      toggleStar, setPinned, createNote, createSpace, memberById, starredCount,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
export default AppContext;
