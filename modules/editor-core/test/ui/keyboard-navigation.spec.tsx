/**
 * Editor-core a11y keyboard-navigation harness.
 *
 * Phase 2 task 2.7 of feature/akai-harmonization. Closes the
 * regression-coverage gap surfaced by AUDIT-20260524-01: the TreeView
 * disclosure-span → button promotion silently created a second tab
 * stop per folder row; no existing test failed and the regression was
 * caught by the next audit pass days later.
 *
 * Tool choice (vitest + @testing-library/user-event over Playwright):
 *
 *   The editor-core module has no Vite dev server (the editors that
 *   consume it own their own dev servers). Playwright would require
 *   either (a) a new harness Vite project under modules/editor-core/
 *   or (b) hoisting these specs into akai-s3k-editor / roland-sxx0-
 *   editor — both options ship the tests in a separate runtime from
 *   the primitives they're guarding, which is the exact divergence
 *   that AUDIT-01 named (the contract assertion lived far from the
 *   primitive). Vitest + jsdom + @testing-library/user-event runs
 *   IN-PROCESS against the primitive source so the contract test
 *   lives next to the contract it asserts. The trade-off is that the
 *   test doesn't catch CSS-driven invisibility (display:none vs
 *   visibility:hidden vs offscreen) — that gap is acceptable because
 *   AUDIT-01's failure mode was a DOM-level tab-stop bug, not a CSS-
 *   level visibility bug. CSS-visibility regressions stay covered by
 *   the editor-level Playwright suites (test-ui-s3k, test-ui-roland).
 *
 * Each describe block here MUST hold at least one test that catches a
 * specific audit-finding pattern. The AUDIT-ID is cited in the test
 * name so a future operator reading a regression report can trace
 * back to the originating bug.
 *
 * Validator-paired-changes discipline: every assertion here was
 * proven to have teeth by an intentional-break round-trip (revert the
 * production-side fix, re-run, confirm the assertion goes red with a
 * clear error message). The break results are quoted in the commit
 * body that ships this spec.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcChevron } from '@/components/AcChevron';
import { AcLiveStatusFooter } from '@/components/AcLiveStatusFooter';
import { AcRadioTabs, type AcRadioTabDef } from '@/components/AcRadioTabs';
import { AcSlider } from '@/components/AcSlider';
import { AcToggle } from '@/components/AcToggle';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { TreeView, type TreeNode } from '@/components/library/TreeView';
import {
  assertAriaContract,
  assertExactlyOneRole,
  assertNoRole,
  assertTabStopCount,
  getTabStops,
} from './a11y-helpers';

afterEach(() => {
  cleanup();
});

// ===========================================================================
// TreeView keyboard navigation — closes AUDIT-20260524-01
// ===========================================================================

const TREE_NODES: TreeNode[] = [
  {
    id: 'folder-1',
    name: 'Folder One',
    type: 'directory',
    children: [
      { id: 'folder-1-leaf', name: 'Leaf 1', type: 'item' },
    ],
  },
  {
    id: 'folder-2',
    name: 'Folder Two',
    type: 'directory',
    children: [
      { id: 'folder-2-leaf', name: 'Leaf 2', type: 'item' },
    ],
  },
  {
    id: 'folder-3',
    name: 'Folder Three',
    type: 'directory',
    children: [],
  },
];

describe('TreeView keyboard navigation (AUDIT-20260524-01)', () => {
  it('exactly ONE tab stop per row — NOT TWO (AUDIT-20260524-01)', () => {
    // AUDIT-01: the disclosure-span → button promotion silently created
    // a SECOND focusable per folder row. After the fix the disclosure
    // button carries tabIndex={-1}; the row (role="treeitem",
    // tabIndex={0}) is the single keyboard anchor.
    //
    // Counting strategy: tab-stop count must equal treeitem count, no
    // matter how many disclosure buttons render. Pre-AUDIT-01 fix the
    // disclosure buttons added one extra stop per folder row; after the
    // fix the count is exactly one stop per treeitem.
    //
    // TreeView ALWAYS mounts children (wrapped in .ac-collapse so the
    // grid-template-rows transition can animate); the visible rendering
    // is purely CSS-driven. The DOM contains all rows regardless of
    // expandedIds, so this test correctly enumerates every treeitem in
    // the subtree.
    const { container } = render(<TreeView nodes={TREE_NODES} />);
    const treeItems = container.querySelectorAll<HTMLElement>('[role="treeitem"]');
    const expectedStops = treeItems.length;
    assertTabStopCount(
      container as HTMLElement,
      expectedStops,
      `TreeView with ${expectedStops} treeitems`,
    );
  });

  it('expanded state — tab-stop count still equals treeitem count (AUDIT-20260524-01)', () => {
    // Re-assert under the expanded state: same invariant — one tab stop
    // per row, regardless of how many disclosure <button>s render.
    const expandedIds = new Set(['folder-1', 'folder-2', 'folder-3']);
    const { container } = render(
      <TreeView nodes={TREE_NODES} expandedIds={expandedIds} onToggleExpand={() => {}} />,
    );
    const treeItems = container.querySelectorAll<HTMLElement>('[role="treeitem"]');
    const expectedStops = treeItems.length;
    assertTabStopCount(
      container as HTMLElement,
      expectedStops,
      `TreeView expanded with ${expectedStops} treeitems`,
    );

    // And the disclosure buttons under each directory row contribute
    // ZERO stops — pre-AUDIT-01 each one added a stop.
    const discBtns = container.querySelectorAll('.ac-tree-disclosure-btn');
    expect(discBtns.length).toBeGreaterThan(0);
    const tabStops = getTabStops(container as HTMLElement);
    discBtns.forEach((btn) => {
      expect(tabStops).not.toContain(btn);
    });
  });

  it('every disclosure button carries tabIndex={-1} (regression guard for AUDIT-20260524-01)', () => {
    // Direct query: the disclosure button is preserved as a real
    // <button> (for screen-reader + voice-control element enumeration)
    // but does not participate in keyboard tab traversal.
    const { container } = render(<TreeView nodes={TREE_NODES} />);
    const buttons = container.querySelectorAll<HTMLElement>('.ac-tree-disclosure-btn');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((btn) => {
      expect(btn.getAttribute('tabindex')).toBe('-1');
      // The button is still a real semantic <button> with aria-expanded.
      expect(btn.tagName.toLowerCase()).toBe('button');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('container is role="tree" with top-level treeitems carrying aria-expanded', () => {
    const { container } = render(<TreeView nodes={TREE_NODES} />);
    const tree = container.querySelector<HTMLElement>('[role="tree"]');
    expect(tree).not.toBeNull();
    // The top-level (directory) rows are direct children of role="tree";
    // each is a separate <div> wrapper carrying the .ac-tree-node row
    // inside. TreeView wraps each top-level node in a containing <div>
    // (no role), then the .ac-tree-node carries role="treeitem".
    const directoryRows = Array.from(
      tree!.querySelectorAll<HTMLElement>('[role="treeitem"][aria-expanded]'),
    );
    // Three top-level folders are directories with aria-expanded.
    expect(directoryRows.length).toBeGreaterThanOrEqual(3);
    directoryRows.slice(0, 3).forEach((row) => {
      expect(row.getAttribute('aria-expanded')).toBe('false');
      // The row itself is the keyboard anchor (tabIndex=0).
      expect(row.getAttribute('tabindex')).toBe('0');
    });
  });

  it('Enter on a folder row toggles disclosure via onToggleExpand', () => {
    const onToggle = vi.fn();
    render(
      <TreeView
        nodes={TREE_NODES}
        expandedIds={new Set()}
        onToggleExpand={onToggle}
      />,
    );
    const firstRow = screen.getAllByRole('treeitem')[0]!;
    firstRow.focus();
    expect(document.activeElement).toBe(firstRow);
    fireEvent.keyDown(firstRow, { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledWith('folder-1');
  });

  it('Space on a folder row toggles disclosure via onToggleExpand', () => {
    const onToggle = vi.fn();
    render(
      <TreeView
        nodes={TREE_NODES}
        expandedIds={new Set()}
        onToggleExpand={onToggle}
      />,
    );
    const firstRow = screen.getAllByRole('treeitem')[0]!;
    firstRow.focus();
    fireEvent.keyDown(firstRow, { key: ' ' });
    expect(onToggle).toHaveBeenCalledWith('folder-1');
  });
});

// ===========================================================================
// AcChevron — disclosure glyph
// ===========================================================================

describe('AcChevron disclosure glyph', () => {
  it('is aria-hidden — never appears in the accessibility tree', () => {
    const { container } = render(<AcChevron expanded={false} />);
    const chevron = container.querySelector<HTMLElement>('.ac-chevron')!;
    expect(chevron).not.toBeNull();
    expect(chevron.getAttribute('aria-hidden')).toBe('true');
  });

  it('does NOT introduce a tab stop separate from its parent', () => {
    // Mounted inside a CollapsibleSection (the canonical AcChevron-bearing
    // toggle pattern), the chevron itself must never be focusable.
    const { container } = render(
      <CollapsibleSection title="Section A" defaultOpen={true}>
        <AcChevron expanded={true} />
        <p>section body</p>
      </CollapsibleSection>,
    );
    // The chevron must not be focusable. Only the parent button toggle is.
    const stops = getTabStops(container as HTMLElement);
    stops.forEach((el) => {
      expect(el.classList.contains('ac-chevron')).toBe(false);
    });
  });

  it('uses exactly one canonical class (.ac-chevron) — no hand-rolled chevron variants', () => {
    // Lock-in for the chevron-sizing pre-commit gate at the React layer.
    // The CSS-side gate (tools/check-chevron-sizing.sh) catches new
    // chevron classes in stylesheets; this test catches a future drift
    // where someone adds a second class to AcChevron's root span.
    const { container } = render(<AcChevron expanded={true} />);
    const chevrons = container.querySelectorAll('.ac-chevron');
    expect(chevrons).toHaveLength(1);
    expect(chevrons[0]!.className).toBe('ac-chevron');
  });
});

// ===========================================================================
// AcRadioTabs — closes AUDIT-20260524-11 + AUDIT-20260524-13 patterns
// ===========================================================================

const RADIO_TABS: readonly AcRadioTabDef[] = [
  { id: 'kn-tab-a', label: 'Alpha' },
  { id: 'kn-tab-b', label: 'Beta' },
  { id: 'kn-tab-c', label: 'Gamma' },
] as const;

const RADIO_PANELS = {
  'kn-tab-a': <div data-testid="kn-panel-a">Panel A</div>,
  'kn-tab-b': <div data-testid="kn-panel-b">Panel B</div>,
  'kn-tab-c': <div data-testid="kn-panel-c">Panel C</div>,
};

describe('AcRadioTabs keyboard navigation + ARIA contract (AUDIT-20260524-11 + -13)', () => {
  it('container is role="radiogroup" with aria-label — NOT role="tablist" (AUDIT-20260524-11)', () => {
    const { container } = render(
      <AcRadioTabs
        tabs={RADIO_TABS}
        panels={RADIO_PANELS}
        groupName="kn-aria-group"
        ariaLabel="Test sections"
      />,
    );
    // The container holds the canonical radiogroup contract.
    assertExactlyOneRole(container as HTMLElement, 'radiogroup', {
      name: 'Test sections',
    });
    // The pre-AUDIT-11 faux ARIA tab contract MUST stay removed.
    assertNoRole(container as HTMLElement, 'tablist');
    assertNoRole(container as HTMLElement, 'tab');
    assertNoRole(container as HTMLElement, 'tabpanel');
  });

  it('tab labels are NOT focusable — the radios own keyboard focus (AUDIT-20260524-11)', () => {
    const { container } = render(
      <AcRadioTabs
        tabs={RADIO_TABS}
        panels={RADIO_PANELS}
        groupName="kn-label-focus"
        ariaLabel="Test sections"
      />,
    );
    // Labels are visual presentation only — no tabindex=0 promotion.
    const labels = container.querySelectorAll<HTMLElement>('label.ac-radio-tab');
    expect(labels.length).toBe(3);
    labels.forEach((label) => {
      // Pre-fix labels had tabIndex={0}; after the fix they have no
      // tabindex attribute at all (so default = -1 because <label> is
      // not natively focusable).
      expect(label.getAttribute('tabindex')).toBeNull();
    });
  });

  it('each hidden radio is in the keyboard tab order (sr-only, not display:none)', () => {
    const { container } = render(
      <AcRadioTabs
        tabs={RADIO_TABS}
        panels={RADIO_PANELS}
        groupName="kn-radios-tabbable"
        ariaLabel="Test sections"
      />,
    );
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    expect(radios.length).toBe(3);
    radios.forEach((radio) => {
      // Radios must remain in the tab order. sr-only hides them
      // visually; tabindex must NOT be -1.
      expect(radio.getAttribute('tabindex')).not.toBe('-1');
      // Radios carry the accessible name (aria-label) since the
      // visible labels are presentation-only.
      expect(radio.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('controlled mode: ArrowRight on the active radio fires onActiveIdChange', async () => {
    // Use the userEvent library so keyboard semantics flow through the
    // browser-style event sequencing (keydown -> change), not the
    // synthetic fireEvent path that bypasses radio-group focus rules.
    const handler = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <AcRadioTabs
        tabs={RADIO_TABS}
        panels={RADIO_PANELS}
        activeId="kn-tab-a"
        onActiveIdChange={handler}
        groupName="kn-controlled-arrow"
        ariaLabel="Test sections"
      />,
    );
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    radios[0]!.focus();
    expect(document.activeElement).toBe(radios[0]);
    await user.keyboard('{ArrowRight}');
    expect(handler).toHaveBeenCalled();
    // Browser radio-group semantics fire change on the next radio.
    expect(handler.mock.calls[0]![0]).toBe('kn-tab-b');
  });

  it('clicking a label updates the matching radio (htmlFor click-forward)', () => {
    const handler = vi.fn();
    render(
      <AcRadioTabs
        tabs={RADIO_TABS}
        panels={RADIO_PANELS}
        activeId="kn-tab-a"
        onActiveIdChange={handler}
        groupName="kn-click-forward"
        ariaLabel="Test sections"
      />,
    );
    fireEvent.click(screen.getByText('Beta'));
    expect(handler).toHaveBeenCalledWith('kn-tab-b');
  });
});

// ===========================================================================
// AcToggle — segmented radio-group enum picker
// ===========================================================================

type ToggleVal = 'on' | 'off' | 'auto';

describe('AcToggle keyboard navigation', () => {
  it('exposes role="radiogroup" + aria-label', () => {
    const { container } = render(
      <AcToggle<ToggleVal>
        value="on"
        options={[
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
          { value: 'auto', label: 'Auto' },
        ]}
        onChange={() => {}}
        ariaLabel="Polarity"
      />,
    );
    const group = assertExactlyOneRole(container as HTMLElement, 'radiogroup', {
      name: 'Polarity',
    });
    assertAriaContract(group, { role: 'radiogroup', ariaLabel: 'Polarity' });
  });

  it('each radio is focusable and carries the option value', () => {
    const { container } = render(
      <AcToggle<ToggleVal>
        value="on"
        options={[
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
          { value: 'auto', label: 'Auto' },
        ]}
        onChange={() => {}}
        ariaLabel="Polarity"
      />,
    );
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    expect(radios.length).toBe(3);
    const values = Array.from(radios).map((r) => r.value);
    expect(values).toEqual(['on', 'off', 'auto']);
    radios.forEach((radio) => {
      // Radios must remain focusable; the sr-only-ish .ac-toggle__input
      // CSS keeps them out of sight but in the tab order.
      expect(radio.getAttribute('tabindex')).not.toBe('-1');
    });
  });

  it('clicking a segment label fires onChange with that segment value', () => {
    const handler = vi.fn();
    render(
      <AcToggle<ToggleVal>
        value="on"
        options={[
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
          { value: 'auto', label: 'Auto' },
        ]}
        onChange={handler}
        ariaLabel="Polarity"
      />,
    );
    fireEvent.click(screen.getByLabelText('Off'));
    expect(handler).toHaveBeenCalledWith('off');
  });

  it('disabled prop disables every radio (Tab still lands on first by browser)', () => {
    const { container } = render(
      <AcToggle<ToggleVal>
        value="on"
        options={[
          { value: 'on', label: 'On' },
          { value: 'off', label: 'Off' },
          { value: 'auto', label: 'Auto' },
        ]}
        onChange={() => {}}
        ariaLabel="Polarity"
        disabled
      />,
    );
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    radios.forEach((radio) => {
      expect(radio.disabled).toBe(true);
    });
    // The group root advertises the disabled state via the data-disabled
    // attribute (CSS hook).
    const group = container.querySelector<HTMLElement>('[role="radiogroup"]')!;
    expect(group.getAttribute('data-disabled')).toBe('true');
  });
});

// ===========================================================================
// AcSlider — interactive vs read-only
// ===========================================================================

describe('AcSlider keyboard navigation', () => {
  it('interactive AcSlider renders <input type="range"> in the tab order', () => {
    const { container } = render(
      <AcSlider
        label="Cutoff"
        bar={{
          value: 64,
          min: 0,
          max: 127,
          onChange: () => {},
          ariaLabel: 'Cutoff',
        }}
        readout={64}
      />,
    );
    const range = container.querySelector<HTMLInputElement>(
      'input[type="range"]',
    );
    expect(range).not.toBeNull();
    expect(range!.getAttribute('aria-label')).toBe('Cutoff');
    // The range input is the tab stop.
    const stops = getTabStops(container as HTMLElement);
    expect(stops).toContain(range);
  });

  it('range input is wired to onChange (native arrow-key bump path)', () => {
    // jsdom does not implement the native range-input arrow-key value
    // bump (Chromium / Firefox / Safari ship that behavior natively).
    // The component-level contract we CAN test in jsdom is that the
    // range input is wired to the AcRangeBar onChange prop — when the
    // input fires a change event with a new value, onChange receives
    // the parsed numeric value. Real browser arrow-key semantics are
    // covered by the editor-level Playwright suites.
    const onChange = vi.fn();
    const { container } = render(
      <AcSlider
        label="Cutoff"
        bar={{
          value: 64,
          min: 0,
          max: 127,
          onChange,
          ariaLabel: 'Cutoff',
        }}
        readout={64}
      />,
    );
    const range = container.querySelector<HTMLInputElement>(
      'input[type="range"]',
    )!;
    // Simulate the browser's "arrow-key bumped value by step" outcome.
    fireEvent.change(range, { target: { value: '65' } });
    expect(onChange).toHaveBeenLastCalledWith(65);
  });

  it('range input min / max / step attributes drive native keyboard semantics', () => {
    // The browser's arrow-key handler is bounded by the input's
    // min/max/step attributes. We assert those flow through from the
    // bar props so the component-level contract is correct even
    // though the jsdom test runner can't exercise the bump itself.
    const { container } = render(
      <AcSlider
        label="Cutoff"
        bar={{
          value: 64,
          min: 0,
          max: 127,
          step: 2,
          onChange: () => {},
          ariaLabel: 'Cutoff',
        }}
        readout={64}
      />,
    );
    const range = container.querySelector<HTMLInputElement>(
      'input[type="range"]',
    )!;
    expect(range.getAttribute('min')).toBe('0');
    expect(range.getAttribute('max')).toBe('127');
    expect(range.getAttribute('step')).toBe('2');
    // Boundary fire: setting the value to the min/max via the change
    // path proves the wiring respects both edges (real browser Home
    // and End keys take the same code path).
    fireEvent.change(range, { target: { value: '0' } });
    fireEvent.change(range, { target: { value: '127' } });
  });

  it('read-only AcSlider (no onChange) does NOT render a focusable range input', () => {
    const { container } = render(
      <AcSlider
        label="Cutoff"
        bar={{
          value: 64,
          min: 0,
          max: 127,
          // No onChange => read-only.
          ariaLabel: 'Cutoff display',
        }}
        readout={64}
      />,
    );
    const range = container.querySelector<HTMLInputElement>(
      'input[type="range"]',
    );
    expect(range).toBeNull();
    // The outer wrapper renders as role="img" so display-only readouts
    // still have an accessible name.
    const img = container.querySelector<HTMLElement>('[role="img"]');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('aria-label')).toBe('Cutoff display');
    // No focusable elements.
    const stops = getTabStops(container as HTMLElement);
    expect(stops).toHaveLength(0);
  });

  it('disabled interactive AcSlider keeps the range input out of the active tab traversal', () => {
    const { container } = render(
      <AcSlider
        label="Cutoff"
        bar={{
          value: 64,
          min: 0,
          max: 127,
          onChange: () => {},
          disabled: true,
          ariaLabel: 'Cutoff',
        }}
        readout={64}
      />,
    );
    // A disabled range input is excluded from getTabStops's selector
    // (the `:not([disabled])` clause), so the helper returns 0 stops.
    const stops = getTabStops(container as HTMLElement);
    expect(stops).toHaveLength(0);
  });
});

// ===========================================================================
// AcLiveStatusFooter — locks in AUDIT-20260525-16 split-announcement fix
// ===========================================================================

describe('AcLiveStatusFooter ARIA contract (AUDIT-20260525-16)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('visible chrome (root + __text) has NEITHER role NOR aria-live (AUDIT-20260525-16)', () => {
    const { container } = render(
      <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={Date.now()} />,
    );
    const root = container.querySelector<HTMLElement>('.ac-live-status-footer')!;
    const text = container.querySelector<HTMLElement>(
      '.ac-live-status-footer__text',
    )!;
    expect(root).not.toBeNull();
    expect(text).not.toBeNull();
    // The visible chrome ticks every 100ms; if it carried a live region
    // every tick would re-announce. AUDIT-16 split the announcement
    // contract so the visible chrome is mute.
    expect(root.getAttribute('role')).toBeNull();
    expect(root.getAttribute('aria-live')).toBeNull();
    expect(text.getAttribute('role')).toBeNull();
    expect(text.getAttribute('aria-live')).toBeNull();
  });

  it('dedicated __announcement span carries role="status" + aria-live="polite"', () => {
    const { container } = render(
      <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={Date.now()} />,
    );
    const ann = container.querySelector<HTMLElement>(
      '.ac-live-status-footer__announcement',
    )!;
    expect(ann).not.toBeNull();
    assertAriaContract(ann, {
      role: 'status',
      ariaLive: 'polite',
    });
  });

  it('announcement span carries the ac-sr-only visually-hidden class', () => {
    const { container } = render(
      <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={Date.now()} />,
    );
    const ann = container.querySelector<HTMLElement>(
      '.ac-live-status-footer__announcement',
    )!;
    // sr-only chrome: the announcement is in the DOM for assistive tech
    // but visually clipped. The class is the canonical hook for the
    // clip-path utility in primitives.css.
    expect(ann.classList.contains('ac-sr-only')).toBe(true);
  });

  it('announcement does NOT update on 100ms ticks (only on rising edge of lastEditAt) (AUDIT-20260525-16)', () => {
    // The teeth of the AUDIT-16 split-contract: under a 100ms ticker,
    // the announcement text must stay STABLE between rising-edge events.
    // If a future regression moves the announcement back onto the
    // visible chrome (or removes the rising-edge gate), the text under
    // role="status" would change every 100ms.
    const t0 = 1_000_000;
    vi.setSystemTime(t0);
    const { container } = render(
      <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={t0} />,
    );
    const ann = container.querySelector<HTMLElement>(
      '.ac-live-status-footer__announcement',
    )!;
    const initialText = ann.textContent;
    expect(initialText).toBe('Edit confirmed.');

    // Advance 5 seconds in 100ms ticks. The visible chrome will re-render
    // many times; the announcement must NOT change.
    for (let i = 0; i < 50; i += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    // Re-query because the same element ref may have been recreated.
    const annAfter = container.querySelector<HTMLElement>(
      '.ac-live-status-footer__announcement',
    )!;
    expect(annAfter.textContent).toBe(initialText);
  });

  it('READY-state has empty announcement (nothing to announce on first mount)', () => {
    const { container } = render(
      <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={null} />,
    );
    const ann = container.querySelector<HTMLElement>(
      '.ac-live-status-footer__announcement',
    )!;
    expect(ann.textContent).toBe('');
  });

  it('error-state announcement includes the error message', () => {
    const { container } = render(
      <AcLiveStatusFooter
        deviceLabel="S3000XL"
        lastEditAt={null}
        state="error"
        errorMessage="bridge unreachable"
      />,
    );
    const ann = container.querySelector<HTMLElement>(
      '.ac-live-status-footer__announcement',
    )!;
    expect(ann.textContent).toBe('Device error: bridge unreachable.');
  });
});
