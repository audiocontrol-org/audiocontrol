/**
 * Visual-verification harness for the KeygroupEditor body.
 *
 * Mounts the REAL `<KeygroupEditor>` against a factory-generated
 * KeygroupHeader so the post-AUDIT-25/26 chrome (AcRadioTabs tab
 * partition + .ac-detail-pane wrap + .ac-param-rows + canonical
 * toggle/readout primitives) is reachable for screenshot review
 * without a connected S3000XL device or the page-shell-contract
 * dependencies that `TestKeygroupsShellPage` carries.
 *
 * Distinct from `TestKeygroupsShellPage` (the shell-geometry harness
 * with 20 synthetic rows for `page-shell-contract.spec.ts`) and from
 * `TestKeygroupsPage` (the zone-overview interaction harness with
 * inline-styled dark chrome for `zone-overview.spec.ts`). This one is
 * a focused editor-body capture surface — no list column, no zone
 * overview, just the editor wired to local state.
 */
import { useState } from 'react';
import { PageTitleRow } from '@audiocontrol/editor-core';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { KeygroupEditor } from '@/components/keygroups/KeygroupEditor';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';
import { FULL_RANGE } from '@/components/keygroups/note-coordinate-utils';

function buildSampleNames(): string[] {
  return Array.from({ length: 16 }, (_, i) =>
    `TEST SMP ${String(i + 1).padStart(2, '0')}`.padEnd(12),
  );
}

export function TestKeygroupEditorPage(): JSX.Element {
  const [header, setHeader] = useState<KeygroupHeader>(() =>
    makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 59,
      LOVEL1: 0,
      HIVEL1: 80,
      SNAME1: 'TEST SMP 01 ',
      LOVEL2: 81,
      HIVEL2: 127,
      SNAME2: 'TEST SMP 02 ',
    }),
  );

  function handleParameterChange(field: string, value: number | string): void {
    setHeader((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      <PageTitleRow
        headingId="test-keygroup-editor-page-heading"
        headingText="Test Keygroup Editor (visual harness)"
      />

      <div
        className="ac-detail-scroll"
        aria-labelledby="test-keygroup-editor-page-heading"
      >
        <KeygroupEditor
          header={header}
          keygroupIndex={2}
          keygroupCount={11}
          sampleNames={buildSampleNames()}
          onParameterChange={handleParameterChange}
          noteRange={FULL_RANGE}
        />
      </div>
    </div>
  );
}
