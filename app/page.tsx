'use client';
import ProtectedRoute from '../components/ProtectedRoute';
import { Layout } from '../components/Layout';
import { Dashboard } from '../components/Dashboard/Dashboard';

export default function HomePage() {
  return (
    <ProtectedRoute>
      <Layout>
        <Dashboard />
      </Layout>
    </ProtectedRoute>
  );
}
