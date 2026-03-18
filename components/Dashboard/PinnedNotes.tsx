import React from 'react';
import NoteCard, { NoteCardNote } from '../NoteCard';

interface PinnedNotesProps {
  notes: NoteCardNote[];
  onNoteClick: (noteId: string) => void;
}

const PinnedNotes: React.FC<PinnedNotesProps> = ({ notes, onNoteClick }) => {
  if (!notes || notes.length === 0) {
    return null;
  }

  return (
    <section>
      <span className="section-label">PINNED</span>
      <div className="mt-3 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {notes.map((note) => (
          <div key={note.id} className="min-w-[280px] flex-shrink-0">
            <NoteCard
              note={note}
              onClick={() => onNoteClick(note.id)}
            />
          </div>
        ))}
      </div>
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
};

export default PinnedNotes;
