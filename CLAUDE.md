# CheatBook

Real-time collaborative note-taking app with dark editorial aesthetic.

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
- CSS variables defined in styles/theme.css (--bg-base, --bg-raised, --bg-surface, --text-primary, --text-body, --accent, etc.)
- Tailwind mapped: bg-bg-base, bg-bg-raised, text-text-primary, text-accent, border-border, etc.
- Noise grain overlay on body, gold divider lines, stagger-reveal animations
- Font classes: font-display (Cormorant Garamond), font-body (DM Sans), font-mono (JetBrains Mono)
- Typography classes: text-display-lg, text-display-md, text-display-sm, section-label

## Architecture
- Auth: Supabase Auth email/password (components/AuthContext.tsx) — signIn, signUp, logout
- Real-time: Supabase Realtime Presence + Broadcast (components/RealtimeContext.tsx)
- Data: Direct client-to-Supabase queries with RLS (lib/api.ts)
- Storage: Supabase Storage buckets for images and avatars
- Middleware: Next.js middleware for session refresh + route protection (middleware.ts)

## Pages
- /login — Cinematic split-screen auth (components/Authentication.tsx)
- / — Main dashboard: animated sidebar + editor (pages/index.tsx)
- /search — Full-page search with editorial result cards (pages/search.tsx)
- /profile — User settings, avatar, stats (pages/profile.tsx)

## Supabase
- Project ID: ccthpkbljqxwtugawcyc
- Region: us-east-1
- Tables: profiles, notebooks, notes, images, collaborators
- RLS enabled on all tables
- Storage buckets: images, avatars
- Auth: email/password with email confirmation enabled

## Key Files
- styles/theme.css — Design system variables, noise overlay, animations
- styles/editor.css — Draft.js editorial typography overrides
- tailwind.config.js — Font families, color tokens, animation keyframes
- lib/api.ts — All data access functions (CRUD for notebooks, notes, collaborators, images, profiles)
- components/NoteEditor.tsx — Draft.js editor with floating toolbar and collaboration
- components/FloatingToolbar.tsx — Selection-triggered formatting toolbar
- components/CommandPalette.tsx — Cmd+K search overlay with keyboard navigation
- components/Layout.tsx — App shell with animated 280px sidebar
- components/NavBar.tsx — Minimal 52px top bar with search trigger and user menu
- components/NotesList.tsx — Editorial sidebar with gold accents, collapsible sections

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint 9 (flat config, eslint.config.mjs)

## Known Limitations
- draft-js has unfixable transitive vulnerability (immutable <3.8.3) — library is unmaintained
- Consider replacing Draft.js with Tiptap or Lexical in a future iteration
