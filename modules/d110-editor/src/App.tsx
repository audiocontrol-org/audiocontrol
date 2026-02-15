import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { TonesPage } from '@/pages/TonesPage';
import { PatchesPage } from '@/pages/PatchesPage';

export function App(): JSX.Element {
  return (
    <BrowserRouter basename="/roland/d110/editor">
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tones" element={<TonesPage />} />
          <Route path="/patches" element={<PatchesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
