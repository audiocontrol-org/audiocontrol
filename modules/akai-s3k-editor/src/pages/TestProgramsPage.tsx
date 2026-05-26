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
 * Per AUDIT-20260525-25/26 the detail pane mounts the REAL
 * `ProgramEditor` against a factory-generated header so the canonical
 * detail-pane chrome + AcRadioTabs body restructure are reachable for
 * visual verification without a connected device.
 */
import { useState } from 'react';
import { PageTitleRow } from '@audiocontrol/editor-core';
import { ProgramList } from '@/components/programs';
import { ProgramEditor } from '@/components/programs/ProgramEditor';
import { makeProgramHeader } from '@/test-helpers/program-factory';
import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';

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
  const [header, setHeader] = useState<ProgramHeader>(() =>
    makeProgramHeader({ PRNAME: 'TEST PRG 01 ' }),
  );

  function handleParameterChange(field: string, value: number | string): void {
    setHeader((prev) => ({ ...prev, [field]: value }));
  }

  function handleSelect(idx: number | null): void {
    setSelectedIndex(idx);
    if (idx !== null) {
      setHeader(
        makeProgramHeader({
          PRNAME: (programNames[idx] ?? 'TEST').padEnd(12),
        }),
      );
    }
  }

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
          onSelect={handleSelect}
          isLoading={false}
        />

        <div className="ac-detail-scroll">
          {selectedIndex !== null ? (
            <ProgramEditor
              header={header}
              programIndex={selectedIndex}
              onParameterChange={handleParameterChange}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
