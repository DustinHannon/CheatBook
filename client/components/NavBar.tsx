import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import { SearchIcon, MenuIcon, XIcon, UserIcon, LoginIcon, LogoutIcon } from '@heroicons/react/24/outline';
import { useTheme } from 'next-themes';
import { useAuth } from './AuthContext';

/**
 * NavBar Component
 * Top navigation bar with app name, search bar, and theme toggle
 */
const NavBar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <nav className="bg-background-primary border-b border-border shadow-sm fixed top-0 left-0 right-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-header">
          {/* Logo and App Name */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <svg 
                className="h-8 w-8 text-primary" 
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
                <path 
                  d="M7 7L17 7" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M7 12L17 12" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M7 17L13 17" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              <span className="ml-2 text-xl font-bold text-text-primary">CheatBook</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mr-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="w-64 pl-10 pr-4 py-2 rounded-md bg-background-secondary text-text-primary placeholder-text-tertiary border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <SearchIcon className="h-5 w-5 text-text-tertiary absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>
            </form>

            {/* Navigation Links */}
            <div className="flex items-center space-x-4">
              <Link href="/notebooks" className="text-text-primary hover:text-primary transition-colors">
                Notebooks
              </Link>
              <Link href="/notes" className="text-text-primary hover:text-primary transition-colors">
                Notes
              </Link>
              
              {/* Theme Toggle */}
              <ThemeToggle />
              
              {/* User Profile or Auth Button */}
              {isAuthenticated && user ? (
                <div className="relative group">
                  <button className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-medium">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </button>
                  
                  {/* Dropdown */}
                  <div className="absolute right-0 mt-2 w-48 bg-background-primary border border-border rounded-md shadow-lg hidden group-hover:block">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-text-secondary border-b border-border">
                        Signed in as <span className="font-medium text-text-primary">{user.email}</span>
                      </div>
                      <Link href="/profile" className="block px-4 py-2 text-sm text-text-primary hover:bg-surface-hover">
                        <div className="flex items-center">
                          <UserIcon className="mr-2 h-4 w-4" />
                          Profile
                        </div>
                      </Link>
                      <button 
                        onClick={handleLogout}
                        className="w-full text-left block px-4 py-2 text-sm text-text-primary hover:bg-surface-hover"
                      >
                        <div className="flex items-center">
                          <LogoutIcon className="mr-2 h-4 w-4" />
                          Sign out
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <Link 
                  href="/login"
                  className="flex items-center text-text-primary hover:text-primary transition-colors"
                >
                  <LoginIcon className="h-5 w-5 mr-1" />
                  <span>Sign in</span>
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <ThemeToggle />
            <button
              onClick={toggleMobileMenu}
              className="ml-2 p-2 rounded-md text-text-primary hover:bg-surface-hover focus:outline-none"
            >
              {isMobileMenuOpen ? (
                <XIcon className="h-6 w-6" />
              ) : (
                <MenuIcon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-background-secondary border-t border-border">
          <div className="px-4 pt-2 pb-3 space-y-1 sm:px-3">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mb-3 mt-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="w-full pl-10 pr-4 py-2 rounded-md bg-background-tertiary text-text-primary placeholder-text-tertiary border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <SearchIcon className="h-5 w-5 text-text-tertiary absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>
            </form>

            {/* Mobile Navigation Links */}
            <Link 
              href="/notebooks"
              className="block px-3 py-2 rounded-md text-base font-medium text-text-primary hover:bg-surface-hover"
            >
              Notebooks
            </Link>
            <Link 
              href="/notes"
              className="block px-3 py-2 rounded-md text-base font-medium text-text-primary hover:bg-surface-hover"
            >
              Notes
            </Link>
            
            {isAuthenticated && user ? (
              <>
                <Link 
                  href="/profile"
                  className="block px-3 py-2 rounded-md text-base font-medium text-text-primary hover:bg-surface-hover"
                >
                  Profile
                </Link>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-text-primary hover:bg-surface-hover"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link 
                href="/login"
                className="block px-3 py-2 rounded-md text-base font-medium text-text-primary hover:bg-surface-hover"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default NavBar; 