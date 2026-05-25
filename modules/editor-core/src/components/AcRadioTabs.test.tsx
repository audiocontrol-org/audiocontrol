/**
 * AcRadioTabs tests
 *
 * Covers both uncontrolled (backwards-compat with all pre-2026-05-24
 * roland adopters) and controlled (akai VelocityZoneEditor) modes,
 * plus the AUDIT-20260524-10 class-namespace regression contract and
 * the AUDIT-20260524-11 radio-group ARIA contract.
 *
 * Per the project's "Validator-paired changes" discipline: each
 * gate-semantic change ships with adversarial scenarios that would
 * have failed against the pre-change implementation.
 *
 *   - Controlled-mode teeth assertion: reverting only the
 *     `isControlled` branch in AcRadioTabs.tsx (i.e., making the
 *     component always render all panels regardless of activeId)
 *     would fail `renders ONLY the active panel when activeId is
 *     supplied`.
 *
 *   - Class-namespace teeth assertion (AUDIT-10): reverting the
 *     `.ac-tabs` → `.ac-radio-tabs` rename would mount the radio-tab
 *     chrome under a class that overlaps with the LibraryPanel /
 *     BuildInfo button-tab system. The "no .ac-tabs class on the
 *     container" assertion would go red.
 *
 *   - ARIA teeth assertion (AUDIT-11): reverting the role-cleanup
 *     would re-introduce `role="tablist"` / `role="tab"` /
 *     `role="tabpanel"`. The "no faux tab roles" assertion locks
 *     them out.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { AcRadioTabs, type AcRadioTabDef } from './AcRadioTabs';

afterEach(() => {
  cleanup();
});

const TABS: readonly AcRadioTabDef[] = [
  { id: 'tab-a', label: 'Alpha' },
  { id: 'tab-b', label: 'Beta' },
  { id: 'tab-c', label: 'Gamma' },
] as const;

const PANELS = {
  'tab-a': <div data-testid="panel-a">Panel A content</div>,
  'tab-b': <div data-testid="panel-b">Panel B content</div>,
  'tab-c': <div data-testid="panel-c">Panel C content</div>,
};

/** Pull the `<input ...>` tag for a given tab id out of the rendered HTML
 *  so attribute-position changes (e.g., React reordering checked before
 *  id) don't break attribute-presence assertions. Returns the inner
 *  attribute-list string between `<input ` and `/>` so callers can
 *  assert on the presence of `checked` / `id="..."` etc. */
function extractInputTag(html: string, tabId: string): string {
  const idMarker = `id="${tabId}"`;
  const idIdx = html.indexOf(idMarker);
  if (idIdx < 0) throw new Error(`could not find id="${tabId}" in markup: ${html}`);
  const openIdx = html.lastIndexOf('<input', idIdx);
  if (openIdx < 0) throw new Error(`could not find opening <input for ${tabId}`);
  const closeIdx = html.indexOf('/>', idIdx);
  if (closeIdx < 0) throw new Error(`could not find closing /> for ${tabId}`);
  return html.slice(openIdx, closeIdx + 2);
}

describe('AcRadioTabs — uncontrolled mode (backwards-compat)', () => {
  it('renders the three-element pattern with .ac-radio-tabs / .ac-radio-tab-strip / .ac-radio-panels', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="test-uncontrolled-shape"
        ariaLabel="Test sections"
      />,
    );
    expect(html).toContain('class="ac-radio-tabs"');
    expect(html).toContain('class="ac-radio-tab-strip"');
    expect(html).toContain('class="ac-radio-panels"');
    expect(html).toContain('aria-label="Test sections"');
  });

  it('renders ALL panels in the DOM (CSS hides inactive ones)', () => {
    render(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="test-all-panels"
        ariaLabel="Test sections"
      />,
    );
    expect(screen.getByTestId('panel-a')).toBeTruthy();
    expect(screen.getByTestId('panel-b')).toBeTruthy();
    expect(screen.getByTestId('panel-c')).toBeTruthy();
  });

  it('defaults the first tab to defaultChecked when defaultTabId is omitted', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="test-default-first"
        ariaLabel="Test sections"
      />,
    );
    // React serializes `defaultChecked={true}` as `checked=""` in static markup.
    // Match the full radio input tag for each tab so the assertion is
    // position-independent.
    const radioForTabA = extractInputTag(html, 'tab-a');
    const radioForTabB = extractInputTag(html, 'tab-b');
    const radioForTabC = extractInputTag(html, 'tab-c');
    expect(radioForTabA).toContain('checked');
    expect(radioForTabB).not.toContain('checked');
    expect(radioForTabC).not.toContain('checked');
  });

  it('honors defaultTabId when supplied', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        defaultTabId="tab-b"
        groupName="test-default-explicit"
        ariaLabel="Test sections"
      />,
    );
    const radioForTabA = extractInputTag(html, 'tab-a');
    const radioForTabB = extractInputTag(html, 'tab-b');
    const radioForTabC = extractInputTag(html, 'tab-c');
    expect(radioForTabA).not.toContain('checked');
    expect(radioForTabB).toContain('checked');
    expect(radioForTabC).not.toContain('checked');
  });

  it('does NOT add the ac-radio-tabs--controlled modifier class', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="test-no-controlled-class"
        ariaLabel="Test sections"
      />,
    );
    expect(html).not.toContain('ac-radio-tabs--controlled');
  });
});

