'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from './AuthContext';
import { colorForId } from '../lib/colors';

type PresenceContextType = {
  onlineIds: Set<string>;
  onlineCount: number;
};

const PresenceContext = createContext<PresenceContextType>({ onlineIds: new Set(), onlineCount: 0 });

const supabase = createClient();
const LOBBY = 'cb-presence-lobby';

export const PresenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setOnlineIds(new Set()); return; }

    const channel = supabase.channel(LOBBY, { config: { presence: { key: user.id } } });

    const sync = () => {
      const state = channel.presenceState() as Record<string, { id?: string }[]>;
      setOnlineIds(new Set(Object.keys(state)));
    };

    const track = () =>
      channel.track({
        id: user.id,
        name: user.name,
        color: colorForId(user.id),
        online_at: new Date().toISOString(),
      });

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe((status) => {
        // Fires on the initial join AND on every socket auto-rejoin, so presence
        // is re-announced after a reconnect without extra wiring.
        if (status === 'SUBSCRIBED') void track();
      });

    // Mobile browsers suspend the realtime socket when the tab is backgrounded
    // (app switch, screen lock, the on-screen keyboard). While suspended the
    // server drops our presence on heartbeat timeout, and on resume the client
    // doesn't always re-announce — so an actively-editing phone user silently
    // stops showing as online to everyone. Re-track whenever the page returns to
    // the foreground / regains connectivity. track() is keyed by user.id, so
    // re-asserting is idempotent (no duplicate presence entries).
    const reassert = () => { if (document.visibilityState === 'visible') void track(); };
    document.addEventListener('visibilitychange', reassert);
    window.addEventListener('focus', reassert);
    window.addEventListener('online', reassert);

    return () => {
      document.removeEventListener('visibilitychange', reassert);
      window.removeEventListener('focus', reassert);
      window.removeEventListener('online', reassert);
      channel.untrack().finally(() => {
        supabase.removeChannel(channel);
      });
    };
  }, [user]);

  return (
    <PresenceContext.Provider value={{ onlineIds, onlineCount: onlineIds.size }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => useContext(PresenceContext);
export default PresenceContext;
