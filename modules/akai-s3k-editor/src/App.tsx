import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ProgramsPage } from '@/pages/ProgramsPage';
import { KeygroupsPage } from '@/pages/KeygroupsPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { SamplesPage } from '@/pages/SamplesPage';
import { TestKeygroupsPage } from '@/pages/TestKeygroupsPage';
import { TestProgramsPage } from '@/pages/TestProgramsPage';
import { TestSamplesPage } from '@/pages/TestSamplesPage';
import { TestLibraryPage } from '@/pages/TestLibraryPage';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/akai/s3000xl/editor" element={<Navigate to="/akai/s3000xl/editor/programs" replace />} />
        <Route path="/akai/s3000xl/editor/programs" element={<ProgramsPage />} />
        <Route path="/akai/s3000xl/editor/keygroups" element={<KeygroupsPage />} />
        <Route path="/akai/s3000xl/editor/samples" element={<SamplesPage />} />
        <Route path="/akai/s3000xl/editor/library" element={<LibraryPage />} />
        <Route path="/akai/s3000xl/editor/test/keygroups" element={<TestKeygroupsPage />} />
        {/*
         * Shell-contract test harnesses — close AUDIT-20260524-03 by
         * giving the page-shell-contract.spec.ts measurements an
         * isolated, store-free mount of each list-detail page's
         * production chrome. See the page files for the contract
         * details.
         */}
        <Route path="/akai/s3000xl/editor/test/programs" element={<TestProgramsPage />} />
        <Route path="/akai/s3000xl/editor/test/samples" element={<TestSamplesPage />} />
        <Route path="/akai/s3000xl/editor/test/library" element={<TestLibraryPage />} />
        <Route path="*" element={<Navigate to="/akai/s3000xl/editor/programs" replace />} />
      </Routes>
    </Layout>
  );
}
