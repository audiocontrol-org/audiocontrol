/**
 * Test harness for the Keygroups page chrome contract — closes
 * AUDIT-20260524-06 (the gap left open by AUDIT-20260524-05's first
 * pass) and AUDIT-20260524-08 (detail-scroll ownership under
 * contentful pressure). The pre-existing `TestKeygroupsPage` at
 * `/akai/s3000xl/editor/test/keygroups` is the inline-styled
 * zone-overview interaction harness load-bearing for
 * `zone-overview.spec.ts`; this file is the SEPARATE shell-compliant
 * harness mounted at `/akai/s3000xl/editor/test/keygroups-shell` so
 * `page-shell-contract.spec.ts` can extend coverage to the page
 * with the most structurally distinct layout (zone-overview toolbar
 * + overview block ahead of the canonical 2-col app shell).
 *
 * Mirrors the production `KeygroupsPage` shell:
 *
 *   .ac-page-shell--fixed-viewport
 *     PageTitleRow
 *     ZoneOverviewToolbar
 *     ZoneOverview
 *     .ac-app-shell
 *       KeygroupList (real component, factory data)
 *       .ac-detail-scroll (20 stacked param rows — overflow pressure)
 *
 * The detail pane renders 20 stacked synthetic param rows (min-height
 * 80px each → ~1600px content) so the AUDIT-20260524-08 contentful
 * detail-scroll assertion can observe `scrollHeight > clientHeight`
 * and prove the last row is reachable via `scrollIntoView()` without
 * the document leaking scroll. Each row carries
 * `data-testid="kg-detail-row-<index>"` so the spec can address the
 * last row deterministically.
 *
 * See `TestProgramsPage.tsx` for the composition pattern; this file
 * follows the same factory-data + local-state shape so the contract
 * spec doesn't need a device / store hydration / MIDI server.
 */
import { useState, useCallback } from 'react';
import { PageTitleRow } from '@audiocontrol/editor-core';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { KeygroupList } from '@/components/keygroups';
import { ZoneOverview } from '@/components/keygroups/ZoneOverview';
import { ZoneOverviewToolbar } from '@/components/keygroups/ZoneOverviewToolbar';
import { FULL_RANGE } from '@/components/keygroups/note-coordinate-utils';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';

function buildInitialKeygroups(): KeygroupHeader[] {
  // 16 keygroups — enough to make the KeygroupList scroll inside its
  // bounded column on desktop AND have a reachable last-row to
  // exercise the mobile escape-hatch assertion.
  return Array.from({ length: 16 }, (_, i) =>
    makeKeygroupHeader({
      LONOTE: 24 + i * 4,
      HINOTE: Math.min(127, 36 + i * 4),
      LOVEL1: 0,
      HIVEL1: 127,
      SNAME1: `KG ${String(i + 1).padStart(2, '0')}      `,
    }),
  );
}

export function TestKeygroupsShellPage(): JSX.Element {
  const [keygroups, setKeygroups] = useState<KeygroupHeader[]>(
    buildInitialKeygroups,
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [noteRange, setNoteRange] = useState<NoteRange>(FULL_RANGE);

  // No-op handlers — the contract under test is shell geometry, not
  // zone editing. The real components are mounted (matching the
  // production shell) but their writes go nowhere.
  const handleZoneDrag = useCallback(
    (kgIndex: number, field: string, value: number) => {
      setKeygroups((prev) => {
        const next = [...prev];
        next[kgIndex] = { ...next[kgIndex], [field]: value };
        return next;
      });
    },
    [],
  );

  const selectedHeader =
    selectedIndex !== null ? keygroups[selectedIndex] : undefined;

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      <PageTitleRow
        headingId="test-keygroups-shell-page-heading"
        headingText="Test Keygroups (harness)"
      />

      <ZoneOverviewToolbar
        noteRange={noteRange}
        onNoteRangeChange={setNoteRange}
        keygroups={keygroups}
        keygroupCount={keygroups.length}
      />
      <ZoneOverview
        keygroups={keygroups}
        keygroupCount={keygroups.length}
        selectedKeygroupIndex={selectedIndex}
        onSelectKeygroup={setSelectedIndex}
        noteRange={noteRange}
        onZoneDrag={handleZoneDrag}
        onZoneCommit={handleZoneDrag}
        onCreateZone={() => { /* no-op for shell harness */ }}
        onNoteRangeChange={setNoteRange}
      />

      <div
        className="ac-app-shell"
        aria-labelledby="test-keygroups-shell-page-heading"
      >
        <KeygroupList
          keygroups={keygroups}
          keygroupCount={keygroups.length}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          isLoading={false}
        />

        <div className="ac-detail-scroll" data-testid="kg-detail-scroll">
          <p className="text-gray-300">
            Test detail pane — selected keygroup:{' '}
            {selectedHeader
              ? `${selectedHeader.SNAME1.trim()} (notes ${selectedHeader.LONOTE}-${selectedHeader.HINOTE})`
              : '(none)'}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            This harness exercises the fixed-viewport shell contract for
            the Keygroups page (ZoneOverviewToolbar + ZoneOverview +
            list + detail). The production page renders the same
            scaffold around a real `KeygroupEditor`.
          </p>

          {/*
            Twenty synthetic param rows force the detail pane past one
            viewport height (~1600px content at min-height: 80px each).
            The contract spec asserts `.ac-detail-scroll` owns the
            internal scroll: scrollHeight > clientHeight, the last row
            is reachable via scrollIntoView, and the document never
            grows beyond innerHeight. Closes AUDIT-20260524-08.
          */}
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              data-testid={`kg-detail-row-${i}`}
              style={{ minHeight: '80px', borderTop: '1px solid #374151', padding: '0.5rem 0' }}
            >
              <span className="text-gray-400 text-sm">
                Param row {String(i + 1).padStart(2, '0')} (synthetic)
              </span>
              <span className="text-gray-300 ml-3">
                value: {(i + 1) * 7}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
