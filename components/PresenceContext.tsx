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

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            name: user.name,
            color: colorForId(user.id),
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
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
