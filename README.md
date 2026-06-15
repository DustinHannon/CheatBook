# CheatBook

A dark, glassmorphic knowledge app for an IT & Engineering org — runbooks, incidents,
onboarding, and the tribal knowledge you need to remember years later. Real-time collaborative
block editing with live cursors, organized into colored Spaces.

**Live:** [cheatbook.morganwhite.com](https://cheatbook.morganwhite.com)

## Tech stack

- **Framework**: Next.js 15 (Pages Router), React 19, TypeScript (strict)
- **Database**: Supabase PostgreSQL with Row Level Security (binary access: approved users see all notes/Spaces, unapproved see none; admin via `profiles.is_admin`)
- **Auth**: Microsoft Entra ID SSO (primary) + break-glass password account — brokered by Supabase Auth
- **Editor**: TipTap v3 (ProseMirror) block editor bound to **Yjs** (CRDT)
- **Real-time**: custom Yjs provider over **Supabase Realtime broadcast + presence** (no separate WS server), with CRDT state persisted to `yjs_documents`
- **Storage**: Supabase Storage — private `images` bucket (note images/attachments stored as raw paths, served only via the auth-checked `/api/file` proxy that verifies an approved session and 302-redirects to a 60s signed URL) + public `avatars` bucket
- **Styling**: Tailwind CSS 3, glassmorphic aurora design system
- **Typography**: Manrope (UI), JetBrains Mono (mono/metadata)
- **Icons**: lucide-react + inline SVG
- **Hosting**: Vercel

## Features

- **Spaces** — colored notebooks (Infrastructure, Runbooks, Onboarding, Incidents, Security, Tribal Knowledge, Network…); filter the list by Space.
- **Block notes** — TipTap rich text: headings, paragraphs, checklists, code blocks (syntax highlighted), callouts, images, attachments.
- **Real-time collaboration** — multiple people edit the same note simultaneously; live colored carets + name tags (`CollaborationCaret`), "N editing" presence, "synced" status. Conflict-free via Yjs CRDT.
- **Live presence** — global online set drives green dots in the sidebar and editor; derived from the realtime channel, never a DB flag.
- **Scopes & filters** — All Notes / Starred; chips All / Pinned / Starred / Runbooks (URL-reflected, shareable); per-user stars.
- **Note actions** — pin, copy link, move to space, duplicate, export to Markdown, version history, delete (confirmed).
- **Command palette** (⌘K) — backend full-text search across titles/body/tags + quick actions.
- **Access & admin** — new users land unapproved and see no data until an admin approves them (`profiles.approved`); admins (`profiles.is_admin`) approve/revoke users and grant admin in **Settings → Users**.
- **Dashboard** — greeting, live stats, "continue where you left off", stale-knowledge surface, live activity feed.
- **Settings** — profile + avatar, Entra-managed account, notification prefs (incl. desktop notifications), appearance (accent + density, applied live), active sessions, and Users (admin-only: approve/revoke access, grant/remove admin).
- **Responsive** — full sidebar → icon rail → overlay drawer; mobile single-pane workspace.

## Architecture

- **Pages Router.** App shell = `components/Layout.tsx` (aurora + responsive sidebar + content + global overlays). Provider stack in `pages/_app.tsx`: Auth → Toast → Appearance → Presence → App.
- **Data layer**: `lib/api.ts` — all Supabase access, mapped into domain types (`lib/types.ts`). Direct client-to-Supabase with RLS as the security boundary (no server API layer).
- **State**: `components/AppContext.tsx` (members/spaces/notes/activity + overlays + optimistic star/pin + the live `cb-platform` realtime channel), `PresenceContext` (global online set), `AppearanceContext` (accent/density), `AuthContext` (Entra + break-glass).
- **Realtime**: `lib/yjs/SupabaseProvider.ts` binds a per-note `Y.Doc` + `Awareness` to a Supabase broadcast channel; `components/NoteEditor.tsx` wires TipTap `Collaboration` + `CollaborationCaret`, seeds from the persisted body once, and snapshots the readable body back to the DB on a debounce.

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + typecheck
npm run lint
```

Environment (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_ENTRA_ENABLED=false   # true once Entra SSO is configured
```

## Authentication setup

See **[SETUP-ENTRA.md](./SETUP-ENTRA.md)** for the Microsoft Entra ID app-registration steps and
the break-glass account. Until Entra is configured, sign in via **break-glass** on the login screen.

## Deployment

Push to `main` → Vercel auto-deploys. One environment: production.
