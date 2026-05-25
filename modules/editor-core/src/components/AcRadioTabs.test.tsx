/**
 * AcRadioTabs tests
 *
 * Covers both uncontrolled (backwards-compat with all pre-2026-05-24
 * roland adopters) and controlled (akai VelocityZoneEditor) modes.
 *
 * Per the project's "Validator-paired changes" discipline: the
 * controlled-mode props (`activeId` + `onActiveIdChange`) are a
 * gate-semantic change that ships with adversarial scenarios that
 * would have failed against the pre-change implementation. Teeth
 * test: reverting only the `isControlled` branch in AcRadioTabs.tsx
 * (i.e., making the component always render all panels regardless of
 * activeId) would fail `renders ONLY the active panel when activeId
 * is supplied` — the assertion checks that non-active panels are NOT
 * in the DOM, not that the active panel is in the DOM.
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
  it('renders the three-element pattern with .ac-tabs / .ac-tab-strip / .ac-panels', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="test-uncontrolled-shape"
        ariaLabel="Test sections"
      />,
    );
    expect(html).toContain('class="ac-tabs"');
    expect(html).toContain('class="ac-tab-strip"');
    expect(html).toContain('role="tablist"');
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

  it('does NOT add the ac-tabs--controlled modifier class', () => {
    const html = renderToStaticMarkup(
      <AcRadioTabs
        tabs={TABS}
        panels={PANELS}
        groupName="test-no-controlled-class"
        ariaLabel="Test sections"
      />,
    );
    expect(html).not.toContain('ac-tabs--controlled');
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

  it('adds the ac-tabs--controlled modifier class so the lone panel is visible', () => {
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
    expect(html).toContain('ac-tabs--controlled');
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