describe('AcRadioTabs — controlled mode (activeId + onActiveIdChange)', () => {
  it('renders ONLY the active panel when activeId is supplied (teeth assertion)', () => {
    render(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        activeId="tab-b"
        onActiveIdChange={() => {}}
        groupName="test-controlled-only-active"
        ariaLabel="Test sections"
      />,
    );
    expect(screen.queryByTestId('panel-a')).toBeNull();
    expect(screen.getByTestId('panel-b')).toBeTruthy();
    expect(screen.queryByTestId('panel-c')).toBeNull();
  });

  it('adds the ac-radio-tabs--controlled modifier class so the lone panel is visible', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        activeId="tab-a"
        onActiveIdChange={() => {}}
        groupName="test-controlled-class"
        ariaLabel="Test sections"
      />,
    );
    expect(html).toContain('ac-radio-tabs--controlled');
  });

  it('renders the active radio as `checked` (not defaultChecked)', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        activeId="tab-c"
        onActiveIdChange={() => {}}
        groupName="ctrl-active-radio"
        ariaLabel="Test sections"
      />,
    );
    const radioForTabA = extractInputTag(html, 'tab-a');
    const radioForTabB = extractInputTag(html, 'tab-b');
    const radioForTabC = extractInputTag(html, 'tab-c');
    // Only the active (tab-c) radio is checked.
    expect(radioForTabC).toContain('checked');
    expect(radioForTabA).not.toContain('checked');
    expect(radioForTabB).not.toContain('checked');
  });

  it('fires onActiveIdChange with the clicked tab id when the user clicks a label', () => {
    const handler = vi.fn();
    render(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        activeId="tab-a"
        onActiveIdChange={handler}
        groupName="test-controlled-onchange"
        ariaLabel="Test sections"
      />,
    );
    // Labels carry htmlFor pointing at the radio; click drives the radio's
    // native onChange, which our component forwards to onActiveIdChange.
    fireEvent.click(screen.getByText('Beta'));
    expect(handler).toHaveBeenCalledWith('tab-b');
  });

  it('coexists with an uncontrolled instance on the same page', () => {
    render(
      <div>
        <AcRadioTabs
          tabs={TABS}
          panels={{
            'tab-a': <div data-testid="ctrl-panel-a">Ctrl A</div>,
            'tab-b': <div data-testid="ctrl-panel-b">Ctrl B</div>,
            'tab-c': <div data-testid="ctrl-panel-c">Ctrl C</div>,
          }}
          activeId="tab-c"
          onActiveIdChange={() => {}}
          groupName="ctrl-group"
          ariaLabel="Controlled"
        />
        <AcRadioTabs
          tabs={TABS}
          panels={{
            'tab-a': <div data-testid="unctrl-panel-a">Un A</div>,
            'tab-b': <div data-testid="unctrl-panel-b">Un B</div>,
            'tab-c': <div data-testid="unctrl-panel-c">Un C</div>,
          }}
          groupName="unctrl-group"
          ariaLabel="Uncontrolled"
        />
      </div>,
    );
    // Controlled instance: only tab-c panel.
    expect(screen.queryByTestId('ctrl-panel-a')).toBeNull();
    expect(screen.queryByTestId('ctrl-panel-b')).toBeNull();
    expect(screen.getByTestId('ctrl-panel-c')).toBeTruthy();
    // Uncontrolled instance: all panels.
    expect(screen.getByTestId('unctrl-panel-a')).toBeTruthy();
    expect(screen.getByTestId('unctrl-panel-b')).toBeTruthy();
    expect(screen.getByTestId('unctrl-panel-c')).toBeTruthy();
  });

  it('does NOT crash when onActiveIdChange is omitted in controlled mode (operator misuse)', () => {
    // The component's onChange handler uses optional-chain, so a missing
    // handler is a no-op rather than a crash. This documents the
    // operator-misuse contract: controlled mode without a handler is
    // legal but useless — clicks won't propagate.
    expect(() =>
      render(
        <AcRadioTabs
          tabs={TABS}
          panels={PANELS}
          activeId="tab-a"
          groupName="test-misuse"
          ariaLabel="Test sections"
        />,
      ),
    ).not.toThrow();
    // Clicking still doesn't crash.
    expect(() => fireEvent.click(screen.getByText('Beta'))).not.toThrow();
  });
});

