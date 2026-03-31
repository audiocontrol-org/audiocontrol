import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { ProgramsPage } from '@/pages/ProgramsPage';
import { KeygroupsPage } from '@/pages/KeygroupsPage';
import { LibraryPage } from '@/pages/LibraryPage';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/akai/s3000xl/editor" element={<HomePage />} />
        <Route path="/akai/s3000xl/editor/programs" element={<ProgramsPage />} />
        <Route path="/akai/s3000xl/editor/keygroups" element={<KeygroupsPage />} />
        <Route path="/akai/s3000xl/editor/library" element={<LibraryPage />} />
        <Route path="*" element={<Navigate to="/akai/s3000xl/editor" replace />} />
      </Routes>
    </Layout>
  );
}
