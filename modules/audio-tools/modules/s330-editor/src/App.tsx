import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { PlayPage } from '@/pages/PlayPage';
import { PatchesPage } from '@/pages/PatchesPage';
import { TonesPage } from '@/pages/TonesPage';
import { SamplingPage } from '@/pages/SamplingPage';
import { LibraryPage } from '@/pages/LibraryPage';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/patches" element={<PatchesPage />} />
        <Route path="/tones" element={<TonesPage />} />
        <Route path="/sampling" element={<SamplingPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
