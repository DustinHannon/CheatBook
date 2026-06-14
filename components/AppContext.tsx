import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode, useMemo } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from './AuthContext';
import { usePresence } from './PresenceContext';
import {
  getCurrentMember, getMembers, getSpaces, getNotes, getActivity,
  setStar as apiSetStar, setPinned as apiSetPinned,
  createNote as apiCreateNote, createSpace as apiCreateSpace,
  deleteNote as apiDeleteNote, moveNoteToSpace as apiMoveNote,
  updateSpace as apiUpdateSpace, deleteSpace as apiDeleteSpace, logActivity,
} from '../lib/api';
import type { Member, Space, Note, ActivityEvent } from '../lib/types';

// Single platform now — the live channel is keyed on a constant, not a team.
const PLATFORM_CHANNEL = 'cb-platform';

type AppContextType = {
  loading: boolean;
  approved: boolean;          // platform access granted by an admin
  isPending: boolean;         // authed, loaded, but not yet approved
  isAdmin: boolean;           // current member is a platform admin
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
  refreshMembers: () => Promise<void>;
  toggleStar: (noteId: string) => Promise<void>;
  setPinned: (noteId: string, pinned: boolean) => Promise<void>;
  createNote: (spaceId: string, title?: string) => Promise<Note | null>;
  deleteNote: (noteId: string) => Promise<boolean>;
  moveNote: (noteId: string, toSpaceId: string) => Promise<boolean>;
  createSpace: (name: string, color?: string) => Promise<Space | null>;
  updateSpace: (spaceId: string, updates: { name?: string; color?: string }) => Promise<boolean>;
  deleteSpace: (spaceId: string) => Promise<boolean>;
  memberById: (id: string) => Member | undefined;
  starredCount: number;
};

