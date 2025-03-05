import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Authentication from '../components/Authentication';
import { AuthProvider } from '../components/AuthContext';

const LoginPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Sign In - CheatBook</title>
        <meta name="description" content="Sign in to your CheatBook account" />
      </Head>
      
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AuthProvider>
          <Authentication />
        </AuthProvider>
      </main>
    </>
  );
};

export default LoginPage; 