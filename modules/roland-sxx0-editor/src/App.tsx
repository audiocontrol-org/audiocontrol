import { useEffect, type ReactElement } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BrokenContextWrapper } from '@audiocontrol/editor-core';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { PlayPage } from '@/pages/PlayPage';
import { PatchesPage } from '@/pages/PatchesPage';
import { TonesPage } from '@/pages/TonesPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { AcEnvelopeTableHarness } from '@/pages/_harness/AcEnvelopeTableHarness';
import { AcRangeBarHarness } from '@/pages/_harness/AcRangeBarHarness';

/**
 * Production routes. Mounted directly in prod builds and wrapped by
 * `BrokenContextWrapper` in dev builds so the Tier 3 in-context
 * credibility check (`tools/check-credibility.ts`) can swap in a
 * broken context via `?context=<variant>` URL param.
 *
 * The `/_harness/*` routes sit inside this same `<Routes>` block but
 * have their own per-route context dispatcher in
 * `src/pages/_harness/url-params.ts` — wrapping `<Routes>` once at the
 * top is benign for them because the URL param is consulted once per
 * navigation. The outer wrapper is a no-op when `?context=` is absent
 * (which is the normal harness-driven Tier 2 flow).
 */
function ProductionRoutes(): ReactElement {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="play" element={<PlayPage />} />
      <Route path="patches" element={<PatchesPage />} />
      <Route path="tones" element={<TonesPage />} />
      <Route path="library" element={<LibraryPage />} />
      {/*
       * Dev-only test harness routes. Production routes never reach here.
       * When the harness count exceeds ~4, factor to a `harnessRoutes`
       * array + `.map()` over the JSX block below.
       */}
      {import.meta.env.DEV && (
        <>
          <Route path="_harness/envelope-table" element={<AcEnvelopeTableHarness />} />
          <Route path="_harness/range-bar" element={<AcRangeBarHarness />} />
        </>
      )}
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}

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
      {import.meta.env.DEV ? (
        <BrokenContextWrapper>
          <ProductionRoutes />
        </BrokenContextWrapper>
      ) : (
        <ProductionRoutes />
      )}
    </Layout>
  );
}
