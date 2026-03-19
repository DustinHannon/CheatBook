# CheatBook

An IT team notes app for quickly saving and sharing the things you need to remember — IPs, scripts, how-tos, credentials, links, and any quick reference info. Built for teams that need fast, collaborative note-taking with a dark editorial aesthetic.

**Live:** [thecheatbook.vercel.app](https://thecheatbook.vercel.app)

## Tech Stack

- **Framework**: Next.js 15 (Pages Router), React 19, TypeScript
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth (email + password with email confirmation)
- **Real-time**: Supabase Realtime (Presence + Broadcast)
- **Storage**: Supabase Storage (images, avatars)
- **Editor**: TinyMCE 7 (self-hosted, GPL) with dark oxide skin
- **Styling**: Tailwind CSS 3 with dark editorial design system
- **Typography**: Cormorant Garamond (display), DM Sans (body), JetBrains Mono (code)
- **Hosting**: Vercel

## Features

### Team Collaboration
- **Team system** — Create a team or join one with an invite code
- **Team-scoped data** — All notebooks and notes shared across the team
- **Admin controls** — Invite/remove members, toggle admin/member roles
- **Invite code** — Copy and share, visible on settings page
- **Real-time editing** — Multiple people can edit the same note simultaneously
- **Presence indicators** — See who's online and editing
- **Typing indicators** — See when teammates are typing

### Notes & Editor
- **TinyMCE rich text editor** — Bold, italic, underline, strikethrough, headings, lists, blockquote, links, images, tables, horizontal rules
- **Code blocks** — Insert code samples with language selection (codesample plugin)
- **Note locking** — Lock important notes to prevent accidental edits (confirmation to override)
- **Note pinning** — Pin important notes to dashboard
- **Note hiding** — Hide notes per-user without deleting for the team
- **Note metadata** — See who created a note and who last edited it
- **Auto-save** — Changes save automatically every 2 seconds
- **Ctrl+S** — Manual save keyboard shortcut
- **Backward compatible** — Old Draft.js JSON content auto-converts to HTML

### Dashboard & Navigation
- **Sidebar** — Always visible, shows notebooks and notes for quick navigation
- **Dashboard** — Greeting, recent notes grid, activity feed
- **Command palette** — Cmd+K / Ctrl+K for quick note search
- **Quick-create** — One click to create a note (picks notebook automatically or shows picker)
- **Notebook cards** — Visible on dashboard when no notes exist yet

### Settings & Admin
- **Profile** — Name, avatar upload, email (read-only)
- **Team management** — View team name, invite code (copy button), member list with roles
- **Role management** — Admins can click role badges to toggle admin/member
- **Invite by email** — Add team members directly (they must have an account)
- **Remove members** — Admin can remove any non-self member

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Cinematic split-screen sign in / sign up |
| `/team-setup` | Create or join a team (post-signup) |
| `/` | Dashboard — recent notes, activity feed, sidebar navigation |
| `/notes/[id]` | Note editor with TinyMCE, real-time collaboration |
| `/notebooks/[id]` | Notebook listing with note cards |
| `/search` | Full-page note search |
| `/profile` | User settings, team management |

## Getting Started

### Prerequisites

- Node.js 22+
- A Supabase project with the schema applied

### Setup

1. Clone and install:
   ```bash
   git clone https://github.com/DustinHannon/CheatBook.git
   cd CheatBook
   npm install
   ```

2. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Copy TinyMCE assets (if not already present):
   ```bash
   cp -r node_modules/tinymce/skins node_modules/tinymce/themes node_modules/tinymce/icons node_modules/tinymce/models node_modules/tinymce/plugins public/tinymce/
   cp node_modules/tinymce/tinymce.min.js public/tinymce/
   ```

4. Run:
   ```bash
   npm run dev
   ```

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User data (name, email, avatar, team_id) |
| `teams` | Teams with invite codes |
| `team_members` | Team membership with roles (admin/member) |
| `notebooks` | Note collections scoped to teams |
| `notes` | HTML content with locking, pinning, versioning, edit tracking |
| `images` | Note image metadata |
| `hidden_notes` | Per-user note hiding |
| `activity_log` | Team action history |
| `categories` | Team-scoped categories (currently unused in UI) |
| `note_categories` | Note-category assignments (currently unused in UI) |
| `collaborators` | Notebook sharing permissions (legacy) |

## RLS Architecture

All RLS policies use `profiles.team_id` for team membership checks — no cross-table recursive policies. This avoids the infinite recursion issues that occur when policies on table A check table B which has policies checking table A.

## License

ISC
