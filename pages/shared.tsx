import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import { Layout } from '../components/Layout';
import { Workspace } from '../components/Workspace';

export default function SharedPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <Workspace scope="shared" />
      </Layout>
    </ProtectedRoute>
  );
}
