/**
 * a11y-helpers — shared assertion helpers for the editor-core keyboard
 * navigation harness (keyboard-navigation.spec.tsx).
 *
 * The harness asserts WCAG keyboard-nav invariants across every canonical
 * interactive primitive. Each helper here factors out a recurring
 * assertion shape so the spec stays readable and any new primitive that
 * joins the harness can reuse the same vocabulary.
 *
 * Per the project memory `feedback_consistency_critical`: cross-primitive
 * assertions belong in one place; copy-pasted assertion bodies are a
 * nucleation site for drift.
 */

import { expect } from 'vitest';

/**
 * Return all elements that are in the keyboard tab order under `root`.
 *
 * "In the tab order" is defined as: a focusable element whose effective
 * tabIndex is >= 0, AND which is not currently keyboard-unreachable
 * because of an enclosing visibility/hidden contract. The check uses
 * the standard focusable-selector set (button, input, select, textarea,
 * a[href], [tabindex]) and filters out:
 *
 *   - elements with `tabindex="-1"` (which keep their semantics for
 *     screen-reader / voice-control element enumeration but do NOT
 *     appear in keyboard tab traversal)
 *   - elements with an ancestor (or self) that is visibility-hidden in
 *     a way a real browser would honor: `aria-hidden="true"`, the
 *     `hidden` HTML attribute, inline `display:none` /
 *     `visibility:hidden`, or `.ac-collapse[data-expanded="false"]`
 *     (the canonical disclosure wrapper that grid-clips its contents
 *     to 0 height when collapsed — content is in the DOM but the
 *     visible rendering is CSS-driven, so the browser routes Tab
 *     past it).
 *
 * The `.ac-collapse[data-expanded="false"]` filter (AUDIT-20260525-21)
 * closes the gap surfaced by the original AUDIT-01 closure: jsdom
 * doesn't compute layout, so a selector-only helper counted every
 * mounted treeitem (including rows inside collapsed subtrees) as a
 * tab stop. Real browsers route Tab past CSS-clipped content; this
 * helper now mirrors that contract by walking the ancestor chain
 * for each candidate and rejecting any candidate enclosed by the
 * canonical collapsed-disclosure wrapper.
 *
 * The selector intentionally does NOT include `[tabindex]` alone —
 * that would re-add the tabindex="-1" elements we just filtered out.
 * We include `[tabindex="0"]` explicitly so non-button/input elements
 * that opt in via tabIndex={0} are counted.
 */
export function getTabStops(root: HTMLElement): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex="0"]',
  ].join(',');
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(selector),
  );
  return candidates.filter((el) => {
    const ti = el.getAttribute('tabindex');
    if (ti === '-1') return false;
    if (isKeyboardUnreachable(el, root)) return false;
    return true;
  });
}

/**
 * Walk the ancestor chain from `el` toward `root` (inclusive). Return
 * `true` if any ancestor (or `el` itself) is visibility-hidden in a
 * way a real browser would honor for keyboard tab traversal.
 *
 * The checks intentionally stay narrow: only contracts that jsdom can
 * see through `getAttribute` / inline `style` / classList. CSS-driven
 * rules (e.g., `.hidden { display: none }` defined in an external
 * stylesheet that jsdom doesn't apply) are out of scope — they're the
 * concern of the editor-level Playwright suites. The contracts that
 * DO live here are the ones that appear in the canonical primitives:
 *
 *   - `aria-hidden="true"` — explicit accessibility-tree removal.
 *   - `hidden` (HTML attribute) — semantic browser-honored hide.
 *   - inline `style="display: none"` / `style="visibility: hidden"` —
 *     pixel-clipped via inline styles.
 *   - `.ac-collapse[data-expanded="false"]` — the canonical disclosure
 *     wrapper. Children render via the grid-template-rows transition
 *     and are pixel-clipped when collapsed.
 */
function isKeyboardUnreachable(el: HTMLElement, root: HTMLElement): boolean {
  let cursor: HTMLElement | null = el;
  while (cursor !== null) {
    if (cursor.getAttribute('aria-hidden') === 'true') return true;
    if (cursor.hasAttribute('hidden')) return true;
    const inlineDisplay = cursor.style?.display;
    if (inlineDisplay === 'none') return true;
    const inlineVisibility = cursor.style?.visibility;
    if (inlineVisibility === 'hidden' || inlineVisibility === 'collapse') {
      return true;
    }
    if (
      cursor.classList.contains('ac-collapse') &&
      cursor.getAttribute('data-expanded') === 'false'
    ) {
      return true;
    }
    if (cursor === root) break;
    cursor = cursor.parentElement;
  }
  return false;
}

