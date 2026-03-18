import { SupabaseClient } from '@supabase/supabase-js';

// Types
export type Notebook = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
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
  created_at: string;
  updated_at: string;
  owner_name?: string;
};

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
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

// Notebooks
export async function getNotebooks(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get owned notebooks with note count
  const { data: owned, error: ownedError } = await supabase
    .from('notebooks')
    .select('*, notes(count)')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });

  if (ownedError) throw ownedError;

  // Get shared notebooks
  const { data: collabs, error: collabError } = await supabase
    .from('collaborators')
    .select('permission, notebook_id, notebooks(*, notes(count))')
    .eq('user_id', user.id);

  if (collabError) throw collabError;

  const ownedNotebooks = (owned || []).map((nb: any) => ({
    ...nb,
    note_count: nb.notes?.[0]?.count ?? 0,
    notes: undefined,
  }));

  const sharedNotebooks = (collabs || []).map((c: any) => ({
    ...c.notebooks,
    note_count: c.notebooks?.notes?.[0]?.count ?? 0,
    notes: undefined,
    permission: c.permission,
  }));

  return { owned: ownedNotebooks, shared: sharedNotebooks };
}

export async function createNotebook(supabase: SupabaseClient, title: string, description?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notebooks')
    .insert({ title, description: description || null, owner_id: user.id })
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

// Notes
export async function getNotesForNotebook(supabase: SupabaseClient, notebookId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*, profiles:owner_id(name)')
    .eq('notebook_id', notebookId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((n: any) => ({
    ...n,
    owner_name: n.profiles?.name || 'Unknown',
    profiles: undefined,
  }));
}

export async function getNote(supabase: SupabaseClient, noteId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*, images(*), profiles:owner_id(name)')
    .eq('id', noteId)
    .single();

  if (error) throw error;
  return {
    ...data,
    owner_name: data.profiles?.name || 'Unknown',
    profiles: undefined,
  };
}

export async function createNote(supabase: SupabaseClient, notebookId: string, title: string, content?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notes')
    .insert({
      title,
      content: content || null,
      notebook_id: notebookId,
      owner_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateNote(supabase: SupabaseClient, noteId: string, updates: { title?: string; content?: string; version?: number }) {
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notes')
    .select('*, profiles:owner_id(name)')
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []).map((n: any) => ({
    ...n,
    owner_name: n.profiles?.name || 'Unknown',
    profiles: undefined,
  }));
}

// Collaborators
export async function addCollaborator(supabase: SupabaseClient, notebookId: string, email: string, permission: string = 'read') {
  // Find user by email
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

// User Profile
export async function getProfile(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(supabase: SupabaseClient, updates: { name?: string; avatar?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const [notebooks, notes] = await Promise.all([
    supabase.from('notebooks').select('id', { count: 'exact' }).eq('owner_id', user.id),
    supabase.from('notes').select('id', { count: 'exact' }).eq('owner_id', user.id),
  ]);

  return {
    notebookCount: notebooks.count || 0,
    noteCount: notes.count || 0,
  };
}

// Image upload
export async function uploadNoteImage(supabase: SupabaseClient, noteId: string, file: File) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/${noteId}/${Date.now()}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('images')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('images')
    .getPublicUrl(uploadData.path);

  // Record in images table
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/avatar.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(uploadData.path);

  // Update profile
  await updateProfile(supabase, { avatar: urlData.publicUrl });
  return urlData.publicUrl;
}
