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
 * tabIndex is >= 0. The check uses the standard focusable-selector set
 * (button, input, select, textarea, a[href], [tabindex]) and explicitly
 * filters out elements with `tabindex="-1"` (which keep their semantics
 * for screen-reader / voice-control element enumeration but do NOT
 * appear in keyboard tab traversal).
 *
 * The selector intentionally does NOT include `[tabindex]` alone — that
 * would re-add the tabindex="-1" elements we just filtered out. We
 * include `[tabindex="0"]` explicitly so non-button/input elements that
 * opt in via tabIndex={0} are counted.
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
    return true;
  });
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
