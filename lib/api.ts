import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Space, Member, Note, Attachment, ShareGrant, LinkShare, ActivityEvent,
  Permission, NotificationPrefs, Appearance,
} from './types';
import { initials, colorForId } from './colors';
import { snippetFromDoc, docToText, docHasImage, emptyDoc } from './blocks';
import type { Json } from './database.types';

// We use a loosely-typed client here; rows are mapped explicitly into domain types.
type DB = SupabaseClient;

// ─── Auth helper ──────────────────────────────────────────────────────
export async function getCurrentUser(supabase: DB) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

export async function getUserTeamId(supabase: DB): Promise<string | null> {
  const user = await getCurrentUser(supabase);
  const { data, error } = await supabase.from('profiles').select('team_id').eq('id', user.id).single();
  if (error) throw error;
  return data?.team_id ?? null;
}

// ─── Members ──────────────────────────────────────────────────────────
function mapMember(p: any, role = 'member'): Member {
  const color = p.color || colorForId(p.id);
  return {
    id: p.id,
    name: p.name || (p.email ? p.email.split('@')[0] : 'Unknown'),
    email: p.email || '',
    username: p.username || (p.email ? p.email.split('@')[0] : ''),
    initials: initials(p.name || p.email),
    color,
    title: p.title ?? null,
    pronouns: p.pronouns ?? null,
    team: p.team_name ?? null,
    status: p.status ?? null,
    avatarUrl: p.avatar ?? null,
    role,
    online: false,
  };
}

