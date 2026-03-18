import React from 'react';
import NoteCard, { NoteCardNote } from '../NoteCard';
import { SkeletonCard } from '../Skeleton';

interface RecentNotesProps {
  notes: NoteCardNote[];
  onNoteClick: (noteId: string) => void;
  isLoading: boolean;
}

const RecentNotes: React.FC<RecentNotesProps> = ({ notes, onNoteClick, isLoading }) => {
  return (
    <section>
      <span className="section-label">RECENT NOTES</span>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </>
        ) : notes.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <p className="text-text-tertiary text-sm">
              No notes yet. Create your first note to get started.
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onClick={() => onNoteClick(note.id)}
            />
          ))
        )}
      </div>
    </section>
  );
};

export default RecentNotes;
