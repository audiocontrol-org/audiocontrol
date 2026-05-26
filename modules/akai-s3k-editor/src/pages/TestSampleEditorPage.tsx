/**
 * Visual-verification harness for the SampleEditor body.
 *
 * Mounts the REAL `<SampleEditor>` against a factory-generated
 * SampleHeader so the post-AUDIT-25/26 chrome (AcRadioTabs tab
 * partition + .ac-detail-pane wrap + .ac-param-rows + canonical
 * toggle/readout primitives) is reachable for screenshot review
 * without a connected S3000XL device.
 *
 * Distinct from `TestSamplesPage` (the list+detail shell harness for
 * `page-shell-contract.spec.ts`). This one is a focused editor-body
 * capture surface — no list column, just the editor wired to local
 * state.
 */
import { useState } from 'react';
import { PageTitleRow } from '@audiocontrol/editor-core';
import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';
import { SampleEditor } from '@/components/samples/SampleEditor';
import { makeSampleHeader } from '@/test-helpers/sample-factory';

export function TestSampleEditorPage(): JSX.Element {
  const [header, setHeader] = useState<SampleHeader>(() =>
    makeSampleHeader({
      SHNAME: 'TEST SMP 01 ',
      SPITCH: 60,
      SBANDW: 1,
      SSRATE: 44100,
      SLNGTH: 44100,
      SPTYPE: 0,
    }),
  );

  function handleParameterChange(field: string, value: number | string): void {
    setHeader((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      <PageTitleRow
        headingId="test-sample-editor-page-heading"
        headingText="Test Sample Editor (visual harness)"
      />

      <div
        className="ac-detail-scroll"
        aria-labelledby="test-sample-editor-page-heading"
      >
        <SampleEditor
          header={header}
          sampleIndex={2}
          sampleCount={62}
          onParameterChange={handleParameterChange}
        />
      </div>
    </div>
  );
}
