import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { PlayPage } from '@/pages/PlayPage';
import { ProgramPage } from '@/pages/ProgramPage';
import { LibraryPage } from '@/pages/LibraryPage';

export function App(): JSX.Element {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PlayPage />} />
        <Route path="/program" element={<ProgramPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
