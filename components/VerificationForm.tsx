import React, { useState, FormEvent } from 'react';
import { useAuth } from './AuthContext';

interface VerificationFormProps {
  email: string;
  onBack: () => void;
}

const VerificationForm: React.FC<VerificationFormProps> = ({ email, onBack }) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { verifyCode, error, setError } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await verifyCode(email, code);
      if (!success) {
        setError('Invalid or expired verification code. Please try again.');
      }
    } catch (err) {
      // Error is already set in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full space-y-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Enter Verification Code
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          We've sent a 6-digit code to <span className="font-medium text-indigo-600 dark:text-indigo-400">{email}</span>
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="code" className="sr-only">
            Verification Code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="one-time-code"
            required
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 
                      dark:border-gray-700 dark:bg-gray-900 dark:text-white
                      placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 
                      focus:border-indigo-500 focus:z-10 sm:text-sm text-center tracking-widest text-lg"
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={isSubmitting || code.length !== 6}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent 
                     text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Verifying...' : 'Verify Code'}
          </button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Use a different email
          </button>
        </div>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          <p>Didn't receive a code?</p>
          <button
            type="button"
            onClick={() => onBack()}
            className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
          >
            Try again
          </button>
        </div>
      </form>
    </div>
  );
};

export default VerificationForm; 