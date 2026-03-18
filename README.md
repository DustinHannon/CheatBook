# CheatBook

An IT team notes app for quickly saving and sharing the things you need to remember — IPs, scripts, how-tos, credentials, links, and any quick reference info. Built for teams that need fast, collaborative note-taking with a dark editorial aesthetic.

**Live:** [thecheatbook.vercel.app](https://thecheatbook.vercel.app)

## Tech Stack

- **Framework**: Next.js 15 (Pages Router), React 19, TypeScript
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth (email + password with email confirmation)
- **Real-time**: Supabase Realtime (Presence + Broadcast)
- **Storage**: Supabase Storage (images, avatars)
- **Styling**: Tailwind CSS 3 with dark editorial design system
- **Typography**: Cormorant Garamond (display), DM Sans (body), JetBrains Mono (code)
- **Editor**: Draft.js with floating selection toolbar
- **Hosting**: Vercel

## Features

### Team Collaboration
- **Team system** — Create a team or join one with an invite code
- **Team-scoped data** — All notebooks and notes shared across the team
- **Admin controls** — Invite/remove members, manage roles (admin/member)
- **Real-time editing** — Multiple people can edit the same note simultaneously
- **Presence indicators** — See who's online and editing
- **Typing indicators** — See when teammates are typing
- **Activity feed** — Dashboard shows recent team activity (who edited what)

### Notes & Organization
- **Rich text editor** — Bold, italic, underline, headings, lists with floating toolbar
- **Categories** — Tag notes with colored categories (Network, Servers, Scripts, Credentials, How-To, General)
- **Note locking** — Lock important notes to prevent accidental edits (confirmation required to edit)
- **Note pinning** — Pin important notes to the top of the dashboard
- **Note hiding** — Hide notes per-user without deleting them for the team
- **Note metadata** — See who created a note and who last edited it
- **Auto-save** — Changes save automatically every 2 seconds
- **Image support** — Paste or upload images directly into notes
- **Command palette** — Cmd+K / Ctrl+K for quick note search

### Dashboard
- **Greeting** with team name badge
- **Pinned notes** section — horizontal scroll of important notes
- **Recent notes** grid — latest edited notes across all notebooks
- **Category filter chips** — filter notes by category
- **Activity feed** — team actions in real-time
- **Quick-create** button for new notes

### UI & Design
- Dark editorial aesthetic with warm gold (#d4a574) accents
- Cormorant Garamond serif headings, DM Sans body text
- CSS noise grain texture overlay
- Toast notifications for all actions
- Styled confirmation dialogs (no browser alerts)
- Loading skeleton animations
- Responsive design (mobile sidebar collapses)

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Cinematic split-screen sign in / sign up |
| `/team-setup` | Create or join a team (post-signup) |
| `/` | Dashboard — pinned notes, recent notes, activity feed |
| `/notes/[id]` | Note editor with real-time collaboration |
| `/notebooks/[id]` | Notebook listing with note cards |
| `/search` | Full-page note search with category filtering |
| `/profile` | User settings, team management, avatar |

## Getting Started

### Prerequisites

- Node.js 22+
- A Supabase project with the schema applied (see database migrations)

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

3. Run:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── components/
│   ├── AuthContext.tsx         # Supabase Auth provider
│   ├── TeamContext.tsx         # Team state management
│   ├── RealtimeContext.tsx     # Supabase Realtime channels
│   ├── Authentication.tsx     # Split-screen login/signup
│   ├── CommandPalette.tsx     # Cmd+K search overlay
│   ├── NoteEditor.tsx         # Draft.js editor with collaboration
│   ├── FloatingToolbar.tsx    # Selection-triggered formatting
│   ├── NoteCard.tsx           # Reusable note preview card
│   ├── CategoryBadge.tsx      # Colored category pill
│   ├── CategoryPicker.tsx     # Category assignment popover
│   ├── Toast.tsx              # Toast notification system
│   ├── ConfirmDialog.tsx      # Styled confirmation modal
│   ├── Skeleton.tsx           # Loading skeleton components
│   ├── Layout.tsx             # App shell with animated sidebar
│   ├── NavBar.tsx             # Minimal top bar
│   ├── NotesList.tsx          # Sidebar navigation
│   ├── UserPresence.tsx       # Collaborator avatars
│   └── Dashboard/
│       ├── PinnedNotes.tsx    # Pinned notes section
│       ├── RecentNotes.tsx    # Recent notes grid
│       ├── CategoryChips.tsx  # Category filter pills
│       └── ActivityFeed.tsx   # Team activity feed
├── lib/
│   ├── api.ts                 # All Supabase data access (~40 functions)
│   └── supabase/              # Client utilities + middleware
├── pages/                     # Next.js pages
├── styles/
│   ├── theme.css              # Design system variables + animations
│   └── editor.css             # Draft.js typography overrides
└── middleware.ts              # Auth + team-setup route protection
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User data (name, email, avatar, team_id) |
| `teams` | Teams with invite codes |
| `team_members` | Team membership with roles (admin/member) |
| `notebooks` | Note collections scoped to teams |
| `notes` | Content with locking, pinning, versioning, edit tracking |
| `categories` | Team-scoped colored categories |
| `note_categories` | Many-to-many note-category assignments |
| `images` | Note image metadata |
| `hidden_notes` | Per-user note hiding |
| `activity_log` | Team action history |
| `collaborators` | Notebook sharing permissions |

## License

ISC
