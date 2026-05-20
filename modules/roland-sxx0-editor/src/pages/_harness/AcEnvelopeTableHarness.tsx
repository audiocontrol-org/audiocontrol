import { useState } from 'react';
import {
  AcEnvelopeTable,
  BROKEN_PRIMITIVES,
  type AcEnvelopeTableProps,
  type AcEnvelopeTableVariantKey,
} from '@audiocontrol/editor-core';
import { resolveBrokenPrimitive, resolveContext } from '@/pages/_harness/url-params';
// `window.__acHarness` is declared globally in ./harness-globals.d.ts.

/**
 * Dev-only test harness route that mounts the production `<AcEnvelopeTable>`
 * primitive with seed data and exposes onChange invocations via
 * `window.__acHarness.envelopeTable` so a Playwright spec can drive the
 * slider with real pointer events and assert the contract.
 *
 * This is the "primitive contract" harness (Layer 1) — no MIDI, no fixtures,
 * no device wiring. The slider under test IS the production primitive used
 * on the Tones page envelope editor; the only thing this harness adds is a
 * spy and stable initial state.
 *
 * URL params (per testing-and-inventory-reform-spec.md §5):
 *   ?broken=cells-role-img|onchange-disconnected
 *   ?context=sticky-overlay|zero-width-grid|pointer-events-none-ancestor
 * Both may be set independently. Unknown values throw.
 *
 * All harnesses share the `window.__acHarness` namespace and write to
 * distinct sub-keys (`envelopeTable`, `rangeBar`, …). Sibling harnesses
 * do not clobber each other's state — each route reads-modifies-writes
 * its own slot.
 *
 * NOT linked from the production nav. Reached only via `/_harness/envelope-table`.
 */
export function AcEnvelopeTableHarness(): JSX.Element {
  const [segments, setSegments] = useState<ReadonlyArray<{ time: number; level: number }>>([
    { time: 106, level: 127 },
    { time: 33, level: 34 },
    { time: 66, level: 0 },
    { time: 6, level: 3 },
    { time: 127, level: 0 },
    { time: 127, level: 0 },
    { time: 0, level: 0 },
    { time: 0, level: 0 },
  ]);
  const [timeCalls, setTimeCalls] = useState<ReadonlyArray<{ index: number; value: number }>>([]);
  const [levelCalls, setLevelCalls] = useState<ReadonlyArray<{ index: number; value: number }>>([]);

  // Mirror state to window so Playwright can introspect from outside React.
  // Read-modify-write our own sub-key so sibling harnesses' state survives
  // if they ever mount alongside (they don't today — each harness has its
  // own route — but the shape guards against the convention-canon trap).
  window.__acHarness = {
    ...(window.__acHarness ?? {}),
    envelopeTable: { timeCalls, levelCalls, segments },
  };

  const Broken = resolveBrokenPrimitive<AcEnvelopeTableProps, AcEnvelopeTableVariantKey>(
    'AcEnvelopeTable',
    BROKEN_PRIMITIVES.AcEnvelopeTable,
  );
  const Comp = Broken ?? AcEnvelopeTable;
  const Ctx = resolveContext();

  const table = (
    <Comp
      segments={segments}
      maxTime={127}
      maxLevel={127}
      activeSegment={1}
      sustainSegment={3}
      onTimeChange={(index, value) => {
        setSegments((prev) => prev.map((s, i) => (i === index - 1 ? { ...s, time: value } : s)));
        setTimeCalls((prev) => [...prev, { index, value }]);
      }}
      onLevelChange={(index, value) => {
        setSegments((prev) => prev.map((s, i) => (i === index - 1 ? { ...s, level: value } : s)));
        setLevelCalls((prev) => [...prev, { index, value }]);
      }}
    />
  );
  const wrapped = Ctx === undefined ? table : <Ctx>{table}</Ctx>;

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>AcEnvelopeTable harness</h1>
      <p style={{ marginBottom: 16, color: '#888' }}>
        Drive the segment-1 Time bar with a pointer. The contract spec asserts
        the slider is reachable, dispatches real change events, and that the
        spy onChange was invoked.
      </p>
      {wrapped}
    </div>
  );
}
