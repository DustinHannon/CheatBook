# CheatBook

A real-time collaborative note-taking app with a dark editorial aesthetic. Create, edit, and share notes with live collaboration, image uploads, and organized notebooks.

**Live:** [thecheatbook.vercel.app](https://thecheatbook.vercel.app)

## Tech Stack

- **Framework**: Next.js 15 (Pages Router), React 19, TypeScript
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth (email + password with email confirmation)
- **Real-time**: Supabase Realtime (Presence + Broadcast)
- **Storage**: Supabase Storage (images, avatars)
- **Styling**: Tailwind CSS 3 with dark editorial design system (CSS custom properties)
- **Typography**: Cormorant Garamond (display), DM Sans (body), JetBrains Mono (code)
- **Editor**: Draft.js with floating selection toolbar
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 22+
- A Supabase project

### Setup

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/DustinHannon/CheatBook.git
   cd CheatBook
   npm install
   ```

2. Create `.env.local` with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Features

- Dark editorial UI with warm gold accent palette
- Real-time collaborative editing with presence indicators
- Email + password authentication with email confirmation
- Floating selection toolbar (appears on text highlight)
- Command palette search (Cmd+K / Ctrl+K)
- Rich text editor (bold, italic, headings, lists)
- Image paste/upload into notes
- Organized notebooks with editorial sidebar
- Full-page search with result cards
- User profile and settings page
- Automatic saving with status indicators

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Cinematic split-screen sign in / sign up |
| `/` | Main dashboard — sidebar + editor |
| `/search` | Full-page note search with editorial cards |
| `/profile` | User settings, avatar, stats |

## Project Structure

```
├── components/
│   ├── AuthContext.tsx        # Supabase Auth provider (email/password)
│   ├── Authentication.tsx     # Cinematic split-screen login/signup
│   ├── CommandPalette.tsx     # Cmd+K search overlay
│   ├── FloatingToolbar.tsx    # Selection-triggered formatting toolbar
│   ├── Layout.tsx             # App shell with animated sidebar
│   ├── NavBar.tsx             # Minimal top bar with search trigger
│   ├── NoteEditor.tsx         # Draft.js editor with collaboration
│   ├── NotesList.tsx          # Editorial sidebar navigation
│   ├── RealtimeContext.tsx    # Supabase Realtime channels
│   └── UserPresence.tsx       # Collaborator avatar badges
├── lib/
│   ├── api.ts                # Supabase data access functions
│   └── supabase/             # Client utilities
├── pages/                    # Next.js pages (login, index, search, profile)
├── styles/
│   ├── theme.css             # Design system variables + animations
│   └── editor.css            # Draft.js typography overrides
└── middleware.ts             # Auth session refresh + route protection
```

## Design System

- **Palette**: Deep charcoal backgrounds (#0a0a0b, #111113, #18181b), warm gold accent (#d4a574), crisp white text (#fafafa)
- **Typography**: Cormorant Garamond serif for display headings, DM Sans for body/UI, JetBrains Mono for code
- **Texture**: CSS noise grain overlay, gold accent divider lines
- **Animations**: Stagger reveals, ease-out-expo timing, fade-in/slide-up transitions

## License

ISC
