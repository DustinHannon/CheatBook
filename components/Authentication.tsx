import React, { useState, FormEvent } from 'react';
import { useAuth } from './AuthContext';

const Authentication: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated, user, signIn, signUp, error, setError } = useAuth();

  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome!</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              You are signed in as <span className="font-medium">{user.email}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password, name || undefined);
      } else {
        await signIn(email, password);
      }
    } catch {
      // Error already set in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            {isSignUp ? 'Create an account' : 'Sign in to CheatBook'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {isSignUp ? 'Enter your details to get started' : 'Enter your email and password'}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {isSignUp && (
            <div>
              <label htmlFor="name" className="sr-only">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300
                          dark:border-gray-700 dark:bg-gray-900 dark:text-white
                          placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500
                          focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300
                        dark:border-gray-700 dark:bg-gray-900 dark:text-white
                        placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500
                        focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300
                        dark:border-gray-700 dark:bg-gray-900 dark:text-white
                        placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500
                        focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent
                        text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700
                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                        disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? (isSignUp ? 'Creating account...' : 'Signing in...')
                : (isSignUp ? 'Create account' : 'Sign in')}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
              className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don\u0027t have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Authentication;
