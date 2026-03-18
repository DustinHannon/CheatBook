import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { createClient } from '../lib/supabase/client';
import { searchNotes, getNotebooks, Note } from '../lib/api';

const supabase = createClient();

const SearchPage: NextPage = () => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load notebooks for Layout
  useEffect(() => {
    const loadNotebooks = async () => {
      try {
        const data = await getNotebooks(supabase);
        setNotebooks(data);
      } catch {
        // Silently fail - layout will just show empty
      }
    };
    loadNotebooks();
  }, []);

  // Pre-fill from URL query param
  useEffect(() => {
    if (router.query.q && typeof router.query.q === 'string') {
      setQuery(router.query.q);
    }
  }, [router.query.q]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await searchNotes(supabase, searchQuery.trim());
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleResultClick = (note: Note) => {
    router.push('/');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getContentPreview = (content: string | null): string => {
    if (!content) return 'No content';
    // Strip any markdown/html for preview
    const plain = content.replace(/<[^>]+>/g, '').replace(/[#*_~`]/g, '');
    return plain.slice(0, 200);
  };

  return (
    <ProtectedRoute>
      <Head>
        <title>Search - CheatBook</title>
      </Head>
      <Layout notebooks={notebooks}>
        <div className="bg-bg-base min-h-full">
          {/* Search input section */}
          <div className="pt-16 pb-8 px-6">
            <div className="max-w-3xl mx-auto">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your notes..."
                className="w-full font-display text-2xl bg-transparent border-b-2 border-border-default focus:border-accent py-4 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-0 transition-colors"
              />
            </div>
          </div>

          {/* Results section */}
          <div className="px-6 pb-16">
            <div className="max-w-3xl mx-auto">
              {isLoading && (
                <p className="text-text-tertiary text-center mt-16 animate-pulse font-body">
                  Searching...
                </p>
              )}

              {!isLoading && !hasSearched && (
                <p className="text-text-tertiary text-center mt-16 font-body">
                  Start typing to search
                </p>
              )}

              {!isLoading && hasSearched && results.length === 0 && (
                <p className="text-text-tertiary text-center mt-16 font-body">
                  No results found
                </p>
              )}

              {!isLoading && results.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                  {results.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => handleResultClick(note)}
                      className="bg-bg-raised border border-border-subtle rounded-lg p-6 hover:bg-bg-surface-hover hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                      <h3 className="font-semibold text-text-primary font-body">
                        {note.title}
                      </h3>
                      <p className="text-sm text-text-secondary mt-2 line-clamp-3 font-body">
                        {getContentPreview(note.content)}
                      </p>
                      <div className="text-xs text-text-tertiary mt-4 font-body flex items-center gap-2">
                        {note.owner_name && (
                          <>
                            <span>{note.owner_name}</span>
                            <span>&middot;</span>
                          </>
                        )}
                        <span>{formatDate(note.updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default SearchPage;
