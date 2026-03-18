import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Authentication from '../components/Authentication';

const LoginPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Sign In - CheatBook</title>
        <meta name="description" content="Sign in to your CheatBook account" />
      </Head>
      <Authentication />
    </>
  );
};

export default LoginPage;
