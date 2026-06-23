'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Layout } from '../../components/Layout';
import { PortalsPage } from '../../components/Portals/PortalsPage';

export default function PortalsRoute() {
  return (
    <ProtectedRoute>
      <Layout>
        <PortalsPage />
      </Layout>
    </ProtectedRoute>
  );
}
