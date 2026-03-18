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
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="text-center">
          <h2 className="text-display-sm font-display text-text-primary">Welcome back</h2>
          <p className="mt-2 text-text-secondary font-body">
            Signed in as <span className="text-text-primary">{user.email}</span>
          </p>
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
    <div className="min-h-screen flex flex-col md:flex-row bg-bg-base">
      {/* Left decorative panel - Desktop */}
      <div className="hidden md:flex w-1/2 bg-bg-raised items-center justify-center animate-fade-in">
        <div className="text-center">
          <h1 className="text-display-lg font-display font-semibold text-text-primary">
            CheatBook
          </h1>
          <div className="divider-gold w-24 mx-auto my-6" />
          <p className="text-lg text-text-secondary font-body italic">
            Where ideas take shape
          </p>
        </div>
      </div>

      {/* Mobile logo section */}
      <div className="md:hidden py-12 text-center bg-bg-raised">
        <h1 className="text-display-md font-display font-semibold text-text-primary">
          CheatBook
        </h1>
        <div className="divider-gold w-16 mx-auto my-4" />
        <p className="text-base text-text-secondary font-body italic">
          Where ideas take shape
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 md:w-1/2 flex items-center justify-center bg-bg-base px-6 py-12 md:py-0">
        <div className="max-w-sm w-full animate-slide-up">
          <div className="stagger-1">
            <h2 className="text-display-sm font-display text-text-primary">
              {isSignUp ? 'Create account' : 'Sign in'}
            </h2>
            <p className="text-sm text-text-secondary mt-2 font-body">
              Enter your credentials
            </p>
          </div>

          {error && (
            <div
              className="mt-6 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg px-4 py-3 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <form className="mt-8" onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="stagger-1 mb-4">
                <label htmlFor="name" className="sr-only">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  className="w-full bg-bg-surface border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-0 focus:outline-none text-sm font-body"
                  placeholder="Name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div className="stagger-2 mb-4">
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full bg-bg-surface border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-0 focus:outline-none text-sm font-body"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="stagger-3 mb-6">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                className="w-full bg-bg-surface border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-0 focus:outline-none text-sm font-body"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="stagger-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-accent hover:bg-accent-hover text-bg-base font-semibold rounded-lg px-4 py-3 text-sm font-body transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? isSignUp
                    ? 'Creating account...'
                    : 'Signing in...'
                  : isSignUp
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </div>

            <div className="stagger-5 text-center mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="text-sm text-accent hover:text-accent-hover font-body transition"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Authentication;