/**
 * Assert that `root` contains EXACTLY `expected` tab stops. Surfaces a
 * helpful error message when the count is wrong, including the markup
 * of the offending stops — without that context, the failure looks
 * like a bare integer mismatch and the operator has to re-derive what
 * tab-stop drift means.
 */
export function assertTabStopCount(
  root: HTMLElement,
  expected: number,
  context: string,
): void {
  const stops = getTabStops(root);
  if (stops.length !== expected) {
    const dump = stops
      .map((el, i) => `  [${i}] <${el.tagName.toLowerCase()} ${attrs(el)}>`)
      .join('\n');
    throw new Error(
      `${context}: expected ${expected} tab stop(s), got ${stops.length}.\n` +
        `Tab stops found:\n${dump}`,
    );
  }
}

/**
 * Assert that NO descendant of `root` carries `role={role}`. Used to lock
 * out faux ARIA roles after they were removed from a primitive (e.g.,
 * AUDIT-11's `role="tablist"` cleanup on AcRadioTabs).
 */
export function assertNoRole(root: HTMLElement, role: string): void {
  const offenders = Array.from(
    root.querySelectorAll<HTMLElement>(`[role="${role}"]`),
  );
  if (offenders.length > 0) {
    const dump = offenders
      .map((el, i) => `  [${i}] <${el.tagName.toLowerCase()} ${attrs(el)}>`)
      .join('\n');
    throw new Error(
      `Expected no element with role="${role}"; found ${offenders.length}:\n${dump}`,
    );
  }
}

/**
 * Assert that EXACTLY ONE element under `root` has the given role and
 * (optionally) the given accessible name. Returns the matched element so
 * callers can assert further attributes on it.
 *
 * Names match either `aria-label` or `aria-labelledby` resolution. The
 * helper does not currently resolve `aria-labelledby` text — pass the
 * literal `aria-label` value when the contract is `aria-label`-based.
 */
export function assertExactlyOneRole(
  root: HTMLElement,
  role: string,
  options?: { name?: string },
): HTMLElement {
  const matches = Array.from(
    root.querySelectorAll<HTMLElement>(`[role="${role}"]`),
  );
  if (options?.name !== undefined) {
    const filtered = matches.filter(
      (el) => el.getAttribute('aria-label') === options.name,
    );
    if (filtered.length !== 1) {
      throw new Error(
        `Expected exactly one role="${role}" with aria-label="${options.name}", ` +
          `got ${filtered.length} (of ${matches.length} total ${role} elements).`,
      );
    }
    return filtered[0]!;
  }
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one role="${role}", got ${matches.length}.`,
    );
  }
  return matches[0]!;
}

/**
 * Assert that `el` carries the expected role + every key/value in
 * `attrs`. Multi-key assertion in one helper so callers don't write four
 * sequential `expect(...).toBe(...)` calls per primitive.
 */
export function assertAriaContract(
  el: HTMLElement,
  expected: {
    role?: string;
    ariaLabel?: string;
    ariaExpanded?: 'true' | 'false';
    ariaLive?: 'polite' | 'assertive' | 'off';
    tabIndex?: string | null;
  },
): void {
  if (expected.role !== undefined) {
    expect(el.getAttribute('role')).toBe(expected.role);
  }
  if (expected.ariaLabel !== undefined) {
    expect(el.getAttribute('aria-label')).toBe(expected.ariaLabel);
  }
  if (expected.ariaExpanded !== undefined) {
    expect(el.getAttribute('aria-expanded')).toBe(expected.ariaExpanded);
  }
  if (expected.ariaLive !== undefined) {
    expect(el.getAttribute('aria-live')).toBe(expected.ariaLive);
  }
  if (expected.tabIndex !== undefined) {
    expect(el.getAttribute('tabindex')).toBe(expected.tabIndex);
  }
}

/** Internal: render an element's attributes as a compact diagnostic string. */
function attrs(el: HTMLElement): string {
  const parts: string[] = [];
  for (let i = 0; i < el.attributes.length; i += 1) {
    const a = el.attributes.item(i)!;
    parts.push(`${a.name}="${a.value}"`);
  }
  return parts.join(' ');
}
