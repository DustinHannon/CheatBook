import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Space, Member, Note, Attachment, ActivityEvent,
  NotificationPrefs, Appearance, UserAccount,
} from './types';
import { initials, colorForId } from './colors';
import { snippetFromDoc, docToText, docHasImage, emptyDoc, legacyToDoc } from './blocks';
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

// All approved profiles — drives presence/avatars. RLS lets any approved user
// read all approved profiles; no team scoping anymore.
export async function getMembers(supabase: DB): Promise<Member[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('approved', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((p: any) => mapMember(p, p.is_admin ? 'admin' : 'member'));
}

export async function getCurrentMember(supabase: DB): Promise<Member> {
  const user = await getCurrentUser(supabase);
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw error;
  return mapMember(data, data?.is_admin ? 'admin' : 'member');
}

// ─── Users (admin) ────────────────────────────────────────────────────
// Admin-only roster: admins read ALL profiles (incl. not-yet-approved) via RLS;
// access is the binary approved/is_admin pair on the profile itself.
export async function getAllUsers(supabase: DB): Promise<UserAccount[]> {
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return (data || [])
      .map((p: any): UserAccount => {
        const email = p.email || '';
        return {
          id: p.id,
          name: p.name || (email ? email.split('@')[0] : 'Unknown'),
          email,
          username: p.username || (email ? email.split('@')[0] : ''),
          initials: initials(p.name || email),
          color: p.color || colorForId(p.id),
          avatarUrl: p.avatar ?? null,
          isAdmin: !!p.is_admin,
          approved: !!p.approved,
          createdAt: p.created_at ?? null,
        };
      })
      // Not-approved users first (awaiting an admin decision), then alphabetical.
      .sort((a, b) => (Number(a.approved) - Number(b.approved)) || a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function approveUser(supabase: DB, userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_approve_user', { p_user_id: userId });
  if (error) throw error;
}

export async function revokeUser(supabase: DB, userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_revoke_user', { p_user_id: userId });
  if (error) throw error;
}

export async function setAdmin(supabase: DB, userId: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_admin', { p_user_id: userId, p_is_admin: isAdmin });
  if (error) throw error;
}

// ─── Spaces (notebooks) ───────────────────────────────────────────────
export async function getSpaces(supabase: DB): Promise<Space[]> {
  // RLS restricts rows to approved users; no team scoping anymore.
  const { data, error } = await supabase
    .from('notebooks')
    .select('*, notes(count)')
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
  // New spaces sort after the current max so they land at the bottom of the list.
  const { data: last } = await supabase
    .from('notebooks').select('sort_order')
    .order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const sortOrder = (last?.sort_order ?? 0) + 1;
  const { data, error } = await supabase
    .from('notebooks')
    .insert({ title: name, owner_id: user.id, color, sort_order: sortOrder })
    .select().single();
  if (error) throw error;
  return { id: data.id, name: data.title, color: data.color, icon: data.icon, sortOrder: data.sort_order, noteCount: 0 };
}

export async function updateSpace(
  supabase: DB, spaceId: string, updates: { name?: string; color?: string },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.title = updates.name;
  if (updates.color !== undefined) payload.color = updates.color;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('notebooks').update(payload).eq('id', spaceId);
  if (error) throw error;
}

/**
 * Delete a space. Notes are FK-bound to notebook_id, so deleting a non-empty
 * space would error; callers must move/delete its notes first (we surface the
 * note count in the UI confirmation). Returns the number of notes still in it.
 */
export async function getSpaceNoteCount(supabase: DB, spaceId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notes').select('id', { count: 'exact', head: true }).eq('notebook_id', spaceId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteSpace(supabase: DB, spaceId: string): Promise<void> {
  const { error } = await supabase.from('notebooks').delete().eq('id', spaceId);
  if (error) throw error;
}

// ─── Notes ────────────────────────────────────────────────────────────
const NOTE_SELECT =
  '*, notebooks(id,title,color), owner:owner_id(name), editor:last_edited_by(name), note_attachments(count)';

// Coerce a stored note body into a valid TipTap doc. Guards against the column
// default ('[]' array), legacy HTML strings, and malformed jsonb so the editor
// never receives a non-doc shape (which setContent would reject).
function normalizeBody(b: unknown): Json {
  if (typeof b === 'string') return legacyToDoc(b) as unknown as Json;
  if (b && typeof b === 'object' && !Array.isArray(b) && (b as { type?: string }).type === 'doc') return b as Json;
  return emptyDoc() as unknown as Json;
}

function mapNote(row: any, starredIds: Set<string>): Note {
  const space = row.notebooks
    ? { id: row.notebooks.id, name: row.notebooks.title, color: row.notebooks.color || '#6ea8fe' }
    : null;
  // Sharing is removed; the only implicit contributor is the note's owner.
  const collaboratorIds: string[] = row.owner_id ? [row.owner_id] : [];
  return {
    id: row.id,
    spaceId: row.notebook_id,
    title: row.title,
    ownerId: row.owner_id,
    collaboratorIds,
    body: normalizeBody(row.body),
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

export async function getNotes(supabase: DB): Promise<Note[]> {
  // RLS restricts rows to approved users; any approved user sees all notes.
  const [{ data, error }, starred] = await Promise.all([
    supabase.from('notes').select(NOTE_SELECT).order('updated_at', { ascending: false }),
    getStarredSet(supabase),
  ]);
  if (error) throw error;
  return (data || []).map((n: any) => mapNote(n, starred));
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
  // updated_at is set server-side by the on_note_update trigger.
  const payload: any = {
    body,
    snippet: snippetFromDoc(body),
    content: docToText(body),
    last_edited_by: user.id,
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
  // Carry the source's CRDT state so the copy opens with current content
  // (notes.body can lag the live Yjs doc by up to the snapshot debounce).
  const { data: yjs } = await supabase.from('yjs_documents').select('state').eq('note_id', noteId).maybeSingle();
  if (yjs?.state) {
    await supabase.from('yjs_documents').insert({ note_id: data.id, state: yjs.state });
  }
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

// ─── Search ───────────────────────────────────────────────────────────
export async function searchNotes(supabase: DB, query: string): Promise<Note[]> {
  const q = query.trim();
  if (!q) return [];
  // Escape backslash/quote then wrap in quotes so PostgREST treats punctuation
  // literally instead of as .or() filter syntax (prevents filter injection).
  const term = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const [{ data, error }, starred] = await Promise.all([
    supabase.from('notes').select(NOTE_SELECT)
      .or(`title.ilike."%${term}%",content.ilike."%${term}%"`)
      .order('updated_at', { ascending: false }).limit(50),
    getStarredSet(supabase),
  ]);
  if (error) throw error;
  return (data || []).map((n: any) => mapNote(n, starred));
}

// ─── Private file serving ─────────────────────────────────────────────
// The 'images' bucket is private; objects are never served by public URL.
// Both inline images and attachments store/return this proxy path, which the
// auth-checked `/api/file` route resolves to a short-lived signed URL.
export function fileUrl(path: string): string {
  return '/api/file?path=' + encodeURIComponent(path);
}

// Recover the raw storage object path from a proxy url produced by fileUrl().
function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // New form: /api/file?path=<encoded storage path>.
  const marker = '?path=';
  const i = url.indexOf(marker);
  if (i !== -1) return decodeURIComponent(url.slice(i + marker.length));
  // Legacy public-URL form, kept so old rows can still be cleaned up.
  const legacy = '/object/public/images/';
  if (url.includes(legacy)) return decodeURIComponent(url.slice(url.indexOf(legacy) + legacy.length));
  return null;
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
  // Private bucket: store the auth-checked proxy path, never a public URL.
  const { data, error } = await supabase.from('note_attachments').insert({
    note_id: noteId, file_name: file.name, mime: file.type, size_bytes: file.size,
    url: fileUrl(up.path), kind: ext.toUpperCase(), uploaded_by: user.id,
  }).select().single();
  if (error) throw error;
  return { id: data.id, noteId, fileName: data.file_name, mime: data.mime, sizeBytes: data.size_bytes,
    url: data.url, kind: data.kind, label: data.label, uploadedBy: data.uploaded_by, uploadedAt: data.uploaded_at };
}

export async function deleteAttachment(supabase: DB, id: string): Promise<void> {
  // Remove the underlying storage object too, else the file is orphaned in the
  // bucket after the user deletes the attachment. The storage path is recovered
  // from the proxy url (?path=) — or the legacy public-URL form for old rows.
  const { data: row } = await supabase.from('note_attachments').select('url').eq('id', id).maybeSingle();
  const path = storagePathFromUrl(row?.url);
  if (path) await supabase.storage.from('images').remove([path]);
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

export async function uploadNoteImage(supabase: DB, noteId: string, file: File): Promise<{ url: string; path: string; fileName: string; sizeBytes: number }> {
  assertImage(file, MAX_IMAGE_BYTES);
  const user = await getCurrentUser(supabase);
  const ext = file.name.split('.').pop() || 'png';
  const path = `${user.id}/${noteId}/${Date.now()}.${ext}`;
  const { data: up, error: ue } = await supabase.storage.from('images').upload(path, file);
  if (ue) throw ue;
  // Private bucket: persist the raw storage path; serve via the auth-checked
  // /api/file proxy so PHI in screenshots isn't reachable by guessable URL.
  await supabase.from('images').insert({
    note_id: noteId, file_path: up.path, file_name: file.name, mime_type: file.type, size: file.size,
  });
  return { url: fileUrl(up.path), path: up.path, fileName: file.name, sizeBytes: file.size };
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
  supabase: DB, verb: string, targetType: string,
  targetId: string | null, targetTitle: string | null,
): Promise<void> {
  try {
    const user = await getCurrentUser(supabase);
    await supabase.from('activity_log').insert({
      user_id: user.id, action: verb, target_type: targetType,
      target_id: targetId, target_title: targetTitle,
    });
  } catch { /* activity is best-effort, never block the UX */ }
}

export async function getActivity(supabase: DB, limit = 20): Promise<ActivityEvent[]> {
  const { data, error } = await supabase.from('activity_log')
    .select('*, profiles:user_id(name,color)')
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

/** Clear the profile avatar AND remove the orphaned storage object. */
export async function removeAvatar(supabase: DB): Promise<void> {
  const user = await getCurrentUser(supabase);
  const { data: profile } = await supabase.from('profiles').select('avatar').eq('id', user.id).maybeSingle();
  const url: string | undefined = profile?.avatar ?? undefined;
  const marker = '/object/public/avatars/';
  if (url && url.includes(marker)) {
    const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length).split('?')[0]);
    if (path) await supabase.storage.from('avatars').remove([path]);
  }
  const { error } = await supabase.from('profiles').update({ avatar: null }).eq('id', user.id);
  if (error) throw error;
}
