'use client';
import { useParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { Layout } from '../../../components/Layout';
import { Workspace } from '../../../components/Workspace';

export default function NoteDetailPage() {
  const params = useParams();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : typeof raw === 'string' ? raw : undefined;
  return (
    <ProtectedRoute>
      <Layout>
        <Workspace scope="all" selectedNoteId={id} />
      </Layout>
    </ProtectedRoute>
  );
}