const AppContext = createContext<AppContextType>({} as AppContextType);
const supabase = createClient();

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { onlineIds } = usePresence();

  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [me, setMe] = useState<Member | null>(null);
  const [rawMembers, setRawMembers] = useState<Member[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const approvedRef = useRef(false);
  // Mirrors of list state so data ops can read current values without taking
  // notes/spaces as deps (which would re-create the live-channel effect).
  const notesRef = useRef<Note[]>([]);
  const spacesRef = useRef<Space[]>([]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { spacesRef.current = spaces; }, [spaces]);
  // Current user id for the realtime effect (without taking `me` as a dep, which
  // would tear down + re-subscribe the channel on every profile change).
  const meIdRef = useRef<string | null>(null);
  useEffect(() => { meIdRef.current = me?.id ?? null; }, [me]);

  const refreshNotes = useCallback(async () => {
    if (!approvedRef.current) return;
    try { setNotes(await getNotes(supabase)); } catch { /* keep prior */ }
  }, []);
  const refreshSpaces = useCallback(async () => {
    if (!approvedRef.current) return;
    try { setSpaces(await getSpaces(supabase)); } catch { /* keep prior */ }
  }, []);
  const refreshActivity = useCallback(async () => {
    if (!approvedRef.current) return;
    try { setActivity(await getActivity(supabase)); } catch { /* keep prior */ }
  }, []);
  const refreshMe = useCallback(async () => {
    try { setMe(await getCurrentMember(supabase)); } catch { /* keep prior */ }
  }, []);
  const refreshMembers = useCallback(async () => {
    if (!approvedRef.current) return;
    try { setRawMembers(await getMembers(supabase)); } catch { /* keep prior */ }
  }, []);

  // Initial load on auth.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Clear all derived state on logout/user-switch so the prior session's data
      // can't linger and the live platform channel tears down.
      approvedRef.current = false;
      setApproved(false); setMe(null); setRawMembers([]); setSpaces([]); setNotes([]); setActivity([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // One profile read does double duty: it IS the current Member AND carries
        // the binary `approved` flag — no separate pre-flight round-trip, and the
        // current-user profile is no longer fetched twice.
        const meMember = await getCurrentMember(supabase);
        if (cancelled) return;
        const isApproved = meMember.approved;
        approvedRef.current = isApproved;
        setApproved(isApproved);
        setMe(meMember);
        const [membersRes, spacesRes, notesRes, activityRes] = await Promise.allSettled([
          isApproved ? getMembers(supabase) : Promise.resolve([] as Member[]),
          isApproved ? getSpaces(supabase) : Promise.resolve([] as Space[]),
          isApproved ? getNotes(supabase) : Promise.resolve([] as Note[]),
          isApproved ? getActivity(supabase) : Promise.resolve([] as ActivityEvent[]),
        ]);
        if (cancelled) return;
        if (membersRes.status === 'fulfilled') setRawMembers(membersRes.value);
        if (spacesRes.status === 'fulfilled') setSpaces(spacesRes.value);
        if (notesRes.status === 'fulfilled') setNotes(notesRes.value);
        if (activityRes.status === 'fulfilled') setActivity(activityRes.value);
      } catch {
        // getCurrentMember failed (rare: missing profile / transient) — leave state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  // Live platform updates: refetch on relevant DB changes (debounced). A note
  // change affects BOTH the notes list and per-space note counts, so it refreshes
  // spaces too. Profile changes refresh members + me so names/avatars/titles stay
  // live. One channel for the whole platform now (no team scoping); gated on
  // approval so unapproved users don't subscribe.
  useEffect(() => {
    if (!approved) return;
    let tn: ReturnType<typeof setTimeout> | null = null;
    let ta: ReturnType<typeof setTimeout> | null = null;
    let tp: ReturnType<typeof setTimeout> | null = null;
    const bumpProfiles = () => {
      if (tp) clearTimeout(tp);
      tp = setTimeout(() => { refreshMembers(); refreshMe(); }, 600);
    };
    const channel = supabase
      .channel(PLATFORM_CHANNEL)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
        // Skip the editing user's OWN autosave UPDATEs: they already hold the
        // latest body via Yjs and an UPDATE changes no note count. Without this,
        // every 2s autosave fired a full 338-note refetch storm while typing.
        const ev = (payload as { eventType?: string }).eventType;
        const editedBy = (payload as { new?: { last_edited_by?: string } }).new?.last_edited_by;
        if (ev === 'UPDATE' && editedBy === meIdRef.current) return;
        if (tn) clearTimeout(tn);
        tn = setTimeout(() => {
          refreshNotes();
          if (ev === 'INSERT' || ev === 'DELETE') refreshSpaces(); // counts only change on add/remove
        }, 1200);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
        if (ta) clearTimeout(ta);
        ta = setTimeout(() => refreshActivity(), 1200);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notebooks' }, () => { refreshSpaces(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, bumpProfiles)
      .subscribe();
    return () => { if (tn) clearTimeout(tn); if (ta) clearTimeout(ta); if (tp) clearTimeout(tp); supabase.removeChannel(channel); };
  }, [approved, refreshNotes, refreshActivity, refreshSpaces, refreshMembers, refreshMe]);

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

  // Adjust a space's local noteCount so the sidebar tally stays correct the
  // instant a note is created/deleted/moved, without waiting on a refetch.
  const bumpSpaceCount = useCallback((spaceId: string | null | undefined, delta: number) => {
    if (!spaceId) return;
    setSpaces((prev) => prev.map((s) => (s.id === spaceId ? { ...s, noteCount: Math.max(0, s.noteCount + delta) } : s)));
  }, []);

  const createNote = useCallback(async (spaceId: string, title?: string) => {
    try {
      const note = await apiCreateNote(supabase, spaceId, title);
      setNotes((prev) => [note, ...prev]);
      bumpSpaceCount(spaceId, +1);
      logActivity(supabase, 'created', 'note', note.id, note.title);
      return note;
    } catch { return null; }
  }, [bumpSpaceCount]);

  const deleteNote = useCallback(async (noteId: string) => {
    const target = notesRef.current.find((n) => n.id === noteId);
    // Optimistic: drop the note + decrement its space count immediately.
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    bumpSpaceCount(target?.spaceId, -1);
    try {
      await apiDeleteNote(supabase, noteId);
      logActivity(supabase, 'deleted', 'note', noteId, target?.title ?? null);
      return true;
    } catch {
      // Revert by refetching the authoritative lists.
      refreshNotes(); refreshSpaces();
      return false;
    }
  }, [bumpSpaceCount, refreshNotes, refreshSpaces]);

  const moveNote = useCallback(async (noteId: string, toSpaceId: string) => {
    const target = notesRef.current.find((n) => n.id === noteId);
    const fromSpaceId = target?.spaceId ?? null;
    if (fromSpaceId === toSpaceId) return true;
    const toSpace = spacesRef.current.find((s) => s.id === toSpaceId) || null;
    setNotes((prev) => prev.map((n) => (
      n.id === noteId
        ? { ...n, spaceId: toSpaceId, space: toSpace ? { id: toSpace.id, name: toSpace.name, color: toSpace.color } : n.space }
        : n
    )));
    bumpSpaceCount(fromSpaceId, -1);
    bumpSpaceCount(toSpaceId, +1);
    try {
      await apiMoveNote(supabase, noteId, toSpaceId);
      return true;
    } catch {
      refreshNotes(); refreshSpaces();
      return false;
    }
  }, [bumpSpaceCount, refreshNotes, refreshSpaces]);

  const createSpace = useCallback(async (name: string, color?: string) => {
    try {
      const sp = await apiCreateSpace(supabase, name, color);
      setSpaces((prev) => [...prev, sp].sort((a, b) => a.sortOrder - b.sortOrder));
      return sp;
    } catch { return null; }
  }, []);

  const updateSpace = useCallback(async (spaceId: string, updates: { name?: string; color?: string }) => {
    const prev = spacesRef.current.find((s) => s.id === spaceId);
    // Optimistic local rename/recolor.
    setSpaces((cur) => cur.map((s) => (s.id === spaceId ? { ...s, ...('name' in updates ? { name: updates.name! } : {}), ...('color' in updates ? { color: updates.color! } : {}) } : s)));
    try {
      await apiUpdateSpace(supabase, spaceId, updates);
      // Notes carry a denormalised space summary (badge color/name) — refresh them
      // so a recolor/rename reflects on every note card + breadcrumb.
      refreshNotes();
      return true;
    } catch {
      if (prev) setSpaces((cur) => cur.map((s) => (s.id === spaceId ? prev : s)));
      return false;
    }
  }, [refreshNotes]);

  // Deleting a space CASCADE-deletes its notes (notes_notebook_id_fkey ON DELETE
  // CASCADE), so drop both the space and its notes locally; revert on failure.
  const deleteSpace = useCallback(async (spaceId: string) => {
    const spaceSnapshot = spacesRef.current;
    const noteSnapshot = notesRef.current;
    setSpaces((cur) => cur.filter((s) => s.id !== spaceId));
    setNotes((cur) => cur.filter((n) => n.spaceId !== spaceId));
    try {
      await apiDeleteSpace(supabase, spaceId);
      return true;
    } catch {
      setSpaces(spaceSnapshot);
      setNotes(noteSnapshot);
      return false;
    }
  }, []);

  const starredCount = useMemo(() => notes.filter((n) => n.starredByMe).length, [notes]);

  // Pending: authenticated and loaded but not yet approved (awaiting an admin).
  // Admin: current member is a platform admin (role sourced from is_admin). Both
  // gate the Users management UI and the pending-onboarding state.
  const isPending = !loading && isAuthenticated && !approved;
  const isAdmin = me?.role === 'admin';

  return (
    <AppContext.Provider value={{
      loading, approved, isPending, isAdmin, me, members, spaces, notes, activity,
      paletteOpen, accountOpen, navOpen,
      openPalette: () => setPaletteOpen(true),
      closePalette: () => setPaletteOpen(false),
      toggleAccount: () => setAccountOpen((v) => !v),
      closeAccount: () => setAccountOpen(false),
      openNav: () => { setNavOpen(true); setAccountOpen(false); },
      closeNav: () => setNavOpen(false),
      refreshNotes, refreshSpaces, refreshActivity, refreshMe, refreshMembers,
      toggleStar, setPinned, createNote, deleteNote, moveNote,
      createSpace, updateSpace, deleteSpace, memberById, starredCount,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
export default AppContext;
