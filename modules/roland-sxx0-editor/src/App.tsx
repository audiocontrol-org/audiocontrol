import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { PlayPage } from '@/pages/PlayPage';
import { PatchesPage } from '@/pages/PatchesPage';
import { TonesPage } from '@/pages/TonesPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { AcEnvelopeTableHarness } from '@/pages/_harness/AcEnvelopeTableHarness';
import { AcRangeBarHarness } from '@/pages/_harness/AcRangeBarHarness';
export function App() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import('@/mock/mockMode').then(({ isMockMidiMode }) => {
      if (!isMockMidiMode()) return;
      import('@/mock/mockState').then(({ seedS330MockState }) => {
        seedS330MockState();
      });
    });
  }, []);

  return (
    <Layout>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="play" element={<PlayPage />} />
        <Route path="patches" element={<PatchesPage />} />
        <Route path="tones" element={<TonesPage />} />
        <Route path="library" element={<LibraryPage />} />
        {/* Dev-only test harness routes. Production routes never reach here. */}
        {import.meta.env.DEV && (
          <>
            <Route path="_harness/envelope-table" element={<AcEnvelopeTableHarness />} />
            <Route path="_harness/range-bar" element={<AcRangeBarHarness />} />
          </>
        )}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </Layout>
  );
}
