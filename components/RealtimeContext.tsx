import React, { createContext, useContext, useCallback, useRef } from 'react';
import { createClient } from '../lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeContextType {
  joinNote: (noteId: string, userId: string, userName: string) => RealtimeChannel;
  leaveNote: (noteId: string) => void;
  getChannel: (noteId: string) => RealtimeChannel | undefined;
}

const RealtimeContext = createContext<RealtimeContextType>({
  joinNote: () => { throw new Error('RealtimeProvider not mounted'); },
  leaveNote: () => {},
  getChannel: () => undefined,
});

const supabase = createClient();

// Deterministic color from user ID
function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());

  const joinNote = useCallback((noteId: string, userId: string, userName: string) => {
    // If already subscribed, return existing channel
    const existing = channelsRef.current.get(noteId);
    if (existing) return existing;

    const channel = supabase.channel(`note:${noteId}`, {
      config: { presence: { key: userId } },
    });

    // Subscribe to postgres changes for this note
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notes',
        filter: `id=eq.${noteId}`,
      },
      (payload) => {
        // This will be handled by consumers via channel.on()
      }
    );

    // Track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: userId,
          user_name: userName,
          color: getUserColor(userId),
          cursor_position: null,
          is_typing: false,
          online_at: new Date().toISOString(),
        });
      }
    });

    channelsRef.current.set(noteId, channel);
    return channel;
  }, []);

  const leaveNote = useCallback((noteId: string) => {
    const channel = channelsRef.current.get(noteId);
    if (channel) {
      channel.untrack();
      supabase.removeChannel(channel);
      channelsRef.current.delete(noteId);
    }
  }, []);

  const getChannel = useCallback((noteId: string) => {
    return channelsRef.current.get(noteId);
  }, []);

  return (
    <RealtimeContext.Provider value={{ joinNote, leaveNote, getChannel }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeContext);
export { getUserColor };
export default RealtimeContext;
