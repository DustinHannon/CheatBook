import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';

const Authentication: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const { isAuthenticated, user, signIn, signUp, error, setError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user) {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <span className="text-text-tertiary font-display text-xl animate-pulse-gold">Redirecting...</span>
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
        setSignUpSuccess(true);
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
            Quick notes for the things you need to remember
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
          Quick notes for the things you need to remember
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 md:w-1/2 flex items-center justify-center bg-bg-base px-6 py-12 md:py-0">
        {signUpSuccess ? (
          <div className="max-w-sm w-full animate-slide-up text-center">
            <div className="w-16 h-16 rounded-full bg-accent-muted flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-display-sm font-display text-text-primary">
              Check your email
            </h2>
            <p className="text-sm text-text-secondary mt-3 font-body leading-relaxed">
              We sent a confirmation link to<br />
              <span className="text-text-primary font-medium">{email}</span>
            </p>
            <p className="text-xs text-text-tertiary mt-4 font-body">
              Click the link in the email to activate your account, then come back here to sign in.
            </p>
            <button
              onClick={() => { setSignUpSuccess(false); setIsSignUp(false); setError(null); }}
              className="mt-8 text-sm text-accent hover:text-accent-hover font-body transition"
            >
              Back to sign in
            </button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default Authentication;
