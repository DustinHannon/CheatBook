import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from './AuthContext';
import {
  getTeam,
  getTeamMembers,
  createTeam as apiCreateTeam,
  joinTeam as apiJoinTeam,
  inviteTeamMember,
  removeTeamMember,
  updateMemberRole,
} from '../lib/api';
import type { Team, TeamMember } from '../lib/api';

interface TeamContextType {
  team: Team | null;
  teamMembers: TeamMember[];
  isAdmin: boolean;
  needsTeamSetup: boolean;
  isLoading: boolean;
  createTeam: (name: string) => Promise<void>;
  joinTeam: (inviteCode: string) => Promise<void>;
  inviteMember: (email: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  updateRole: (userId: string, role: string) => Promise<void>;
  refreshTeam: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType>({
  team: null,
  teamMembers: [],
  isAdmin: false,
  needsTeamSetup: false,
  isLoading: true,
  createTeam: async () => {},
  joinTeam: async () => {},
  inviteMember: async () => {},
  removeMember: async () => {},
  updateRole: async () => {},
  refreshTeam: async () => {},
});

const supabase = createClient();

export const TeamProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsTeamSetup, setNeedsTeamSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeamData = useCallback(async () => {
    if (!user?.id) {
      setTeam(null);
      setTeamMembers([]);
      setIsAdmin(false);
      setNeedsTeamSetup(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const teamData = await getTeam(supabase);

      if (!teamData) {
        setTeam(null);
        setTeamMembers([]);
        setIsAdmin(false);
        setNeedsTeamSetup(true);
        setIsLoading(false);
        return;
      }

      setTeam(teamData);
      setNeedsTeamSetup(false);

      const members = await getTeamMembers(supabase, teamData.id);
      setTeamMembers(members);

      const currentMember = members.find(m => m.user_id === user.id);
      setIsAdmin(currentMember?.role === 'owner' || currentMember?.role === 'admin');
    } catch (err) {
      console.error('Failed to fetch team data:', err);
      setTeam(null);
      setTeamMembers([]);
      setIsAdmin(false);
      setNeedsTeamSetup(true);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const handleCreateTeam = useCallback(async (name: string) => {
    await apiCreateTeam(supabase, name);
    await fetchTeamData();
  }, [fetchTeamData]);

  const handleJoinTeam = useCallback(async (inviteCode: string) => {
    await apiJoinTeam(supabase, inviteCode);
    await fetchTeamData();
  }, [fetchTeamData]);

  const handleInviteMember = useCallback(async (email: string) => {
    if (!team) throw new Error('No team');
    await inviteTeamMember(supabase, team.id, email);
    const members = await getTeamMembers(supabase, team.id);
    setTeamMembers(members);
  }, [team]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!team) throw new Error('No team');
    await removeTeamMember(supabase, team.id, userId);
    const members = await getTeamMembers(supabase, team.id);
    setTeamMembers(members);
  }, [team]);

  const handleUpdateRole = useCallback(async (userId: string, role: string) => {
    if (!team) throw new Error('No team');
    await updateMemberRole(supabase, team.id, userId, role);
    const members = await getTeamMembers(supabase, team.id);
    setTeamMembers(members);
  }, [team]);

  return (
    <TeamContext.Provider
      value={{
        team,
        teamMembers,
        isAdmin,
        needsTeamSetup,
        isLoading,
        createTeam: handleCreateTeam,
        joinTeam: handleJoinTeam,
        inviteMember: handleInviteMember,
        removeMember: handleRemoveMember,
        updateRole: handleUpdateRole,
        refreshTeam: fetchTeamData,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => useContext(TeamContext);

export default TeamContext;
