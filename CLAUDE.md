# CheatBook

IT team notes app — quick collaborative notes for IPs, scripts, how-tos, credentials, and reference info.

## Live URL
https://thecheatbook.vercel.app

## Tech Stack
- Next.js 15 (Pages Router), React 19, TypeScript
- Supabase (PostgreSQL, Auth email/password, Realtime, Storage)
- Tailwind CSS 3 with dark editorial design system
- Typography: Cormorant Garamond (display), DM Sans (body), JetBrains Mono (code)
- Draft.js rich text editor with floating selection toolbar
- Vercel hosting

## Design System
- Dark palette: #0a0a0b base, #111113 raised, #18181b surface
- Warm gold accent: #d4a574
- CSS variables in styles/theme.css (--bg-base, --bg-raised, --bg-surface, --text-primary, --accent, etc.)
- Tailwind mapped: bg-bg-base, bg-bg-raised, text-text-primary, text-accent, border-border, etc.
- Font classes: font-display, font-body, font-mono
- Typography classes: text-display-lg/md/sm, section-label

## Architecture
- Auth: Supabase Auth email/password (components/AuthContext.tsx)
- Teams: Team context manages team state, members, roles (components/TeamContext.tsx)
- Real-time: Supabase Realtime Presence + Broadcast per note (components/RealtimeContext.tsx)
- Data: Direct client-to-Supabase queries with RLS (lib/api.ts, ~40 functions)
- Storage: Supabase Storage buckets for images and avatars
- Middleware: Auth + team-setup redirect (lib/supabase/middleware.ts)
- Toasts: ToastProvider + useToast() hook (components/Toast.tsx)

## Pages
- /login — Cinematic split-screen auth
- /team-setup — Create or join a team (post-signup)
- / — Dashboard: pinned notes, recent notes grid, category filters, activity feed
- /notes/[id] — Note editor with real-time collaboration
- /notebooks/[id] — Notebook listing with note cards
- /search — Full-page search with editorial result cards
- /profile — User settings, team management, avatar

## Supabase
- Project ID: ccthpkbljqxwtugawcyc
- Region: us-east-1
- Tables: profiles, teams, team_members, notebooks, notes, categories, note_categories, images, hidden_notes, activity_log, collaborators
- RLS enabled on all tables — team-scoped access
- Storage buckets: images, avatars
- Auth: email/password with email confirmation
- Database functions: create_team_with_owner(team_name), join_team_by_code(code)

## Key Features
- Teams: create/join with invite code, admin/member roles, team-scoped data
- Categories: colored tags (Network, Servers, Scripts, Credentials, How-To, General)
- Note locking: prevent accidental edits on important notes
- Note pinning: pin to dashboard top
- Note hiding: per-user hide without deleting
- Note metadata: created by, last edited by with timestamps
- Activity log: team actions tracked and displayed in dashboard feed
- Real-time: presence, typing indicators, live content sync
- Auto-save: 2-second debounced save with status indicator

## Key Files
- lib/api.ts — ~40 data access functions (teams, notebooks, notes, categories, locking, pinning, hiding, activity)
- components/TeamContext.tsx — Team state, members, roles, invite/remove
- components/NoteEditor.tsx — Draft.js editor with floating toolbar, lock banner, metadata, collaboration
- components/NoteCard.tsx — Reusable note preview card with categories, lock/pin icons
- components/Dashboard/ — PinnedNotes, RecentNotes, CategoryChips, ActivityFeed
- components/Toast.tsx — Toast notification system
- components/ConfirmDialog.tsx — Styled confirmation modal
- components/CommandPalette.tsx — Cmd+K search overlay

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint 9 (flat config, eslint.config.mjs)

## Known Limitations
- draft-js has unfixable transitive vulnerability (immutable <3.8.3) — library is unmaintained
- Consider replacing Draft.js with Tiptap or Lexical in a future iteration
