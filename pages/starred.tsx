import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import { Layout } from '../components/Layout';
import { Workspace } from '../components/Workspace';

export default function StarredPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <Workspace scope="starred" />
      </Layout>
    </ProtectedRoute>
  );
}
