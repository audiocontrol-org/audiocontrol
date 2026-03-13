import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { PlayPage } from '@/pages/PlayPage';
import { PatchesPage } from '@/pages/PatchesPage';
import { TonesPage } from '@/pages/TonesPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { isMockMidiMode } from '@/mock/mockMode';
import { seedS330MockState } from '@/mock/mockState';

export function App() {
  useEffect(() => {
    if (!isMockMidiMode()) return;
    seedS330MockState();
  }, []);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/patches" element={<PatchesPage />} />
        <Route path="/tones" element={<TonesPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