describe('AcRadioTabs — class-namespace contract (AUDIT-20260524-10)', () => {
  // Background: the 2026-05-24 promotion of AcRadioTabs to editor-core
  // initially re-used the bare `.ac-tabs` / `.ac-tab` / `.ac-tab-strip`
  // / `.ac-panels` / `.ac-panel` class names. Those names were ALREADY
  // consumed by LibraryPanel and BuildInfo as a button-tab system
  // (horizontal flex + active-state underline via .ac-tab--active). The
  // radio-tab CSS rules (display: block + border-bottom: 0) silently
  // overrode the button-tab contract because layout-primitives.css loads
  // BEFORE tab-primitives.css in styles.css.
  //
  // The teeth assertion: render an AcRadioTabs side-by-side with a
  // button-tab DOM shape and confirm:
  //   1. AcRadioTabs uses ONLY .ac-radio-* classes — never bare .ac-tabs
  //      / .ac-tab / .ac-tab-strip / .ac-panels / .ac-panel on its own
  //      elements.
  //   2. The bare-named button-tab DOM remains untouched in its own
  //      class space (no shared className collision).
  //
  // Reverting the rename in AcRadioTabs.tsx (e.g., changing the JSX
  // back to className="ac-tabs") would fail assertion #1 below with
  // a message like:
  //   AssertionError: expected container.className to be exactly
  //   "ac-radio-tabs" — received "ac-tabs"

  it('does NOT emit the bare .ac-tabs / .ac-tab / .ac-tab-strip / .ac-panels / .ac-panel classes', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="test-no-bare-classes"
        ariaLabel="Test sections"
      />,
    );
    // The radio-tab chrome must live entirely under .ac-radio-* so it
    // can never collide with the legacy button-tab .ac-tabs/.ac-tab
    // system declared in layout-primitives.css. Each substring below
    // is checked as a quoted className token to avoid matching the
    // .ac-radio-tab[s|-strip|-panel(s)] descendants by accident.
    expect(html).not.toMatch(/class="[^"]*\bac-tabs\b[^"]*"/);
    expect(html).not.toMatch(/class="[^"]*\bac-tab\b[^"]*"/);
    expect(html).not.toMatch(/class="[^"]*\bac-tab-strip\b[^"]*"/);
    expect(html).not.toMatch(/class="[^"]*\bac-panels\b[^"]*"/);
    expect(html).not.toMatch(/class="[^"]*\bac-panel\b[^"]*"/);
  });

  it('mounts AcRadioTabs alongside a button-tab DOM without className collision', () => {
    // Simulate the LibraryPanel / BuildInfo render shape: a <div
    // className="ac-tabs"> with <button className="ac-tab
    // ac-tab--active"> children. After the AUDIT-10 rename the two
    // class spaces are disjoint and both fragments coexist cleanly.
    render(
      <div data-testid="combo-host">
        <div className="ac-tabs" data-testid="button-tabs">
          <button className="ac-tab ac-tab--active" data-testid="button-tab-a">
            Info
          </button>
          <button className="ac-tab" data-testid="button-tab-b">
            Logs
          </button>
        </div>
        <AcRadioTabs
          tabs={TABS}
          panels={PANELS}
          groupName="combo-test"
          ariaLabel="Combo sections"
        />
      </div>,
    );

    const buttonTabs = screen.getByTestId('button-tabs');
    const activeButton = screen.getByTestId('button-tab-a');

    // The button-tab container keeps its .ac-tabs class.
    expect(buttonTabs.className).toBe('ac-tabs');
    // The active button keeps its .ac-tab + .ac-tab--active classes.
    expect(activeButton.className).toBe('ac-tab ac-tab--active');

    // The AcRadioTabs container next to it must NOT carry the bare
    // .ac-tabs class — that collision was the AUDIT-10 regression.
    const radioContainer = screen
      .getByLabelText('Combo sections') as HTMLElement;
    expect(radioContainer.className).toContain('ac-radio-tabs');
    expect(radioContainer.classList.contains('ac-tabs')).toBe(false);

    // The radio-tab strip + panels likewise live under the .ac-radio-*
    // namespace; the button-tab shape's .ac-tab class never appears on
    // any AcRadioTabs descendant.
    const radioDescendants = radioContainer.querySelectorAll('*');
    radioDescendants.forEach((node) => {
      const cls = (node as HTMLElement).className || '';
      // Some nodes are SVG / non-HTMLElement — coerce className to a
      // string for the assertion.
      const classList = typeof cls === 'string' ? cls.split(/\s+/) : [];
      expect(classList).not.toContain('ac-tabs');
      expect(classList).not.toContain('ac-tab');
      expect(classList).not.toContain('ac-tab-strip');
      expect(classList).not.toContain('ac-panels');
      expect(classList).not.toContain('ac-panel');
    });
  });
});

