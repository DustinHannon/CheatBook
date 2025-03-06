# CheatBook - Real-time Multi-user Note-taking App

A real-time collaborative note-taking application where users can create, edit, and share notes with others. The app features automatic saving, image embedding, and a clean, intuitive interface.

## Features

- **Real-time collaboration**: Multiple users can edit notes simultaneously with live updates
- **Automatic saving**: Changes save automatically as you type
- **Image support**: Paste or upload images directly into notes
- **Organized notebooks**: Group related notes into notebooks
- **Global search**: Find any note quickly
- **Light/dark theme**: Choose your preferred visual style
- **Simple email-code login**: No passwords to remember

## Architecture

### Tech Stack

- **Frontend**: Next.js (React) with TypeScript
- **Backend**: Node.js 22+ with Express
- **Database**: SQLite (stored locally)
- **Real-time communication**: Socket.IO
- **Styling**: MUI (Material-UI) and Tailwind CSS
- **Authentication**: JWT with email verification codes

### Project Structure

```
CheatBook/
├── client/                  # Next.js frontend application
│   ├── components/          # Reusable React components
│   ├── pages/               # Page components and routing
│   ├── public/              # Static assets
│   ├── styles/              # CSS and styling
│   ├── next.config.js       # Next.js configuration
│   └── package.json         # Frontend dependencies
│
├── server/                  # Express backend application
│   ├── config/              # Configuration files
│   ├── controllers/         # Request handlers
│   ├── db/                  # SQLite database files
│   ├── middleware/          # Express middleware
│   ├── models/              # Database models
│   ├── routes/              # API routes
│   ├── services/            # Business logic services
│   ├── uploads/             # Uploaded files (images, etc.)
│   └── utils/               # Utility functions
│
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore file
├── package.json             # Project dependencies and scripts
└── README.md                # Project documentation
```

## Deployment Considerations for Azure

This application is designed to be deployed to an Azure Web App configured for Node.js 22+.

### Azure Web App Configuration

- **Node.js version**: Set to 22.x or later
- **File storage**: The application uses local file storage for:
  - SQLite database (in `server/db/`)
  - Uploaded images (in `server/uploads/`)
  
> **⚠️ Important**: Azure Web Apps use ephemeral storage, which means files can be deleted during app restarts or scaling operations. For production use, consider:
> 1. Configuring persistent storage for the database and uploads
> 2. Using Azure Blob Storage instead of local file storage for uploads
> 3. Setting up regular database backups

## Getting Started

### Prerequisites

- Node.js version 22 or higher
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/cheatbook.git
   cd cheatbook
   ```

2. Install dependencies:
   ```bash
   npm run install:all
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file to set your environment variables

### Development

Run both frontend and backend in development mode:

```bash
npm run dev
```

This will start:
- Backend server on http://localhost:5000
- Frontend development server on http://localhost:3000

### Building for Production

```bash
npm run build
npm start
```

## API Endpoints

The backend provides RESTful API endpoints for:

- Authentication (`/api/auth/`)
- User management (`/api/users/`)
- Notes and notebooks (`/api/notes/`)

## Real-Time Collaboration: How It Works

#### How it works:
1. When you open a note, your computer connects to our special message center (Socket.IO)
2. As you type or add pictures, your computer sends tiny messages to the message center
3. The message center then sends those messages to everyone else looking at the same note
4. Their screens update instantly to show what you just did!

It's like a game of telephone, but super fast and the message never gets mixed up.

### Collaboration Features

- **See who's editing**: Colorful avatars show who's currently viewing the note
- **Watch typing happen**: See text appear as others type it
- **Cursor tracking**: See where other people are typing
- **Image uploads**: When someone adds an image, everyone sees it instantly

### Potential Pitfalls (In Simple Terms)

#### When Two People Edit the Same Thing

**What happens**: If you and a friend try to change the exact same word at the same time, someone's change might get lost.

**Simple solution**: We use a system where changes get a version number. If there's a conflict, the most recent version wins. The app will show you if your changes were overwritten.

#### Slow Internet Problems

**What happens**: If your internet is slow or disconnects, your changes might take longer to reach others.

**Simple solution**: The app saves all changes locally first, then tries to send them when your connection is working. You'll see a "Reconnecting..." message if this happens.

#### Half-Uploaded Images

**What happens**: If you start uploading a big picture but close your browser before it finishes, others might see a placeholder but no image.

**Simple solution**: CheatBook shows upload progress to everyone. If an upload is interrupted, everyone gets notified, and the incomplete image is removed.

## Development Guide

For detailed information about the codebase and how to extend it, please refer to the [DEVELOPMENT.md](DEVELOPMENT.md) file.

## License

This project is licensed under the ISC License. 

## Acknowledgments

- The Draft.js team for their excellent rich text editor
- The Socket.IO team for making real-time communication so accessible
- The Next.js and React teams for their amazing frameworks 