export async function getMembers(supabase: DB, teamId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('role, user_id, profiles:user_id(*)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || [])
    .filter((m: any) => m.profiles)
    .map((m: any) => mapMember(m.profiles, m.role));
}

export async function getCurrentMember(supabase: DB): Promise<Member> {
  const user = await getCurrentUser(supabase);
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw error;
  let role = 'member';
  if (data?.team_id) {
    const { data: tm } = await supabase
      .from('team_members').select('role').eq('team_id', data.team_id).eq('user_id', user.id).maybeSingle();
    role = tm?.role || 'member';
  }
  return mapMember(data, role);
}

// ─── Spaces (notebooks) ───────────────────────────────────────────────
export async function getSpaces(supabase: DB, teamId: string): Promise<Space[]> {
  const { data, error } = await supabase
    .from('notebooks')
    .select('*, notes(count)')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((nb: any): Space => ({
    id: nb.id,
    name: nb.title,
    color: nb.color || '#6ea8fe',
    icon: nb.icon ?? null,
    sortOrder: nb.sort_order ?? 0,
    noteCount: nb.notes?.[0]?.count ?? 0,
  }));
}

export async function createSpace(supabase: DB, name: string, color = '#6ea8fe'): Promise<Space> {
  const user = await getCurrentUser(supabase);
  const teamId = await getUserTeamId(supabase);
  const { data, error } = await supabase
    .from('notebooks')
    .insert({ title: name, owner_id: user.id, team_id: teamId, color })
    .select().single();
  if (error) throw error;
  return { id: data.id, name: data.title, color: data.color, icon: data.icon, sortOrder: data.sort_order, noteCount: 0 };
}

// ─── Notes ────────────────────────────────────────────────────────────
const NOTE_SELECT =
  '*, notebooks!inner(id,title,color,team_id), owner:owner_id(name), editor:last_edited_by(name), note_attachments(count), note_collaborators(user_id,permission)';

function mapNote(row: any, starredIds: Set<string>): Note {
  const space = row.notebooks
    ? { id: row.notebooks.id, name: row.notebooks.title, color: row.notebooks.color || '#6ea8fe' }
    : null;
  const collaboratorIds: string[] = (row.note_collaborators || []).map((c: any) => c.user_id);
  // Owner is always an implicit collaborator for "contributors" display.
  if (row.owner_id && !collaboratorIds.includes(row.owner_id)) collaboratorIds.unshift(row.owner_id);
  return {
    id: row.id,
    spaceId: row.notebook_id,
    title: row.title,
    ownerId: row.owner_id,
    collaboratorIds,
    body: (row.body && Object.keys(row.body).length ? row.body : emptyDoc()) as Json,
    snippet: row.snippet || snippetFromDoc(row.body) || '',
    tags: row.tags || [],
    pinned: !!row.is_pinned,
    starredByMe: starredIds.has(row.id),
    hasImage: docHasImage(row.body),
    attachmentCount: row.note_attachments?.[0]?.count ?? 0,
    isLocked: !!row.is_locked,
    lockedBy: row.locked_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedById: row.last_edited_by ?? null,
    updatedByName: row.editor?.name ?? null,
    ownerName: row.owner?.name ?? null,
    staleSince: row.stale_since ?? null,
    space,
  };
}

async function getStarredSet(supabase: DB): Promise<Set<string>> {
  try {
    const user = await getCurrentUser(supabase);
    const { data } = await supabase.from('note_stars').select('note_id').eq('user_id', user.id);
    return new Set((data || []).map((r: any) => r.note_id));
  } catch { return new Set(); }
}

async function getHiddenSet(supabase: DB): Promise<Set<string>> {
  try {
    const user = await getCurrentUser(supabase);
    const { data } = await supabase.from('hidden_notes').select('note_id').eq('user_id', user.id);
    return new Set((data || []).map((r: any) => r.note_id));
  } catch { return new Set(); }
}

export async function getNotes(supabase: DB, teamId: string): Promise<Note[]> {
  const [{ data, error }, starred, hidden] = await Promise.all([
    supabase.from('notes').select(NOTE_SELECT).eq('notebooks.team_id', teamId).order('updated_at', { ascending: false }),
    getStarredSet(supabase),
    getHiddenSet(supabase),
  ]);
  if (error) throw error;
  return (data || []).filter((n: any) => !hidden.has(n.id)).map((n: any) => mapNote(n, starred));
}

export async function getNote(supabase: DB, noteId: string): Promise<Note> {
  const [{ data, error }, starred] = await Promise.all([
    supabase.from('notes').select(NOTE_SELECT).eq('id', noteId).single(),
    getStarredSet(supabase),
  ]);
  if (error) throw error;
  return mapNote(data, starred);
}

export async function createNote(supabase: DB, spaceId: string, title = 'Untitled note'): Promise<Note> {
  const user = await getCurrentUser(supabase);
  const { data, error } = await supabase
    .from('notes')
    .insert({ title, notebook_id: spaceId, owner_id: user.id, last_edited_by: user.id, body: emptyDoc() })
    .select(NOTE_SELECT).single();
  if (error) throw error;
  return mapNote(data, new Set());
}

export async function updateNoteMeta(
  supabase: DB, noteId: string,
  updates: { title?: string; tags?: string[]; spaceId?: string },
): Promise<void> {
  const user = await getCurrentUser(supabase);
  const payload: any = { last_edited_by: user.id };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.spaceId !== undefined) payload.notebook_id = updates.spaceId;
  const { error } = await supabase.from('notes').update(payload).eq('id', noteId);
  if (error) throw error;
}

/** Snapshot the editor's TipTap doc back to the DB row (snippet/content derived for list+search). */
export async function saveNoteSnapshot(supabase: DB, noteId: string, body: Json, title?: string): Promise<void> {
  const user = await getCurrentUser(supabase);
  const payload: any = {
    body,
    snippet: snippetFromDoc(body),
    content: docToText(body),
    last_edited_by: user.id,
    updated_at: new Date().toISOString(),
  };
  if (title !== undefined) payload.title = title;
  const { error } = await supabase.from('notes').update(payload).eq('id', noteId);
  if (error) throw error;
}

export async function deleteNote(supabase: DB, noteId: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) throw error;
}

