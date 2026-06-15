'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Layout } from '../../components/Layout';
import { Workspace } from '../../components/Workspace';

export default function NotesPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <Workspace scope="all" />
      </Layout>
    </ProtectedRoute>
  );
}
