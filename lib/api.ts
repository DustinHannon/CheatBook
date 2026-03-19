import { SupabaseClient } from '@supabase/supabase-js';

// Types
export type Notebook = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  team_id: string | null;
  created_at: string;
  updated_at: string;
  note_count?: number;
};

export type Note = {
  id: string;
  title: string;
  content: string | null;
  notebook_id: string | null;
  owner_id: string;
  version: number;
  is_locked: boolean;
  locked_by: string | null;
  is_pinned: boolean;
  last_edited_by: string | null;
  last_edited_by_name?: string;
  created_at: string;
  updated_at: string;
  owner_name?: string;
  categories?: Category[];
};

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  team_id: string | null;
  created_at: string;
  last_login: string | null;
};

export type Collaborator = {
  notebook_id: string;
  user_id: string;
  permission: 'read' | 'write' | 'admin';
  created_at: string;
  profiles?: Profile;
};

export type ImageRecord = {
  id: string;
  note_id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  size: number | null;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

export type TeamMember = {
  team_id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles?: Profile;
};

export type Category = {
  id: string;
  team_id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
};

export type ActivityLogEntry = {
  id: string;
  team_id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_title: string | null;
  created_at: string;
  profiles?: Profile;
};

// ─── Helper ──────────────────────────────────────────────────────────
async function getCurrentUser(supabase: SupabaseClient) {
  // Use getSession() for client-side (reads local cache, faster and more reliable)
  // Falls back to getUser() if session is not available
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

async function getUserTeamId(supabase: SupabaseClient): Promise<string | null> {
  const user = await getCurrentUser(supabase);
  const { data, error } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data?.team_id ?? null;
}

// ─── Notebooks ───────────────────────────────────────────────────────
export async function getNotebooks(supabase: SupabaseClient) {
  const teamId = await getUserTeamId(supabase);
  if (!teamId) return [];

  const { data, error } = await supabase
    .from('notebooks')
    .select('*, notes(count)')
    .eq('team_id', teamId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((nb: any) => ({
    ...nb,
    note_count: nb.notes?.[0]?.count ?? 0,
    notes: undefined,
  }));
}

export async function createNotebook(supabase: SupabaseClient, title: string, description?: string) {
  const user = await getCurrentUser(supabase);
  const teamId = await getUserTeamId(supabase);

  const { data, error } = await supabase
    .from('notebooks')
    .insert({
      title,
      description: description || null,
      owner_id: user.id,
      team_id: teamId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateNotebook(supabase: SupabaseClient, id: string, updates: { title?: string; description?: string }) {
  const { data, error } = await supabase
    .from('notebooks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteNotebook(supabase: SupabaseClient, id: string) {
  const { error } = await supabase
    .from('notebooks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─── Notes ───────────────────────────────────────────────────────────
export async function getNotesForNotebook(supabase: SupabaseClient, notebookId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*, profiles:owner_id(name), editor:last_edited_by(name), note_categories(categories(*))')
    .eq('notebook_id', notebookId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((n: any) => ({
    ...n,
    owner_name: n.profiles?.name || 'Unknown',
    last_edited_by_name: n.editor?.name || null,
    categories: (n.note_categories || []).map((nc: any) => nc.categories).filter(Boolean),
    profiles: undefined,
    editor: undefined,
    note_categories: undefined,
  }));
}

export async function getNote(supabase: SupabaseClient, noteId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*, images(*), profiles:owner_id(name), editor:last_edited_by(name), note_categories(categories(*))')
    .eq('id', noteId)
    .single();

  if (error) throw error;

  return {
    ...data,
    owner_name: data.profiles?.name || 'Unknown',
    last_edited_by_name: data.editor?.name || null,
    categories: (data.note_categories || []).map((nc: any) => nc.categories).filter(Boolean),
    profiles: undefined,
    editor: undefined,
    note_categories: undefined,
  };
}

export async function createNote(supabase: SupabaseClient, notebookId: string, title: string, content?: string) {
  const user = await getCurrentUser(supabase);

  const { data, error } = await supabase
    .from('notes')
    .insert({
      title,
      content: content || null,
      notebook_id: notebookId,
      owner_id: user.id,
      last_edited_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateNote(supabase: SupabaseClient, noteId: string, updates: { title?: string; content?: string; version?: number }) {
  const user = await getCurrentUser(supabase);

  const { data, error } = await supabase
    .from('notes')
    .update({ ...updates, last_edited_by: user.id })
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteNote(supabase: SupabaseClient, noteId: string) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}

export async function searchNotes(supabase: SupabaseClient, query: string) {
  const teamId = await getUserTeamId(supabase);
  if (!teamId) return [];

  const { data, error } = await supabase
    .from('notes')
    .select('*, profiles:owner_id(name), notebooks!inner(team_id), note_categories(categories(*))')
    .eq('notebooks.team_id', teamId)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || []).map((n: any) => ({
    ...n,
    owner_name: n.profiles?.name || 'Unknown',
    categories: (n.note_categories || []).map((nc: any) => nc.categories).filter(Boolean),
    profiles: undefined,
    notebooks: undefined,
    note_categories: undefined,
  }));
}

// ─── Collaborators ───────────────────────────────────────────────────
export async function addCollaborator(supabase: SupabaseClient, notebookId: string, email: string, permission: string = 'read') {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (profileError || !profile) throw new Error('User not found');

  const { data, error } = await supabase
    .from('collaborators')
    .insert({ notebook_id: notebookId, user_id: profile.id, permission })
    .select('*, profiles:user_id(name, email)')
    .single();

  if (error) throw error;
  return data;
}

export async function removeCollaborator(supabase: SupabaseClient, notebookId: string, userId: string) {
  const { error } = await supabase
    .from('collaborators')
    .delete()
    .eq('notebook_id', notebookId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getCollaborators(supabase: SupabaseClient, notebookId: string) {
  const { data, error } = await supabase
    .from('collaborators')
    .select('*, profiles:user_id(name, email)')
    .eq('notebook_id', notebookId);

  if (error) throw error;
  return data || [];
}

// ─── User Profile ────────────────────────────────────────────────────
export async function getProfile(supabase: SupabaseClient) {
  const user = await getCurrentUser(supabase);

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(supabase: SupabaseClient, updates: { name?: string; avatar?: string }) {
  const user = await getCurrentUser(supabase);

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserStats(supabase: SupabaseClient) {
  const user = await getCurrentUser(supabase);

  const [notebooks, notes] = await Promise.all([
    supabase.from('notebooks').select('id', { count: 'exact' }).eq('owner_id', user.id),
    supabase.from('notes').select('id', { count: 'exact' }).eq('owner_id', user.id),
  ]);

  return {
    notebookCount: notebooks.count || 0,
    noteCount: notes.count || 0,
  };
}

// ─── Image upload ────────────────────────────────────────────────────
export async function uploadNoteImage(supabase: SupabaseClient, noteId: string, file: File) {
  const user = await getCurrentUser(supabase);

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/${noteId}/${Date.now()}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('images')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('images')
    .getPublicUrl(uploadData.path);

  const { data: imageRecord, error: dbError } = await supabase
    .from('images')
    .insert({
      note_id: noteId,
      file_path: urlData.publicUrl,
      file_name: file.name,
      mime_type: file.type,
      size: file.size,
    })
    .select()
    .single();

  if (dbError) throw dbError;
  return imageRecord;
}

export async function uploadAvatar(supabase: SupabaseClient, file: File) {
  const user = await getCurrentUser(supabase);

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/avatar.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(uploadData.path);

  await updateProfile(supabase, { avatar: urlData.publicUrl });
  return urlData.publicUrl;
}

// ─── Team functions ──────────────────────────────────────────────────
export async function getTeam(supabase: SupabaseClient): Promise<Team | null> {
  const teamId = await getUserTeamId(supabase);
  if (!teamId) return null;

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (error) throw error;
  return data;
}

export async function getTeamMembers(supabase: SupabaseClient, teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*, profiles:user_id(*)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((m: any) => ({
    ...m,
    profiles: m.profiles ?? undefined,
  }));
}

export async function createTeam(supabase: SupabaseClient, name: string): Promise<Team> {
  const { data, error } = await supabase.rpc('create_team_with_owner', { team_name: name });
  if (error) throw error;
  return data;
}

export async function joinTeam(supabase: SupabaseClient, inviteCode: string): Promise<Team> {
  const { data, error } = await supabase.rpc('join_team_by_code', { code: inviteCode });
  if (error) throw error;
  return data;
}

export async function inviteTeamMember(supabase: SupabaseClient, teamId: string, email: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (profileError || !profile) throw new Error('User not found with that email');

  const { error: insertError } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: profile.id, role: 'member' });

  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ team_id: teamId })
    .eq('id', profile.id);

  if (updateError) throw updateError;
}

export async function removeTeamMember(supabase: SupabaseClient, teamId: string, userId: string) {
  const { error: deleteError } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);

  if (deleteError) throw deleteError;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ team_id: null })
    .eq('id', userId);

  if (updateError) throw updateError;
}

export async function updateMemberRole(supabase: SupabaseClient, teamId: string, userId: string, role: string) {
  const { error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function regenerateInviteCode(supabase: SupabaseClient, teamId: string): Promise<string> {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const inviteCode = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const { error } = await supabase
    .from('teams')
    .update({ invite_code: inviteCode })
    .eq('id', teamId);

  if (error) throw error;
  return inviteCode;
}

// ─── Category functions ──────────────────────────────────────────────
export async function getCategories(supabase: SupabaseClient, teamId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCategory(supabase: SupabaseClient, teamId: string, name: string, color: string): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ team_id: teamId, name, color })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(supabase: SupabaseClient, id: string, updates: { name?: string; color?: string }): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(supabase: SupabaseClient, id: string) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function addNoteCategory(supabase: SupabaseClient, noteId: string, categoryId: string) {
  const { error } = await supabase
    .from('note_categories')
    .insert({ note_id: noteId, category_id: categoryId });

  if (error) throw error;
}

export async function removeNoteCategory(supabase: SupabaseClient, noteId: string, categoryId: string) {
  const { error } = await supabase
    .from('note_categories')
    .delete()
    .eq('note_id', noteId)
    .eq('category_id', categoryId);

  if (error) throw error;
}

export async function getNoteCategories(supabase: SupabaseClient, noteId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('note_categories')
    .select('categories(*)')
    .eq('note_id', noteId);

  if (error) throw error;
  return (data || []).map((nc: any) => nc.categories).filter(Boolean);
}

// ─── Note feature functions ──────────────────────────────────────────
export async function lockNote(supabase: SupabaseClient, noteId: string) {
  const user = await getCurrentUser(supabase);

  const { error } = await supabase
    .from('notes')
    .update({ is_locked: true, locked_by: user.id })
    .eq('id', noteId);

  if (error) throw error;
}

export async function unlockNote(supabase: SupabaseClient, noteId: string) {
  const { error } = await supabase
    .from('notes')
    .update({ is_locked: false, locked_by: null })
    .eq('id', noteId);

  if (error) throw error;
}

export async function pinNote(supabase: SupabaseClient, noteId: string) {
  const { error } = await supabase
    .from('notes')
    .update({ is_pinned: true })
    .eq('id', noteId);

  if (error) throw error;
}

export async function unpinNote(supabase: SupabaseClient, noteId: string) {
  const { error } = await supabase
    .from('notes')
    .update({ is_pinned: false })
    .eq('id', noteId);

  if (error) throw error;
}

export async function hideNote(supabase: SupabaseClient, noteId: string) {
  const user = await getCurrentUser(supabase);

  const { error } = await supabase
    .from('hidden_notes')
    .insert({ user_id: user.id, note_id: noteId });

  if (error) throw error;
}

export async function unhideNote(supabase: SupabaseClient, noteId: string) {
  const user = await getCurrentUser(supabase);

  const { error } = await supabase
    .from('hidden_notes')
    .delete()
    .eq('user_id', user.id)
    .eq('note_id', noteId);

  if (error) throw error;
}

export async function getHiddenNoteIds(supabase: SupabaseClient): Promise<string[]> {
  const user = await getCurrentUser(supabase);

  const { data, error } = await supabase
    .from('hidden_notes')
    .select('note_id')
    .eq('user_id', user.id);

  if (error) throw error;
  return (data || []).map((row: any) => row.note_id);
}

export async function getPinnedNotes(supabase: SupabaseClient, teamId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, profiles:owner_id(name), editor:last_edited_by(name), notebooks!inner(team_id), note_categories(categories(*))')
    .eq('notebooks.team_id', teamId)
    .eq('is_pinned', true)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((n: any) => ({
    ...n,
    owner_name: n.profiles?.name || 'Unknown',
    last_edited_by_name: n.editor?.name || null,
    categories: (n.note_categories || []).map((nc: any) => nc.categories).filter(Boolean),
    profiles: undefined,
    editor: undefined,
    notebooks: undefined,
    note_categories: undefined,
  }));
}

export async function getRecentTeamNotes(supabase: SupabaseClient, teamId: string, limit: number = 10): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, profiles:owner_id(name), editor:last_edited_by(name), notebooks!inner(team_id), note_categories(categories(*))')
    .eq('notebooks.team_id', teamId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((n: any) => ({
    ...n,
    owner_name: n.profiles?.name || 'Unknown',
    last_edited_by_name: n.editor?.name || null,
    categories: (n.note_categories || []).map((nc: any) => nc.categories).filter(Boolean),
    profiles: undefined,
    editor: undefined,
    notebooks: undefined,
    note_categories: undefined,
  }));
}

// ─── Activity functions ──────────────────────────────────────────────
export async function logActivity(
  supabase: SupabaseClient,
  teamId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  targetTitle: string | null,
) {
  const user = await getCurrentUser(supabase);

  const { error } = await supabase
    .from('activity_log')
    .insert({
      team_id: teamId,
      user_id: user.id,
      action,
      target_type: targetType,
      target_id: targetId,
      target_title: targetTitle,
    });

  if (error) throw error;
}

export async function getRecentActivity(supabase: SupabaseClient, teamId: string, limit: number = 20): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, profiles:user_id(*)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((entry: any) => ({
    ...entry,
    profiles: entry.profiles ?? undefined,
  }));
}
