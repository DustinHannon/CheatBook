import React, { useState } from 'react';
import LoginForm from './LoginForm';
import VerificationForm from './VerificationForm';
import { useAuth } from './AuthContext';

const Authentication: React.FC = () => {
  const [email, setEmail] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const { isAuthenticated, user } = useAuth();

  // If already authenticated, show user info and logout button
  if (isAuthenticated && user) {
    return (
      <div className="max-w-md w-full space-y-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome!</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            You are signed in as <span className="font-medium">{user.email}</span>
          </p>
        </div>
      </div>
    );
  }

  // Handle successful login attempt (code sent)
  const handleLoginSuccess = (emailAddress: string) => {
    setEmail(emailAddress);
    setShowVerification(true);
  };

  // Handle back button from verification
  const handleBack = () => {
    setShowVerification(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      {showVerification ? (
        <VerificationForm email={email} onBack={handleBack} />
      ) : (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};

export default Authentication; 