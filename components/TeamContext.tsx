import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from './AuthContext';
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
  const { user, isAuthenticated } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsTeamSetup, setNeedsTeamSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeamData = useCallback(async () => {
    if (!user?.id || !isAuthenticated) {
      setTeam(null);
      setTeamMembers([]);
      setIsAdmin(false);
      setNeedsTeamSetup(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Get team_id from profile (simple, no RLS issues)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('TeamContext: profile fetch error', profileError);
        setNeedsTeamSetup(true);
        setIsLoading(false);
        return;
      }

      if (!profile?.team_id) {
        setTeam(null);
        setTeamMembers([]);
        setIsAdmin(false);
        setNeedsTeamSetup(true);
        setIsLoading(false);
        return;
      }

      // Step 2: Get team details
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', profile.team_id)
        .single();

      if (teamError || !teamData) {
        console.error('TeamContext: team fetch error', teamError);
        // Team exists in profile but can't read it — might be RLS issue
        // Still set the team as a minimal object so we don't loop
        setTeam({ id: profile.team_id, name: 'My Team', invite_code: '', created_at: '' });
        setNeedsTeamSetup(false);
        setIsLoading(false);
        return;
      }

      setTeam(teamData);
      setNeedsTeamSetup(false);

      // Step 3: Get team members
      const { data: members } = await supabase
        .from('team_members')
        .select('*, profiles:user_id(*)')
        .eq('team_id', teamData.id)
        .order('created_at', { ascending: true });

      setTeamMembers((members || []).map((m: any) => ({ ...m, profiles: m.profiles ?? undefined })));

      const currentMember = (members || []).find((m: any) => m.user_id === user.id);
      setIsAdmin(currentMember?.role === 'admin');
    } catch (err) {
      console.error('TeamContext: unexpected error', err);
      // Don't set needsTeamSetup on unexpected errors — prevent redirect loop
      setNeedsTeamSetup(false);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isAuthenticated]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const handleCreateTeam = useCallback(async (name: string) => {
    const { error } = await supabase.rpc('create_team_with_owner', { team_name: name });
    if (error) throw error;
    await fetchTeamData();
  }, [fetchTeamData]);

  const handleJoinTeam = useCallback(async (inviteCode: string) => {
    const { error } = await supabase.rpc('join_team_by_code', { code: inviteCode });
    if (error) throw error;
    await fetchTeamData();
  }, [fetchTeamData]);

  const handleInviteMember = useCallback(async (email: string) => {
    if (!team) throw new Error('No team');
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).single();
    if (!profile) throw new Error('User not found');
    await supabase.from('team_members').insert({ team_id: team.id, user_id: profile.id, role: 'member' });
    await supabase.from('profiles').update({ team_id: team.id }).eq('id', profile.id);
    await fetchTeamData();
  }, [team, fetchTeamData]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!team) throw new Error('No team');
    await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', userId);
    await supabase.from('profiles').update({ team_id: null }).eq('id', userId);
    await fetchTeamData();
  }, [team, fetchTeamData]);

  const handleUpdateRole = useCallback(async (userId: string, role: string) => {
    if (!team) throw new Error('No team');
    await supabase.from('team_members').update({ role }).eq('team_id', team.id).eq('user_id', userId);
    await fetchTeamData();
  }, [team, fetchTeamData]);

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
