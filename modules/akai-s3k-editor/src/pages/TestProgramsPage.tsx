/**
 * Test harness for the Programs page chrome contract — closes
 * AUDIT-20260524-03. Mirrors the production ProgramsPage shell
 * (`.ac-page-shell--fixed-viewport` + `PageTitleRow` + `.ac-app-shell`
 * + `ProgramList` + `.ac-detail-scroll`) using factory data + stub
 * callbacks so the page-shell / app-shell / list-scroll contract is
 * reachable without device wiring, store hydration, or a MIDI
 * connection. The contract spec at
 * `test/ui/page-shell-contract.spec.ts` measures this harness
 * (alongside TestSamplesPage / TestLibraryPage) at desktop and
 * mobile viewports.
 *
 * The detail pane intentionally renders a stub `<div>` rather than
 * the production `ProgramEditor` — the contract under test is the
 * SHELL geometry, not the editor content. Keeping detail content
 * minimal also means the harness boots in <100ms and the Playwright
 * spec doesn't need to wait on store/effect plumbing.
 */
import { useState } from 'react';
import { PageTitleRow } from '@audiocontrol/editor-core';
import { ProgramList } from '@/components/programs';

function buildProgramNames(): string[] {
  // 32 program slots — enough to make the list scroll inside its
  // bounded column, which is the point of the harness.
  return Array.from({ length: 32 }, (_, i) =>
    `TEST PRG ${String(i + 1).padStart(2, '0')}`.padEnd(12),
  );
}

export function TestProgramsPage(): JSX.Element {
  const [programNames] = useState<string[]>(buildProgramNames);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);

  const selectedName = selectedIndex !== null ? programNames[selectedIndex] : null;

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      <PageTitleRow
        headingId="test-programs-page-heading"
        headingText="Test Programs (harness)"
      />

      <div className="ac-app-shell" aria-labelledby="test-programs-page-heading">
        <ProgramList
          programNames={programNames}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          isLoading={false}
        />

        <div className="ac-detail-scroll">
          <p className="text-gray-300">
            Test detail pane — selected program: {selectedName?.trim() ?? '(none)'}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            This harness exercises the fixed-viewport shell contract for
            the Programs page (list + detail). The production page
            renders the same `.ac-page-shell--fixed-viewport` +
            `.ac-app-shell` + `.ac-detail-scroll` scaffold around a
            real `ProgramEditor`.
          </p>
        </div>
      </div>
    </div>
  );
}
