/**
 * Test harness for the Samples page chrome contract — closes
 * AUDIT-20260524-03. See TestProgramsPage.tsx for the harness
 * rationale and shell contract; this page mirrors the production
 * SamplesPage shell (same `.ac-page-shell--fixed-viewport` +
 * `.ac-app-shell` + `SampleList` + `.ac-detail-scroll`) with
 * factory data and stub callbacks.
 */
import { useState } from 'react';
import { PageTitleRow } from '@audiocontrol/editor-core';
import { SampleList } from '@/components/samples';

function buildSampleNames(): string[] {
  // 48 sample slots — more than fits in the bounded column so the
  // contract spec can scroll inside `.ac-list-scroll` to verify the
  // mobile escape hatch reaches the last row.
  return Array.from({ length: 48 }, (_, i) =>
    `TEST SMP ${String(i + 1).padStart(2, '0')}`.padEnd(12),
  );
}

export function TestSamplesPage(): JSX.Element {
  const [sampleNames] = useState<string[]>(buildSampleNames);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);

  const selectedName = selectedIndex !== null ? sampleNames[selectedIndex] : null;

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      <PageTitleRow
        headingId="test-samples-page-heading"
        headingText="Test Samples (harness)"
      />

      <div className="ac-app-shell" aria-labelledby="test-samples-page-heading">
        <SampleList
          sampleNames={sampleNames}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          isLoading={false}
        />

        <div className="ac-detail-scroll">
          <p className="text-gray-300">
            Test detail pane — selected sample: {selectedName?.trim() ?? '(none)'}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            This harness exercises the fixed-viewport shell contract for
            the Samples page (list + detail). The production page
            renders the same scaffold around a real `SampleEditor`
            plus editor-dialog launchers.
          </p>
        </div>
      </div>
    </div>
  );
}
