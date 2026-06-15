import type { Member, Space, Note, ActivityEvent } from './types';

// Shape of the server-prefetched initial AppContext payload. Lives in its own
// neutral module (no server-only imports) so both the server prefetch and the
// client providers/AppContext can reference the type without pulling
// `next/headers` into the client bundle.
export type InitialAppData = {
  me: Member;
  approved: boolean;
  members: Member[];
  spaces: Space[];
  notes: Note[];
  activity: ActivityEvent[];
};