export async function duplicateNote(supabase: DB, noteId: string): Promise<Note> {
  const user = await getCurrentUser(supabase);
  const { data: src, error: e1 } = await supabase.from('notes').select('*').eq('id', noteId).single();
  if (e1) throw e1;
  const { data, error } = await supabase
    .from('notes')
    .insert({
      title: `${src.title} (copy)`,
      notebook_id: src.notebook_id,
      owner_id: user.id,
      last_edited_by: user.id,
      body: src.body,
      tags: src.tags,
      snippet: src.snippet,
      content: src.content,
    })
    .select(NOTE_SELECT).single();
  if (error) throw error;
  return mapNote(data, new Set());
}

export async function moveNoteToSpace(supabase: DB, noteId: string, spaceId: string): Promise<void> {
  const { error } = await supabase.from('notes').update({ notebook_id: spaceId }).eq('id', noteId);
  if (error) throw error;
}

export async function setPinned(supabase: DB, noteId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('notes').update({ is_pinned: pinned }).eq('id', noteId);
  if (error) throw error;
}

export async function setLocked(supabase: DB, noteId: string, locked: boolean): Promise<void> {
  const user = await getCurrentUser(supabase);
  const { error } = await supabase.from('notes')
    .update({ is_locked: locked, locked_by: locked ? user.id : null }).eq('id', noteId);
  if (error) throw error;
}

