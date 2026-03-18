import React from 'react';
import { LockClosedIcon } from '@heroicons/react/24/solid';
import { MapPinIcon } from '@heroicons/react/24/solid';
import CategoryBadge from './CategoryBadge';

interface NoteCategory {
  id: string;
  name: string;
  color: string;
}

export interface NoteCardNote {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
  owner_name?: string;
  is_locked?: boolean;
  is_pinned?: boolean;
  categories?: NoteCategory[];
}

interface NoteCardProps {
  note: NoteCardNote;
  onClick: () => void;
  onPin?: () => void;
  onHide?: () => void;
}

function extractPlainText(content: string): string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.blocks)) {
      return parsed.blocks
        .map((block: { text?: string }) => block.text || '')
        .join(' ')
        .trim();
    }
  } catch {
    // Not JSON, return as-is
  }
  return content;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 7) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (diffDay > 1) {
    return `${diffDay}d ago`;
  } else if (diffDay === 1) {
    return 'Yesterday';
  } else if (diffHour > 0) {
    return `${diffHour}h ago`;
  } else if (diffMin > 0) {
    return `${diffMin}m ago`;
  } else {
    return 'Just now';
  }
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onClick, onPin, onHide }) => {
  const plainText = extractPlainText(note.content || '');
  const truncatedText = plainText.length > 120
    ? plainText.substring(0, 120) + '...'
    : plainText;

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPin?.();
  };

  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHide?.();
  };

  return (
    <div
      onClick={onClick}
      className="bg-bg-raised border border-border-subtle rounded-lg p-5 hover:bg-bg-surface-hover hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      {/* Title row */}
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-text-primary truncate flex-1">
          {note.title || 'Untitled'}
        </h3>
        {note.is_locked && (
          <LockClosedIcon className="h-4 w-4 text-text-tertiary shrink-0" />
        )}
        {note.is_pinned && (
          <MapPinIcon className="h-4 w-4 text-accent shrink-0" />
        )}
      </div>

      {/* Content preview */}
      {truncatedText && (
        <p className="text-sm text-text-secondary mt-2 line-clamp-3">
          {truncatedText}
        </p>
      )}

      {/* Categories */}
      {note.categories && note.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {note.categories.map((cat) => (
            <CategoryBadge key={cat.id} name={cat.name} color={cat.color} />
          ))}
        </div>
      )}

      {/* Bottom row */}
      <div className="mt-3 flex items-center justify-between text-xs text-text-tertiary">
        <span>by {note.owner_name || 'Unknown'}</span>
        <span>{formatRelativeTime(note.updated_at)}</span>
      </div>
    </div>
  );
};

export { extractPlainText, formatRelativeTime };
export default NoteCard;
