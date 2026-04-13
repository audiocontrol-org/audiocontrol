import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ProgramsPage } from '@/pages/ProgramsPage';
import { MultiProgramPage } from '@/pages/MultiProgramPage';
import { KeygroupsPage } from '@/pages/KeygroupsPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { SamplesPage } from '@/pages/SamplesPage';
import { DraggableZonesHarnessPage } from '@/pages/harness/DraggableZonesHarnessPage';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/akai/s3000xl/editor" element={<Navigate to="/akai/s3000xl/editor/programs" replace />} />
        <Route path="/akai/s3000xl/editor/programs" element={<ProgramsPage />} />
        <Route path="/akai/s3000xl/editor/compare" element={<MultiProgramPage />} />
        <Route path="/akai/s3000xl/editor/keygroups" element={<KeygroupsPage />} />
        <Route path="/akai/s3000xl/editor/samples" element={<SamplesPage />} />
        <Route path="/akai/s3000xl/editor/library" element={<LibraryPage />} />
        <Route
          path="/akai/s3000xl/editor/harness/draggable-zones"
          element={<DraggableZonesHarnessPage />}
        />
        <Route path="*" element={<Navigate to="/akai/s3000xl/editor/programs" replace />} />
      </Routes>
    </Layout>
  );
}
