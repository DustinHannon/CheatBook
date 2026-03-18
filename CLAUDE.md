# CheatBook

Real-time collaborative note-taking app.

## Live URL
https://thecheatbook.vercel.app

## Tech Stack
- Next.js 15 (Pages Router) with TypeScript
- Supabase (PostgreSQL, Auth OTP, Realtime, Storage)
- Tailwind CSS 3 with CSS custom properties for theming
- Draft.js rich text editor
- Vercel hosting

## Architecture
- Auth: Supabase Auth with email OTP (components/AuthContext.tsx)
- Real-time: Supabase Realtime Presence + Broadcast (components/RealtimeContext.tsx)
- Data: Direct client-to-Supabase queries with RLS (lib/api.ts)
- Storage: Supabase Storage buckets for images and avatars
- Middleware: Next.js middleware for session refresh + route protection (middleware.ts)

## Supabase
- Project ID: ccthpkbljqxwtugawcyc
- Region: us-east-1
- Tables: profiles, notebooks, notes, images, collaborators
- RLS enabled on all tables
- Storage buckets: images, avatars

## Key Files
- lib/api.ts — All data access functions (CRUD for notebooks, notes, collaborators, images, profiles)
- lib/supabase/client.ts — Browser Supabase client
- lib/supabase/server.ts — Server-side Supabase client (API routes)
- lib/supabase/middleware.ts — Session refresh logic
- components/AuthContext.tsx — Auth state management
- components/RealtimeContext.tsx — Real-time channel management per note
- components/NoteEditor.tsx — Draft.js editor with collaboration features

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint (flat config, eslint.config.mjs)

## Known Limitations
- draft-js has unfixable transitive vulnerability (immutable <3.8.3) — library is unmaintained
- Editor will be replaced in future redesign
