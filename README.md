# CheatBook

A real-time collaborative note-taking app. Create, edit, and share notes with live collaboration, image uploads, and organized notebooks.

## Tech Stack

- **Framework**: Next.js 15 (Pages Router) with TypeScript
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth (email OTP)
- **Real-time**: Supabase Realtime (Presence + Broadcast)
- **Storage**: Supabase Storage (images, avatars)
- **Styling**: Tailwind CSS 3 with CSS custom properties for theming
- **Editor**: Draft.js rich text editor
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

- Real-time collaborative editing with presence indicators
- Email OTP authentication (no passwords)
- Rich text editor (bold, italic, headings, lists)
- Image paste/upload into notes
- Organized notebooks with note grouping
- Global search across all notes
- Light/dark theme
- Automatic saving

## Project Structure

```
├── components/       # React components
│   ├── AuthContext.tsx        # Supabase Auth provider
│   ├── RealtimeContext.tsx    # Supabase Realtime channels
│   ├── NoteEditor.tsx        # Draft.js editor with collaboration
│   └── ...
├── lib/
│   ├── api.ts                # Supabase data access functions
│   └── supabase/             # Supabase client utilities
├── pages/            # Next.js pages
├── styles/           # Tailwind CSS + theme variables
└── middleware.ts     # Auth session refresh + route protection
```

## License

ISC