// ─── Stars (per-user) ─────────────────────────────────────────────────
export async function setStar(supabase: DB, noteId: string, starred: boolean): Promise<void> {
  const user = await getCurrentUser(supabase);
  if (starred) {
    const { error } = await supabase.from('note_stars').upsert({ user_id: user.id, note_id: noteId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('note_stars').delete().eq('user_id', user.id).eq('note_id', noteId);
    if (error) throw error;
  }
}

// ─── Hidden notes (per-user) ──────────────────────────────────────────
export async function hideNote(supabase: DB, noteId: string): Promise<void> {
  const user = await getCurrentUser(supabase);
  const { error } = await supabase.from('hidden_notes').insert({ user_id: user.id, note_id: noteId });
  if (error) throw error;
}
export async function unhideNote(supabase: DB, noteId: string): Promise<void> {
  const user = await getCurrentUser(supabase);
  const { error } = await supabase.from('hidden_notes').delete().eq('user_id', user.id).eq('note_id', noteId);
  if (error) throw error;
}

// ─── Search ───────────────────────────────────────────────────────────
export async function searchNotes(supabase: DB, teamId: string, query: string): Promise<Note[]> {
  const q = query.trim();
  if (!q) return [];
  // Escape backslash/quote then wrap in quotes so PostgREST treats punctuation
  // literally instead of as .or() filter syntax (prevents filter injection).
  const term = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const [{ data, error }, starred, hidden] = await Promise.all([
    supabase.from('notes').select(NOTE_SELECT).eq('notebooks.team_id', teamId)
      .or(`title.ilike."%${term}%",content.ilike."%${term}%"`)
      .order('updated_at', { ascending: false }).limit(50),
    getStarredSet(supabase),
    getHiddenSet(supabase),
  ]);
  if (error) throw error;
  return (data || []).filter((n: any) => !hidden.has(n.id)).map((n: any) => mapNote(n, starred));
}

// ─── Collaborators / share grants ─────────────────────────────────────
export async function getCollaborators(supabase: DB, noteId: string): Promise<ShareGrant[]> {
  const { data, error } = await supabase.from('note_collaborators')
    .select('note_id,user_id,permission').eq('note_id', noteId);
  if (error) throw error;
  return (data || []).map((r: any) => ({ noteId: r.note_id, userId: r.user_id, permission: r.permission as Permission }));
}

export async function addCollaboratorByEmail(supabase: DB, noteId: string, email: string, permission: Permission = 'view'): Promise<void> {
  const { data: profile, error: pe } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
  if (pe) throw pe;
  if (!profile) throw new Error('No teammate found with that email.');
  const { error } = await supabase.from('note_collaborators')
    .upsert({ note_id: noteId, user_id: profile.id, permission });
  if (error) throw error;
}

export async function setCollaboratorPermission(supabase: DB, noteId: string, userId: string, permission: Permission): Promise<void> {
  const { error } = await supabase.from('note_collaborators')
    .upsert({ note_id: noteId, user_id: userId, permission });
  if (error) throw error;
}

export async function removeCollaborator(supabase: DB, noteId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('note_collaborators').delete().eq('note_id', noteId).eq('user_id', userId);
  if (error) throw error;
}

// ─── Link sharing ─────────────────────────────────────────────────────
export async function getLinkShare(supabase: DB, noteId: string): Promise<LinkShare> {
  const { data, error } = await supabase.from('note_link_shares').select('*').eq('note_id', noteId).maybeSingle();
  if (error) throw error;
  return {
    noteId,
    enabled: data?.enabled ?? false,
    scope: (data?.scope as 'tenant' | 'anyone') ?? 'tenant',
    permission: (data?.permission as 'view' | 'edit') ?? 'view',
  };
}

export async function setLinkShare(supabase: DB, share: LinkShare): Promise<void> {
  const { error } = await supabase.from('note_link_shares').upsert({
    note_id: share.noteId, enabled: share.enabled, scope: share.scope,
    permission: share.permission, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ─── Attachments ──────────────────────────────────────────────────────
export async function getAttachments(supabase: DB, noteId: string): Promise<Attachment[]> {
  const { data, error } = await supabase.from('note_attachments').select('*').eq('note_id', noteId)
    .order('uploaded_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any): Attachment => ({
    id: r.id, noteId: r.note_id, fileName: r.file_name, mime: r.mime, sizeBytes: r.size_bytes,
    url: r.url, kind: r.kind, label: r.label, uploadedBy: r.uploaded_by, uploadedAt: r.uploaded_at,
  }));
}

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export async function uploadAttachment(supabase: DB, noteId: string, file: File): Promise<Attachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`File too large (max ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB).`);
  const user = await getCurrentUser(supabase);
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${user.id}/${noteId}/${Date.now()}.${ext}`;
  const { data: up, error: ue } = await supabase.storage.from('images').upload(path, file);
  if (ue) throw ue;
  const { data: urlData } = supabase.storage.from('images').getPublicUrl(up.path);
  const { data, error } = await supabase.from('note_attachments').insert({
    note_id: noteId, file_name: file.name, mime: file.type, size_bytes: file.size,
    url: urlData.publicUrl, kind: ext.toUpperCase(), uploaded_by: user.id,
  }).select().single();
  if (error) throw error;
  return { id: data.id, noteId, fileName: data.file_name, mime: data.mime, sizeBytes: data.size_bytes,
    url: data.url, kind: data.kind, label: data.label, uploadedBy: data.uploaded_by, uploadedAt: data.uploaded_at };
}

export async function deleteAttachment(supabase: DB, id: string): Promise<void> {
  // Remove the underlying storage object too, else the (public) file is orphaned
  // and remains downloadable by URL after the user deletes the attachment.
  const { data: row } = await supabase.from('note_attachments').select('url').eq('id', id).maybeSingle();
  const url: string | undefined = row?.url;
  const marker = '/object/public/images/';
  if (url && url.includes(marker)) {
    const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length));
    if (path) await supabase.storage.from('images').remove([path]);
  }
  const { error } = await supabase.from('note_attachments').delete().eq('id', id);
  if (error) throw error;
}

// ─── Image upload (inline editor images + avatars) ────────────────────
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function assertImage(file: File, maxBytes: number) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error('Unsupported image type. Use PNG, JPG, GIF or WebP.');
  if (file.size > maxBytes) throw new Error(`Image too large (max ${maxBytes / 1024 / 1024} MB).`);
}

export async function uploadNoteImage(supabase: DB, noteId: string, file: File): Promise<{ url: string; fileName: string; sizeBytes: number }> {
  assertImage(file, MAX_IMAGE_BYTES);
  const user = await getCurrentUser(supabase);
  const ext = file.name.split('.').pop() || 'png';
  const path = `${user.id}/${noteId}/${Date.now()}.${ext}`;
  const { data: up, error: ue } = await supabase.storage.from('images').upload(path, file);
  if (ue) throw ue;
  const { data: urlData } = supabase.storage.from('images').getPublicUrl(up.path);
  await supabase.from('images').insert({
    note_id: noteId, file_path: urlData.publicUrl, file_name: file.name, mime_type: file.type, size: file.size,
  });
  return { url: urlData.publicUrl, fileName: file.name, sizeBytes: file.size };
}

export async function uploadAvatar(supabase: DB, file: File): Promise<string> {
  assertImage(file, MAX_AVATAR_BYTES);
  const user = await getCurrentUser(supabase);
  const ext = file.name.split('.').pop() || 'png';
  const path = `${user.id}/avatar.${ext}`;
  const { data: up, error: ue } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (ue) throw ue;
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(up.path);
  // bust cache so the new avatar shows immediately everywhere
  const url = `${urlData.publicUrl}?v=${Date.now()}`;
  await supabase.from('profiles').update({ avatar: url }).eq('id', user.id);
  return url;
}

// ─── Profile + preferences ────────────────────────────────────────────
export async function updateProfile(supabase: DB, updates: {
  name?: string; title?: string; pronouns?: string; team_name?: string; status?: string; color?: string; avatar?: string;
}): Promise<void> {
  const user = await getCurrentUser(supabase);
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) throw error;
}

export async function updateNotificationPrefs(supabase: DB, prefs: NotificationPrefs): Promise<void> {
  const user = await getCurrentUser(supabase);
  const { error } = await supabase.from('profiles').update({ notification_prefs: prefs as unknown as Json }).eq('id', user.id);
  if (error) throw error;
}

export async function updateAppearance(supabase: DB, appearance: Appearance): Promise<void> {
  const user = await getCurrentUser(supabase);
  const { error } = await supabase.from('profiles').update({ appearance: appearance as unknown as Json }).eq('id', user.id);
  if (error) throw error;
}

// ─── Activity ─────────────────────────────────────────────────────────
export async function logActivity(
  supabase: DB, teamId: string, verb: string, targetType: string,
  targetId: string | null, targetTitle: string | null,
): Promise<void> {
  try {
    const user = await getCurrentUser(supabase);
    await supabase.from('activity_log').insert({
      team_id: teamId, user_id: user.id, action: verb, target_type: targetType,
      target_id: targetId, target_title: targetTitle,
    });
  } catch { /* activity is best-effort, never block the UX */ }
}

export async function getActivity(supabase: DB, teamId: string, limit = 20): Promise<ActivityEvent[]> {
  const { data, error } = await supabase.from('activity_log')
    .select('*, profiles:user_id(name,color)').eq('team_id', teamId)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).map((e: any): ActivityEvent => ({
    id: e.id,
    actorId: e.user_id,
    actorName: e.profiles?.name || 'Someone',
    verb: e.action,
    targetTitle: e.target_title,
    targetId: e.target_id,
    spaceColor: e.profiles?.color || '#6ea8fe',
    createdAt: e.created_at,
  }));
}

// ─── Yjs document persistence (CRDT cold-load + snapshot) ──────────────
export async function loadYjsState(supabase: DB, noteId: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.from('yjs_documents').select('state').eq('note_id', noteId).maybeSingle();
  if (error) throw error;
  if (!data?.state) return null;
  // bytea comes back as a hex string like "\\x...."
  return hexToBytes(data.state as string);
}

export async function saveYjsState(supabase: DB, noteId: string, state: Uint8Array): Promise<void> {
  const hex = '\\x' + bytesToHex(state);
  const { error } = await supabase.from('yjs_documents')
    .upsert({ note_id: noteId, state: hex as unknown as string, updated_at: new Date().toISOString() });
  if (error) throw error;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('\\x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

// ─── Team helpers (kept for member management in Settings) ─────────────
export async function getTeam(supabase: DB): Promise<{ id: string; name: string; invite_code: string | null } | null> {
  const teamId = await getUserTeamId(supabase);
  if (!teamId) return null;
  const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).single();
  if (error) throw error;
  return data;
}
