/**
 * AUDIT-20260525-25 — every akai editor (ProgramEditor, KeygroupEditor,
 * SampleEditor) must partition its body into the mockup-specified
 * AcRadioTabs panels:
 *
 *   - ProgramEditor: Common / MIDI / Effects / Output  (mockup
 *     `mockups/programs.html:94-105`)
 *   - KeygroupEditor: Zones / Pitch / Filter / Amp / LFO  (mockup
 *     `mockups/keygroups.html:78-91`)
 *   - SampleEditor: Wave / Loop / Trim / Misc  (mockup
 *     `mockups/samples.html:84-95`)
 *
 * Per the agent-discipline "validator-paired changes" rule, this file
 * is the regression-detection net for the tab-structure contract.
 * Pre-AUDIT-25 the live editors flat-stacked every section vertically
 * with no tab navigation; the assertions below would have failed
 * against that codebase (`screen.getByRole('tablist')` would have
 * returned undefined / thrown). Validator-paired hard test (controller
 * runs locally before reporting DONE): revert ONE of the
 * `<AcRadioTabs>` blocks back to a flat stack and confirm the
 * corresponding `it(...)` block FAILS loudly.
 */
import { beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// jsdom doesn't implement Element.prototype.scrollIntoView; the
// KeygroupEditor's embedded VelocityZoneEditor calls it on mount via
// a useEffect on the selected tab. Stub it once at module load so the
// component mounts cleanly without polluting the global env beyond
// this test file.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});
import { ProgramEditor } from '@/components/programs/ProgramEditor';
import { KeygroupEditor } from '@/components/keygroups/KeygroupEditor';
import { SampleEditor } from '@/components/samples/SampleEditor';
import { makeProgramHeader } from '@/test-helpers/program-factory';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';
import { makeSampleHeader } from '@/test-helpers/sample-factory';
import { FULL_RANGE } from '@/components/keygroups/note-coordinate-utils';

interface TabExpectation {
  readonly editor: string;
  readonly labels: readonly string[];
  readonly defaultLabel: string;
}

const PROGRAM_EXPECTATION: TabExpectation = {
  editor: 'ProgramEditor',
  labels: ['Common', 'MIDI', 'Effects', 'Output'],
  defaultLabel: 'Common',
};

const KEYGROUP_EXPECTATION: TabExpectation = {
  editor: 'KeygroupEditor',
  labels: ['Zones', 'Pitch', 'Filter', 'Amp', 'LFO'],
  defaultLabel: 'Zones',
};

const SAMPLE_EXPECTATION: TabExpectation = {
  editor: 'SampleEditor',
  labels: ['Wave', 'Loop', 'Trim', 'Misc'],
  defaultLabel: 'Wave',
};

/**
 * Assert the AcRadioTabs radiogroup contract for a rendered editor.
 *
 * The canonical AcRadioTabs primitive (post-AUDIT-20260524-11 rewrite)
 * exposes `role="radiogroup"` on the container and renders sr-only
 * `<input type="radio">` state-carriers with visible `<label
 * class="ac-radio-tab">` siblings. We assert:
 *
 *   1. exactly one radiogroup container with the expected aria-label;
 *   2. the visible label strip has one `.ac-radio-tab` per expected
 *      tab, in the documented order;
 *   3. exactly one radio is `checked` (the default-active tab) and its
 *      label matches the expected default.
 *
 * Controlled-mode AcRadioTabs renders ONLY the active panel; we also
 * assert the active panel's `.ac-radio-panel` is present in the DOM
 * (it must be exactly one panel — flat-stack regression would have
 * zero or N).
 */
function assertTabStructure(
  container: HTMLElement,
  ariaLabel: string,
  expected: TabExpectation,
): void {
  const radiogroup = container.querySelector(`[role="radiogroup"][aria-label="${ariaLabel}"]`);
  if (!radiogroup) {
    throw new Error(
      `${expected.editor}: missing radiogroup with aria-label="${ariaLabel}". ` +
        `AcRadioTabs is the contract; flat-stacked sections fail this assertion (AUDIT-20260525-25).`,
    );
  }

  // Scope label / radio / panel queries to the OUTER AcRadioTabs only
  // — KeygroupEditor's "Zones" tab embeds VelocityZoneEditor which
  // mounts a NESTED AcRadioTabs (Zone 1/2/3/4). Descendant-combinator
  // queries would mix the inner and outer radio groups. The canonical
  // AcRadioTabs DOM shape is:
  //
  //   <div role="radiogroup">
  //     <input type="radio">...                       (state carriers)
  //     <div class="ac-radio-tab-strip">              (visible label row)
  //       <label class="ac-radio-tab">...
  //     </div>
  //     <div class="ac-radio-panels">                 (panel container)
  //       <section class="ac-radio-panel" data-tab=...>
  //
  // So labels live at `:scope > .ac-radio-tab-strip > .ac-radio-tab`,
  // radios at `:scope > input[type="radio"]`, and panels at
  // `:scope > .ac-radio-panels > .ac-radio-panel`. Each of these is
  // direct-child-only, which excludes the nested zone-selector tabs.
  const labels = Array.from(
    radiogroup.querySelectorAll(':scope > .ac-radio-tab-strip > .ac-radio-tab'),
  );
  const labelTexts = labels.map((el) => el.textContent ?? '');
  expect(labelTexts).toEqual([...expected.labels]);

  const radios = Array.from(
    radiogroup.querySelectorAll(':scope > input[type="radio"]'),
  ) as HTMLInputElement[];
  expect(radios).toHaveLength(expected.labels.length);
  const checked = radios.filter((r) => r.checked);
  expect(checked).toHaveLength(1);
  // The checked radio's aria-label is the visible label (per
  // AcRadioTabs ARIA contract — sr-only radios carry the label text
  // for assistive tech because the visible label is decoration).
  expect(checked[0].getAttribute('aria-label')).toBe(expected.defaultLabel);

  // Controlled-mode renders ONE panel.
  const panels = radiogroup.querySelectorAll(':scope > .ac-radio-panels > .ac-radio-panel');
  expect(panels.length).toBe(1);
}

describe('AUDIT-20260525-25 — akai editors partition their bodies via AcRadioTabs', () => {
  it('ProgramEditor exposes Common/MIDI/Effects/Output tabs with Common active by default', () => {
    const { container } = render(
      <ProgramEditor
        header={makeProgramHeader()}
        programIndex={0}
        onParameterChange={vi.fn()}
      />,
    );
    assertTabStructure(container, 'Program editor sections', PROGRAM_EXPECTATION);
  });

  it('KeygroupEditor exposes Zones/Pitch/Filter/Amp/LFO tabs with Zones active by default', () => {
    const { container } = render(
      <KeygroupEditor
        header={makeKeygroupHeader()}
        keygroupIndex={0}
        keygroupCount={1}
        sampleNames={[]}
        onParameterChange={vi.fn()}
        noteRange={FULL_RANGE}
      />,
    );
    assertTabStructure(container, 'Keygroup editor sections', KEYGROUP_EXPECTATION);
  });

  it('SampleEditor exposes Wave/Loop/Trim/Misc tabs with Wave active by default', () => {
    const { container } = render(
      <SampleEditor
        header={makeSampleHeader()}
        sampleIndex={0}
        sampleCount={1}
        onParameterChange={vi.fn()}
      />,
    );
    assertTabStructure(container, 'Sample editor sections', SAMPLE_EXPECTATION);
  });

  // Validator-teeth self-check: prove the assertions catch a regression.
  // Construct a deliberately-broken "editor" that flat-stacks panels
  // without AcRadioTabs, then assert that assertTabStructure throws
  // when applied to it. This proves the assertion has teeth — if it
  // ever silently passes against a flat-stack regression, this
  // gutted-stub case fails first.
  it('assertTabStructure catches flat-stack regressions (gutted-stub teeth test)', () => {
    const { container } = render(
      <article aria-label="Bad editor" data-testid="bad-editor">
        <div className="ac-detail-body">
          <div>Common content</div>
          <div>MIDI content</div>
        </div>
      </article>,
    );

    expect(() =>
      assertTabStructure(container, 'Program editor sections', PROGRAM_EXPECTATION),
    ).toThrow(/missing radiogroup/);
  });
});
