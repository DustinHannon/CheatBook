# CheatBook

IT team notes app — quick collaborative notes for IPs, scripts, how-tos, credentials, and reference info.

## Live URL
https://thecheatbook.vercel.app

## Tech Stack
- Next.js 15 (Pages Router), React 19, TypeScript
- Supabase (PostgreSQL, Auth email/password, Realtime, Storage)
- TinyMCE 7 (self-hosted GPL, dark oxide skin) — replaced Draft.js
- Tailwind CSS 3 with dark editorial design system
- Typography: Cormorant Garamond (display), DM Sans (body), JetBrains Mono (code)
- Vercel hosting

## Design System
- Dark palette: #0a0a0b base, #111113 raised, #18181b surface
- Warm gold accent: #d4a574
- CSS variables in styles/theme.css
- Tailwind mapped: bg-bg-base, bg-bg-raised, text-text-primary, text-accent, border-border, etc.
- Font classes: font-display, font-body, font-mono

## Architecture
- Auth: Supabase Auth email/password with email confirmation (components/AuthContext.tsx)
- Teams: TeamContext manages team state, members, roles (components/TeamContext.tsx)
- Real-time: Supabase Realtime Presence + Broadcast per note (components/RealtimeContext.tsx)
- Data: Direct client-to-Supabase queries with RLS (lib/api.ts)
- Editor: TinyMCE in uncontrolled mode — content managed internally, read on save via editor.getContent()
- Middleware: Auth redirect only (lib/supabase/middleware.ts) — team-setup redirect handled client-side by TeamContext
- Toasts: ToastProvider + useToast() hook (components/Toast.tsx)

## Pages
- /login — Cinematic split-screen auth (components/Authentication.tsx)
- /team-setup — Create or join team with invite code
- / — Dashboard: sidebar + recent notes + activity feed
- /notes/[id] — TinyMCE editor with real-time collaboration
- /notebooks/[id] — Notebook listing with note cards
- /search — Full-page search
- /profile — Settings, team management, avatar

## Supabase
- Project ID: ccthpkbljqxwtugawcyc
- Region: us-east-1
- Tables: profiles, teams, team_members, notebooks, notes, categories, note_categories, images, hidden_notes, activity_log, collaborators
- RLS: ALL policies use profiles.team_id for team checks (NO cross-table recursive policies)
- Storage buckets: images, avatars
- Auth: email/password with email confirmation enabled
- Site URL configured to https://thecheatbook.vercel.app
- Database functions: create_team_with_owner(team_name), join_team_by_code(code)

## Key Implementation Notes

### RLS Policy Pattern
CRITICAL: All RLS policies must check team membership via `profiles.team_id`, NOT via `team_members` table. The `team_members` table has its own RLS, so checking it from another table's policy creates infinite recursion. Pattern:
```sql
EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.team_id = <table>.team_id)
```

### TinyMCE Integration
- Self-hosted: assets in public/tinymce/ (copy from node_modules/tinymce on install)
- licenseKey="gpl" on the Editor component
- UNCONTROLLED mode: don't set React state on every keystroke (causes cursor reset/backward typing)
- Read content via editorRef.current.getContent() when saving
- Content stored as HTML in database
- Old Draft.js JSON auto-converts to HTML via draftJsonToHtml() helper
- Content CSS uses inline styles matching the dark theme (content_style prop)

### Auth Session
- `supabase.auth.getSession()` is more reliable than `getUser()` on client-side (reads local cache)
- For page-level data fetching, query Supabase directly with user.id from AuthContext rather than using API helpers that call getCurrentUser()

### Note Content
- Stored as HTML (TinyMCE output)
- Legacy content may be Draft.js JSON — detected by JSON.parse + checking for blocks array
- Preview text: strip HTML tags with regex `.replace(/<[^>]*>/g, ' ')` + decode entities

## Key Files
- components/NoteEditor.tsx — TinyMCE editor with auto-save, real-time, lock/pin/hide
- components/TeamContext.tsx — Team state, members, roles
- components/Layout.tsx — App shell with sidebar (always visible)
- components/NotesList.tsx — Sidebar notebook/note navigation
- components/NavBar.tsx — Top bar with search trigger, user menu
- components/CommandPalette.tsx — Cmd+K search overlay
- components/NoteCard.tsx — Note preview card (strips HTML for preview)
- components/Toast.tsx — Toast notification system
- components/ConfirmDialog.tsx — Styled confirmation modal
- components/InputDialog.tsx — Text input modal (notebook creation)
- components/NotebookPickerDialog.tsx — Notebook selection for new notes
- lib/api.ts — ~40 Supabase data access functions
- pages/profile.tsx — Settings + team management (invite code, members, roles)
- public/tinymce/ — Self-hosted TinyMCE assets (skins, themes, icons, plugins)

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint 9 (flat config, eslint.config.mjs)
