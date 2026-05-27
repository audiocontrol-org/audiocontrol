import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ProgramsPage } from '@/pages/ProgramsPage';
import { KeygroupsPage } from '@/pages/KeygroupsPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { SamplesPage } from '@/pages/SamplesPage';
import { TestKeygroupsPage } from '@/pages/TestKeygroupsPage';
import { TestKeygroupsShellPage } from '@/pages/TestKeygroupsShellPage';
import { TestProgramsPage } from '@/pages/TestProgramsPage';
import { TestSamplesPage } from '@/pages/TestSamplesPage';
import { TestLibraryPage } from '@/pages/TestLibraryPage';
import { TestLibraryRealPage } from '@/pages/TestLibraryRealPage';
import { TestKeygroupEditorPage } from '@/pages/TestKeygroupEditorPage';
import { TestSampleEditorPage } from '@/pages/TestSampleEditorPage';
import { TestLibraryMockedPage } from '@/pages/TestLibraryMockedPage';

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
         *
         * `keygroups-shell` is the separate, shell-compliant Keygroups
         * harness landed alongside AUDIT-20260524-06's closure. The
         * original `test/keygroups` route stays pointing at the
         * inline-styled `TestKeygroupsPage` because `zone-overview.spec.ts`
         * depends on that route.
         *
         * `library-real` mounts the real `PluginLibraryBrowser` (vs
         * `library` which mounts a stub `<div>`) so the contract spec
         * can assert inner-pane overflow ownership — closes
         * AUDIT-20260524-07.
         */}
        <Route path="/akai/s3000xl/editor/test/programs" element={<TestProgramsPage />} />
        <Route path="/akai/s3000xl/editor/test/samples" element={<TestSamplesPage />} />
        <Route path="/akai/s3000xl/editor/test/library" element={<TestLibraryPage />} />
        <Route path="/akai/s3000xl/editor/test/library-real" element={<TestLibraryRealPage />} />
        <Route path="/akai/s3000xl/editor/test/keygroups-shell" element={<TestKeygroupsShellPage />} />
        {/*
         * Editor-body visual-verification harnesses. Each mounts the
         * REAL editor against factory data so screenshot review of the
         * AUDIT-25/26 chrome (AcRadioTabs partition, .ac-detail-pane wrap,
         * .ac-param-rows, pill-radio toggles, readout chrome) is reachable
         * without a connected device. Distinct from the shell-contract
         * harnesses above which mount stub detail content to keep the
         * page-shell-contract measurements stable.
         */}
        <Route path="/akai/s3000xl/editor/test/keygroup-editor" element={<TestKeygroupEditorPage />} />
        <Route path="/akai/s3000xl/editor/test/sample-editor" element={<TestSampleEditorPage />} />
        <Route path="/akai/s3000xl/editor/test/library-mocked" element={<TestLibraryMockedPage />} />
        <Route path="*" element={<Navigate to="/akai/s3000xl/editor/programs" replace />} />
      </Routes>
    </Layout>
  );
}
