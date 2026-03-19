import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { createClient } from '../lib/supabase/client';
import { searchNotes } from '../lib/api';

interface SearchResult {
  id: string;
  title: string;
  content: string | null;
  notebook_id: string | null;
  updated_at: string;
  owner_name?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setHasSearched(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const data = await searchNotes(supabase, searchQuery.trim());
      setResults(data as SearchResult[]);
      setHasSearched(true);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, performSearch]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            navigateToNote(results[selectedIndex].id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const navigateToNote = (noteId: string) => {
    onClose();
    router.push(`/notes/${noteId}`);
  };

  const getContentPreview = (content: string | null): string => {
    if (!content) return 'No content';
    const stripped = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped.length > 120 ? stripped.substring(0, 120) + '...' : stripped;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-bg-overlay backdrop-blur-sm flex items-start justify-center pt-[15vh] animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-bg-surface border border-border-default rounded-xl shadow-lg max-w-[640px] w-full mx-4 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-border-subtle">
          <MagnifyingGlassIcon className="h-5 w-5 text-text-tertiary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes..."
            className="flex-1 bg-transparent border-none outline-none text-lg text-text-primary placeholder:text-text-tertiary py-4 font-body"
          />
          <button
            onClick={onClose}
            className="text-xs text-text-tertiary bg-bg-surface-hover rounded px-1.5 py-0.5 shrink-0"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              Searching...
            </div>
          )}

          {!isLoading && !hasSearched && !query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              Type to search your notes...
            </div>
          )}

          {!isLoading && hasSearched && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {!isLoading &&
            results.map((result, index) => (
              <button
                key={result.id}
                onClick={() => navigateToNote(result.id)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full text-left px-4 py-3 flex flex-col gap-0.5 transition-colors ${
                  index === selectedIndex ? 'bg-bg-surface-hover' : ''
                }`}
              >
                <span className="font-medium text-text-primary text-sm">
                  {result.title || 'Untitled'}
                </span>
                <span className="text-sm text-text-secondary truncate">
                  {getContentPreview(result.content)}
                </span>
                <span className="text-xs text-text-tertiary">
                  {formatDate(result.updated_at)}
                </span>
              </button>
            ))}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border-subtle flex items-center gap-4 text-xs text-text-tertiary">
            <span className="flex items-center gap-1">
              <kbd className="bg-bg-surface-hover rounded px-1 py-0.5 font-mono text-[10px]">&uarr;&darr;</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-bg-surface-hover rounded px-1 py-0.5 font-mono text-[10px]">&crarr;</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-bg-surface-hover rounded px-1 py-0.5 font-mono text-[10px]">esc</kbd>
              close
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandPalette;
