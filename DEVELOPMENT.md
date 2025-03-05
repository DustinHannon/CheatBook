# CheatBook Development Guide

This document provides detailed technical information for developers working on the CheatBook project. It covers the architecture, implementation details of real-time collaboration, and guidelines for extending the codebase.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Real-time Collaboration Implementation](#real-time-collaboration-implementation)
- [Database Schema](#database-schema)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Common Issues and Solutions](#common-issues-and-solutions)

## Architecture Overview

CheatBook follows a client-server architecture with real-time communication:

```
┌─────────────┐                ┌──────────────┐
│             │◄─── HTTP ─────►│              │
│  Next.js    │                │  Express.js  │
│  Frontend   │◄─── WS/IO ────►│  Backend     │
│             │                │              │
└─────────────┘                └──────────────┘
                                      │
                                      ▼
                                ┌──────────────┐
                                │   SQLite     │
                                │  Database    │
                                └──────────────┘
```

### Key Components

1. **Frontend (Next.js/React)**
   - `pages/`: Page components and routing
   - `components/`: Reusable UI components
   - `NoteEditor.tsx`: Main editor component with real-time capabilities
   - `ImagePaste.tsx`: Handles image paste functionality
   - `UserPresence.tsx`: Shows active users in collaborative editing

2. **Backend (Express.js)**
   - `routes/`: API endpoints for notes, users, auth
   - `services/socket.service.js`: Socket.IO event handlers for real-time collaboration
   - `models/`: Database models and queries
   - `middleware/`: Authentication, validation, etc.

3. **Real-time Communication (Socket.IO)**
   - Client connects to server when viewing/editing notes
   - Server broadcasts changes to all connected clients
   - Rooms created for each note to isolate broadcasts

## Real-time Collaboration Implementation

### Socket.IO Server Implementation

The backend's real-time functionality is implemented in `server/services/socket.service.js`. It manages:

1. **Connection and Authentication**
   ```javascript
   io.use(async (socket, next) => {
     try {
       const token = socket.handshake.auth.token;
       // Verify JWT token
       const user = await verifyToken(token);
       socket.user = user;
       return next();
     } catch (error) {
       return next(new Error('Authentication error'));
     }
   });
   ```

2. **User-Note Associations**
   - When a user opens a note, they join a note-specific room:
   ```javascript
   socket.on('join-note', async (noteId) => {
     // Check permission
     // Join room 
     socket.join(`note:${noteId}`);
     // Track active users
     // Notify other users
   });
   ```

3. **Data Structures for Tracking**
   ```javascript
   // Track users in each note
   const activeUsers = new Map();
   // Track socket-to-user mapping
   const userSockets = new Map();
   // Track document versions
   const noteVersions = new Map();
   // Track typing status
   const activeTyping = new Map();
   // Track image uploads
   const activeUploads = new Map();
   ```

4. **Version Control for Conflict Resolution**
   - Each change to a note increments a version counter
   - Changes include the client's version to detect conflicts
   - Server sends version conflicts back to clients when detected

### Socket.IO Client Implementation

The frontend connects to the Socket.IO server in `NoteEditor.tsx` component:

1. **Establishing Connection**
   ```typescript
   useEffect(() => {
     if (!userToken || !note?.id) return;
     
     // Connect to Socket.IO server
     const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
       auth: { token: userToken }
     });
     
     // Setup event handlers
     // ...
     
     return () => {
       // Cleanup
       socketInstance.disconnect();
     };
   }, [userToken, note?.id]);
   ```

2. **Handling Real-time Events**
   ```typescript
   // Listen for note updates from other users
   socketInstance.on('note-updated', (data) => {
     if (data.noteId === note.id && data.userId !== socketInstance.id) {
       // Update document version
       // Apply changes to editor
     }
   });
   
   // Listen for typing status, cursor positions, etc.
   ```

3. **Broadcasting Changes**
   ```typescript
   // When content changes
   const broadcastChanges = useCallback((editorState) => {
     if (!socket || !isConnected || !note?.id) return;
     
     const contentState = editorState.getCurrentContent();
     const rawContent = JSON.stringify(convertToRaw(contentState));
     
     socket.emit('note-update', {
       noteId: note.id,
       content: rawContent,
       localVersion: docVersion,
       shouldSave: false
     });
   }, [socket, isConnected, note?.id, docVersion]);
   ```

### Concurrency Control

The system uses optimistic concurrency control with version numbers:

1. Each note has a server-side version counter
2. When a client sends an update, it includes its local version
3. If local version < server version, a conflict is detected
4. On conflict, the server sends the current version back to the client
5. The client updates its editor with the latest content

For conflict resolution, we use a "last writer wins" strategy. While simple, this suffices for most collaboration scenarios. More complex applications might implement:

- Operational Transforms (OT)
- Conflict-free Replicated Data Types (CRDT)
- Differential sync algorithms

### Image Upload Collaboration

Images are handled through a special protocol:

1. Client announces upload start with unique ID
2. Progress updates are broadcast to all users
3. Upload completion with URL is broadcast
4. All clients insert the image at the specified position

## Database Schema

The application uses SQLite with the following main tables:

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  avatar TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Notebooks Table
```sql
CREATE TABLE notebooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
```

### Notes Table
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  owner_id TEXT NOT NULL,
  notebook_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
);
```

### Collaborators Table
```sql
CREATE TABLE collaborators (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission TEXT CHECK(permission IN ('read', 'write', 'admin')) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(notebook_id, user_id)
);
```

## Development Workflow

### Setting Up Your Development Environment

1. **Clone and Install**
   ```bash
   git clone https://github.com/yourusername/cheatbook.git
   cd cheatbook
   npm run install:all
   ```

2. **Environment Configuration**
   - Copy `.env.example` to `.env`
   - Configure database path, JWT secret, etc.

3. **Running Development Servers**
   ```bash
   # Run both client and server
   npm run dev
   
   # Run only server
   npm run dev:server
   
   # Run only client
   npm run dev:client
   ```

### Code Style and Conventions

- **TypeScript**: Use strict types for all new code
- **React Components**: Functional components with hooks
- **File Naming**:
  - React components: PascalCase (e.g., `NoteEditor.tsx`)
  - Utilities and services: camelCase (e.g., `socket.service.js`)
- **Import Order**:
  1. External libraries
  2. Internal components/modules
  3. Types and interfaces
  4. CSS/SCSS imports

### Adding New Features

When adding new features:

1. **Plan the API endpoints** (if needed)
2. **Add backend routes and controllers** first
3. **Implement Socket.IO events** for real-time aspects
4. **Create or modify frontend components**
5. **Write tests** for new functionality

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run only frontend tests
npm run test:client

# Run only backend tests
npm run test:server
```

### Test Structure

- **Frontend**: Jest + React Testing Library
- **Backend**: Jest + Supertest for API testing
- **Socket.IO testing**: Mock Socket.IO clients

## Common Issues and Solutions

### Socket.IO Connection Issues

**Issue**: Client cannot connect to Socket.IO server
**Solution**: 
1. Check CORS configuration in server setup
2. Verify client is using the correct server URL
3. Check authentication token validity

```javascript
// Proper CORS setup for Socket.IO
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

### Draft.js State Synchronization

**Issue**: Content changes aren't properly synchronized
**Solution**:
1. Ensure proper conversion between Draft.js ContentState and raw JSON
2. Check version tracking for conflicts
3. Verify that selection state isn't interfering with content updates

```typescript
// Properly handle content state conversion
const contentState = convertFromRaw(JSON.parse(data.content));
const newEditorState = EditorState.createWithContent(contentState);

// Preserve cursor if possible
if (lastSelectionState.current) {
  const withSelection = EditorState.forceSelection(newEditorState, lastSelectionState.current);
  setEditorState(withSelection);
} else {
  setEditorState(newEditorState);
}
```

### Image Upload Issues

**Issue**: Images don't appear for all users
**Solution**:
1. Check that image URLs are absolute paths
2. Verify image insert position calculation
3. Ensure proper error handling for failed uploads

### Memory Leaks

**Issue**: Memory usage grows over time
**Solution**:
1. Clean up Socket.IO listeners in useEffect return functions
2. Remove users from tracking maps when they disconnect
3. Implement proper garbage collection for image upload tracking

```typescript
// Cleanup in useEffect
return () => {
  if (socketInstance) {
    if (note?.id) {
      socketInstance.emit('leave-note', note.id);
    }
    socketInstance.disconnect();
  }
};
```

## Performance Optimization

### Socket.IO Event Optimization

To reduce network traffic and improve performance:

1. **Debounce rapid events** like cursor movement:
   ```typescript
   const throttleRef = useRef<NodeJS.Timeout | null>(null);
   
   if (throttleRef.current) {
     clearTimeout(throttleRef.current);
   }
   
   throttleRef.current = setTimeout(() => {
     // Send event
   }, 100); // 100ms throttle
   ```

2. **Delta updates**: Only send what changed instead of the entire document
3. **Compression**: Consider compressing large content updates

### Draft.js Performance

For large documents:

1. **Memoize components** to prevent unnecessary re-renders
2. **Virtualize rendering** for very large documents
3. **Throttle selection state updates** during rapid typing

## Extending the Codebase

### Adding New Socket.IO Events

1. **Define the event in socket.service.js**:
   ```javascript
   socket.on('new-event-name', (data) => {
     // Process event
     // Broadcast to others if needed
   });
   ```

2. **Add listener in client component**:
   ```typescript
   useEffect(() => {
     socket.on('new-event-name', (data) => {
       // Handle event
     });
     
     return () => {
       socket.off('new-event-name');
     };
   }, [socket]);
   ```

### Adding New API Endpoints

1. **Create a new route file** or extend existing one:
   ```javascript
   // server/routes/new-feature.routes.js
   const express = require('express');
   const router = express.Router();
   
   router.get('/endpoint', (req, res) => {
     // Handle request
   });
   
   module.exports = router;
   ```

2. **Register in server.js**:
   ```javascript
   const newFeatureRoutes = require('./routes/new-feature.routes');
   app.use('/api/new-feature', newFeatureRoutes);
   ```

## Conclusion

This development guide should provide a solid foundation for understanding and extending the CheatBook application. For specific questions or issues not covered here, please check the codebase or open a discussion in the project's issue tracker.
