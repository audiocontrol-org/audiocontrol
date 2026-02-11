import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';

export function App() {
  return (
    <BrowserRouter basename="/roland/d110/editor">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          {/* Future routes:
          <Route path="tones" element={<TonesPage />} />
          <Route path="patch" element={<PatchPage />} />
          */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
