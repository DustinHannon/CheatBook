import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bars3Icon, MagnifyingGlassIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from './AuthContext';

interface NavBarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  isMobileView?: boolean;
  onOpenSearch?: () => void;
}

const NavBar: React.FC<NavBarProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  isMobileView,
  onOpenSearch,
}) => {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    router.push('/login');
  };

  const handleSearchClick = () => {
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      console.log('Command palette triggered');
    }
  };

  // Register Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleSearchClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOpenSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <nav className="h-[52px] fixed top-0 left-0 right-0 z-10 bg-bg-raised border-b border-border-subtle flex items-center px-4">
      {/* LEFT: Logo (+ hamburger on mobile) */}
      <div className="flex items-center shrink-0">
        {isMobileView && (
          <button
            onClick={onToggleSidebar}
            className="mr-2 p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover focus:outline-none"
            aria-label="Toggle sidebar"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
        )}

        {!isMobileView && (
          <Link href="/" className="flex items-center gap-2">
            <svg
              className="h-6 w-6 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M7 7L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 12L17 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 17L13 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display text-lg font-semibold text-text-primary">CheatBook</span>
          </Link>
        )}
      </div>

      {/* CENTER: Search trigger */}
      {isMobileView ? (
        <div className="flex-1 flex justify-center">
          <button
            onClick={handleSearchClick}
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover focus:outline-none"
            aria-label="Search notes"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex-1 flex justify-center px-4">
          <button
            onClick={handleSearchClick}
            className="flex items-center gap-2 bg-bg-surface border border-border-default rounded-lg px-4 py-1.5 w-full max-w-[400px] text-left hover:border-border-emphasis focus:outline-none"
          >
            <MagnifyingGlassIcon className="h-4 w-4 text-text-tertiary shrink-0" />
            <span className="text-sm text-text-tertiary flex-1">Search notes...</span>
            <span className="bg-bg-surface-hover rounded px-1.5 py-0.5 text-xs text-text-tertiary shrink-0">
              {typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '\u2318K' : 'Ctrl+K'}
            </span>
          </button>
        </div>
      )}

      {/* RIGHT: User avatar */}
      <div className="shrink-0">
        {isAuthenticated && user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-bg-base font-medium text-sm focus:outline-none"
              aria-label="User menu"
            >
              {userInitial}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-bg-surface border border-border-default rounded-lg shadow-lg overflow-hidden animate-slide-up">
                <div className="px-4 py-3 border-b border-border-subtle">
                  <p className="text-xs text-text-tertiary">Signed in as</p>
                  <p className="text-sm font-medium text-text-primary truncate">{user.email}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      router.push('/profile');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover"
                  >
                    Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-text-body hover:bg-bg-surface-hover flex items-center gap-2"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