describe('AcRadioTabs — radio-group ARIA contract (AUDIT-20260524-11)', () => {
  // Background: the pre-fix component declared role="tablist" /
  // role="tab" / role="tabpanel" plus tabIndex={0} on the labels, but
  // did NOT implement the ARIA tabs contract (no aria-selected, no
  // aria-controls, no Left/Right/Home/End keyboard handler). The
  // radio inputs themselves were removed from the tab order entirely
  // (display: none-equivalent CSS). Screen-reader users heard
  // announcements like "tab, 1 of 4" that the widget could not honor.
  //
  // The fix takes the radio-group fork: remove the faux tab roles,
  // expose role="radiogroup" on the container, keep radios in the tab
  // order via sr-only CSS (not display: none) so native browser
  // keyboard semantics (Tab + Arrow keys) work.
  //
  // Teeth assertion: reverting the role-cleanup would re-introduce
  // role="tablist" / role="tab" / role="tabpanel"; the "no faux tab
  // roles" assertions below would fail with messages like:
  //   AssertionError: expected element NOT to have attribute
  //   "role" with value "tab" — found "tab" on <label htmlFor="tab-a">

  it('exposes role="radiogroup" + aria-label on the container', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="aria-radiogroup-test"
        ariaLabel="Test sections"
      />,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Test sections"');
  });

  it('does NOT render the faux role="tablist" / role="tab" / role="tabpanel" attributes', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="aria-no-faux-roles"
        ariaLabel="Test sections"
      />,
    );
    // These three roles were the AUDIT-11 violations. The component
    // must NEVER emit them again, because the implementation does not
    // honor the ARIA tabs contract.
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain('role="tabpanel"');
  });

  it('does NOT add tabIndex={0} to the visible labels (the radios own keyboard focus)', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="aria-no-tabindex"
        ariaLabel="Test sections"
      />,
    );
    // Pre-fix the labels carried tabIndex={0}, putting them in the tab
    // order while the radios were display: none. After the fix only
    // the radios should be focusable.
    expect(html).not.toContain('tabindex="0"');
  });

  it('renders each radio with a unique name (groupName) and an aria-label matching its tab.label', () => {
    render(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="aria-radios-named"
        ariaLabel="Test sections"
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    radios.forEach((radio, idx) => {
      expect(radio.getAttribute('name')).toBe('aria-radios-named');
      expect(radio.getAttribute('aria-label')).toBe(TABS[idx]!.label);
      // Radios must stay in the tab order — sr-only CSS hides them
      // visually but does NOT set tabindex=-1.
      expect(radio.getAttribute('tabindex')).not.toBe('-1');
    });
  });

  it('exposes the radios through screen.getByRole("radiogroup")', () => {
    render(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="aria-radiogroup-query"
        ariaLabel="Test sections accessible"
      />,
    );
    // The container is the radiogroup — assistive tech can find it
    // by role and name.
    const group = screen.getByRole('radiogroup', { name: 'Test sections accessible' });
    expect(group).toBeTruthy();
    // The group contains the three radios.
    const radiosInGroup = group.querySelectorAll('input[type="radio"]');
    expect(radiosInGroup).toHaveLength(3);
  });

  it('clicking a label still updates the matching radio (presentation labels click-forward via htmlFor)', () => {
    render(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        defaultTabId="tab-a"
        groupName="aria-label-click-forward"
        ariaLabel="Test sections"
      />,
    );
    // Click the second label — even though it has no role="tab",
    // its htmlFor="tab-b" forwards the click to the tab-b radio.
    fireEvent.click(screen.getByText('Beta'));
    const radioForB = document.getElementById('tab-b') as HTMLInputElement;
    expect(radioForB.checked).toBe(true);
  });
});
