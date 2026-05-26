/**
 * AUDIT-20260525-26 — every akai editor (ProgramEditor, KeygroupEditor,
 * SampleEditor) must wrap its content in the canonical
 *
 *   <article class="ac-detail-pane" aria-label data-testid>
 *     <header class="ac-detail-head">
 *       <div class="ac-detail-eyebrow-row">…</div>
 *       <h3 class="ac-detail-title"><span class="ac-detail-slot">…</span><input class="ac-detail-name-input" /></h3>
 *     </header>
 *     <div class="ac-detail-body">…</div>
 *   </article>
 *
 * chrome (canonical primitive CSS in
 * modules/editor-core/src/design/detail-pane-primitives.css, promoted
 * from roland-sxx0-editor 2026-05-25 per AUDIT-20260525-26). This file
 * is the regression-detection net for the chrome contract — it would
 * have failed against the pre-AUDIT-26 codebase (which rendered the
 * editor body with no .ac-detail-pane wrapper, leaving the title
 * floating outside the panel border).
 *
 * Per the agent-discipline "validator-paired changes" rule + the
 * "ARIA + interaction-timing audit" entry in the primitive-extraction
 * checklist, this test has teeth: it asserts the exact shape the brief
 * required, so a future regression that drops the wrapping chrome
 * fails loudly.
 */
import { beforeAll, describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// jsdom doesn't implement Element.prototype.scrollIntoView; the
// VelocityZoneEditor inside KeygroupEditor calls it on mount via a
// useEffect on the selected tab. Stub it once at module load so the
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
import { makeSampleHeader } from '@/test-helpers/sample-factory';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';
import { makeProgramHeader } from '@/test-helpers/program-factory';
import { FULL_RANGE } from '@/components/keygroups/note-coordinate-utils';

describe('AUDIT-20260525-26 — akai editors wrap in canonical .ac-detail-pane chrome', () => {
  describe('ProgramEditor', () => {
    it('wraps content in <article.ac-detail-pane> with eyebrow + slot + name input inside .ac-detail-head', () => {
      const { container } = render(
        <ProgramEditor
          header={makeProgramHeader({ PRNAME: 'MY PROGRAM  ' })}
          programIndex={2}
          onParameterChange={vi.fn()}
        />,
      );

      const pane = container.querySelector('article.ac-detail-pane');
      expect(pane).not.toBeNull();
      expect(pane?.getAttribute('aria-label')).toBe('Program editor');
      expect(pane?.getAttribute('data-testid')).toBe('program-detail');

      const head = pane?.querySelector(':scope > header.ac-detail-head');
      const body = pane?.querySelector(':scope > .ac-detail-body');
      expect(head).not.toBeNull();
      expect(body).not.toBeNull();

      const eyebrow = head?.querySelector('.ac-detail-eyebrow-row');
      expect(eyebrow).not.toBeNull();
      expect(eyebrow?.textContent).toContain('Program');
      expect(eyebrow?.textContent).toContain('Editing');
      expect(eyebrow?.textContent).toContain('S3000XL');

      // Slot reads as zero-padded 2-digit decimal (programIndex+1).
      const slot = head?.querySelector('.ac-detail-slot');
      expect(slot?.textContent).toBe('03');

      // Name input is the canonical .ac-detail-name-input affordance.
      const nameInput = head?.querySelector('input.ac-detail-name-input');
      expect(nameInput).not.toBeNull();
      expect((nameInput as HTMLInputElement).value).toBe('MY PROGRAM  ');
    });
  });

  describe('KeygroupEditor', () => {
    it('wraps content in <article.ac-detail-pane> with N-of-M eyebrow + KG slot + range-label input', () => {
      const { container } = render(
        <KeygroupEditor
          header={makeKeygroupHeader({ LONOTE: 36, HINOTE: 48 })}
          keygroupIndex={2}
          keygroupCount={11}
          sampleNames={[]}
          onParameterChange={vi.fn()}
          noteRange={FULL_RANGE}
        />,
      );

      const pane = container.querySelector('article.ac-detail-pane');
      expect(pane).not.toBeNull();
      expect(pane?.getAttribute('aria-label')).toBe('Keygroup editor');
      expect(pane?.getAttribute('data-testid')).toBe('keygroup-detail');

      const head = pane?.querySelector(':scope > header.ac-detail-head');
      const body = pane?.querySelector(':scope > .ac-detail-body');
      expect(head).not.toBeNull();
      expect(body).not.toBeNull();

      const eyebrow = head?.querySelector('.ac-detail-eyebrow-row');
      expect(eyebrow?.textContent).toContain('Keygroup');
      expect(eyebrow?.textContent).toContain('Editing');
      expect(eyebrow?.textContent).toContain('3 of 11');

      // Slot reads as KG<index+1>.
      const slot = head?.querySelector('.ac-detail-slot');
      expect(slot?.textContent).toBe('KG3');

      // Range-as-name input is read-only (the editable note bounds
      // live in the Note Range section in the body).
      const nameInput = head?.querySelector('input.ac-detail-name-input');
      expect(nameInput).not.toBeNull();
      expect((nameInput as HTMLInputElement).readOnly).toBe(true);
    });
  });

  describe('SampleEditor', () => {
    it('wraps content in <article.ac-detail-pane> with 3-digit slot + rate/size/duration eyebrow', () => {
      const { container } = render(
        <SampleEditor
          header={makeSampleHeader({
            SHNAME: 'HAT_CL_SOFT ',
            SSRATE: 22050,
            SLNGTH: 20000,
          })}
          sampleIndex={2}
          sampleCount={62}
          onParameterChange={vi.fn()}
        />,
      );

      const pane = container.querySelector('article.ac-detail-pane');
      expect(pane).not.toBeNull();
      expect(pane?.getAttribute('aria-label')).toBe('Sample editor');
      expect(pane?.getAttribute('data-testid')).toBe('sample-detail');

      const head = pane?.querySelector(':scope > header.ac-detail-head');
      const body = pane?.querySelector(':scope > .ac-detail-body');
      expect(head).not.toBeNull();
      expect(body).not.toBeNull();

      const eyebrow = head?.querySelector('.ac-detail-eyebrow-row');
      expect(eyebrow?.textContent).toContain('Sample');
      expect(eyebrow?.textContent).toContain('Editing');
      expect(eyebrow?.textContent).toContain('003 of 062');
      expect(eyebrow?.textContent).toContain('22050 Hz');

      // Slot reads as zero-padded 3-digit decimal (sampleIndex+1).
      const slot = head?.querySelector('.ac-detail-slot');
      expect(slot?.textContent).toBe('003');

      // Name input carries the SHNAME value, editable.
      const nameInput = head?.querySelector('input.ac-detail-name-input');
      expect(nameInput).not.toBeNull();
      expect((nameInput as HTMLInputElement).value).toBe('HAT_CL_SOFT ');
    });
  });
});
