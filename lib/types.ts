// ─── CheatBook domain models (UI-facing shapes derived from the DB) ───
import type { Json } from './database.types';

export interface Space {
  id: string;
  name: string;        // notebooks.title
  color: string;
  icon: string | null;
  sortOrder: number;
  noteCount: number;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  username: string;
  initials: string;
  color: string;        // stable per-user, drives avatar + cursor
  title: string | null;
  pronouns: string | null;
  team: string | null;  // team_name (free text)
  status: string | null;
  avatarUrl: string | null;
  role: string;         // 'admin' | 'member', sourced from profiles.is_admin
  online: boolean;      // derived from presence channel, never DB
}

// Admin-facing account row: a profile with its platform access flags. Distinct
// from `Member` (approved-only, presence-aware) — UserAccount spans not-yet-
// approved users so admins can grant/revoke access.
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  username: string;
  initials: string;
  color: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  approved: boolean;
  createdAt?: string | null;
}

// TipTap/ProseMirror JSON document is the canonical note body.
export type NoteBody = Json;

export interface Note {
  id: string;
  spaceId: string | null;
  title: string;
  ownerId: string;
  collaboratorIds: string[];   // everyone with explicit access (incl. owner)
  body: NoteBody;              // TipTap JSON
  snippet: string;            // derived preview text
  tags: string[];
  pinned: boolean;
  starredByMe: boolean;
  hasImage: boolean;
  attachmentCount: number;
  isLocked: boolean;
  lockedBy: string | null;
  createdAt: string;
  updatedAt: string;
  updatedById: string | null;
  updatedByName: string | null;
  ownerName: string | null;
  staleSince: string | null;
  // joined space summary for badges
  space: { id: string; name: string; color: string } | null;
}

export interface Attachment {
  id: string;
  noteId: string;
  fileName: string;
  mime: string | null;
  sizeBytes: number | null;
  url: string;
  kind: string | null;
  label: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
}

export interface ActivityEvent {
  id: string;
  actorId: string | null;
  actorName: string;
  verb: string;            // 'is editing' | 'commented on' | 'uploaded ... to' | 'created' | 'shared' ...
  targetTitle: string | null;
  targetId: string | null;
  spaceColor: string;
  createdAt: string;
}

export type Scope = 'all' | 'starred';
export type FilterChip = 'all' | 'pinned' | 'starred' | 'runbooks';
export type Density = 'compact' | 'balanced' | 'spacious';
export type Theme = 'dark' | 'light';

export interface NotificationPrefs {
  mentions: boolean;
  comments: boolean;
  shared: boolean;
  incident: boolean;
  digest: boolean;
  desktop: boolean;
  sounds: boolean;
}

export interface Appearance {
  accent: string;
  density: Density;
  theme: Theme;
}

// Spaces whose notes count as "Runbooks" for the saved filter chip (data-driven,
// survives renames better than a hardcoded title match at call sites).
export const RUNBOOK_SPACE_NAMES = ['Infrastructure', 'Runbooks'];
