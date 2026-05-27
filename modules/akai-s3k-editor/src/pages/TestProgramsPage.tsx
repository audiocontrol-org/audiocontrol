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
import { ProgramList, KeygroupSummary } from '@/components/programs';
import { ProgramEditor } from '@/components/programs/ProgramEditor';
import { makeProgramHeader } from '@/test-helpers/program-factory';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';
import type { ProgramHeader, KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';

function buildProgramNames(): string[] {
  // 32 program slots — enough to make the list scroll inside its
  // bounded column. Names exercise the full 12-char PRNAME max:
  // "TEST PROGRAM" (12) for slot 1, then a mix of shorter + max-length
  // names so the visual capture covers both the ellipsis-risk worst
  // case and the typical case.
  const names: string[] = ['TEST PROGRAM'];
  for (let i = 1; i < 32; i++) {
    names.push(`TEST PRG ${String(i + 1).padStart(2, '0')}`.padEnd(12));
  }
  return names;
}

function buildKeygroupHeaders(): KeygroupHeader[] {
  return [
    makeKeygroupHeader({
      LONOTE: 21,
      HINOTE: 60,
      LOVEL1: 0,
      HIVEL1: 127,
      SNAME1: 'TEST SMP A  ',
    }),
    makeKeygroupHeader({
      LONOTE: 61,
      HINOTE: 108,
      LOVEL1: 0,
      HIVEL1: 80,
      SNAME1: 'TEST SMP B  ',
      LOVEL2: 81,
      HIVEL2: 127,
      SNAME2: 'TEST SMP C  ',
    }),
  ];
}

export function TestProgramsPage(): JSX.Element {
  const [programNames] = useState<string[]>(buildProgramNames);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [header, setHeader] = useState<ProgramHeader>(() =>
    makeProgramHeader({ PRNAME: 'TEST PROGRAM' }),
  );
  const [keygroups, setKeygroups] = useState<KeygroupHeader[]>(buildKeygroupHeaders);

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

  function handleAddKeygroup(): void {
    setKeygroups((prev) => [
      ...prev,
      makeKeygroupHeader({
        LONOTE: 21,
        HINOTE: 108,
        LOVEL1: 0,
        HIVEL1: 127,
        SNAME1: `TEST SMP ${String.fromCharCode(65 + prev.length)}  `,
      }),
    ]);
  }

  function handleDeleteKeygroup(index: number): void {
    setKeygroups((prev) => prev.filter((_, i) => i !== index));
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
            >
              <KeygroupSummary
                keygroups={keygroups}
                keygroupCount={keygroups.length}
                isLoading={false}
                onAddKeygroup={handleAddKeygroup}
                onDeleteKeygroup={handleDeleteKeygroup}
              />
            </ProgramEditor>
          ) : null}
        </div>
      </div>
    </div>
  );
}
