import { useState } from 'react';
import {
  AcRangeBar,
  BROKEN_PRIMITIVES,
  type AcRangeBarLinearProps,
  type AcRangeBarProps,
} from '@audiocontrol/editor-core';
import { resolveBrokenPrimitive, resolveContext } from '@/pages/_harness/url-params';

/**
 * Dev-only test harness route that mounts the production `<AcRangeBar>`
 * (linear variant) with seed state and exposes onChange invocations via
 * `window.__acRangeBarHarness` so a Playwright spec can drive the bar with
 * real pointer / keyboard events and assert the contract.
 *
 * This is the "primitive contract" harness (Layer 1) — no MIDI, no fixtures,
 * no device wiring. The bar under test IS the production primitive used on
 * the Tones page parameter rows; the only thing this harness adds is a spy
 * and stable initial state.
 *
 * URL params (per testing-and-inventory-reform-spec.md §5):
 *   ?broken=role-img|no-pointer-events|onchange-disconnected
 *   ?context=sticky-overlay|zero-width-grid|pointer-events-none-ancestor
 * Both may be set independently. Unknown values throw.
 *
 * The `window.__acRangeBarHarness` global mirrors React state for external
 * introspection. It collides by name with no other harness because each
 * harness mounts on its own route — but the per-harness global pattern is
 * documented here so future harnesses pick distinct names.
 *
 * NOT linked from the production nav. Reached only via `/_harness/range-bar`.
 */
declare global {
  interface Window {
    __acRangeBarHarness?: {
      changes: ReadonlyArray<number>;
      value: number;
    };
  }
}

export function AcRangeBarHarness(): JSX.Element {
  const [value, setValue] = useState(50);
  const [changes, setChanges] = useState<ReadonlyArray<number>>([]);

  // Mirror state to window so Playwright can introspect from outside React.
  window.__acRangeBarHarness = { changes, value };

  const Comp = resolveBrokenPrimitive<AcRangeBarProps, keyof typeof BROKEN_PRIMITIVES.AcRangeBar>(
    'broken',
    BROKEN_PRIMITIVES.AcRangeBar,
    AcRangeBar,
    'AcRangeBar',
  );
  const Ctx = resolveContext();

  const linearProps: AcRangeBarLinearProps = {
    variant: 'linear',
    value,
    min: 0,
    max: 127,
    onChange: (next: number) => {
      setValue(next);
      setChanges((prev) => [...prev, next]);
    },
    ariaLabel: 'Test range bar',
    startTick: '0',
    endTick: '127',
  };

  const bar = <Comp {...linearProps} />;
  const wrapped = Ctx === undefined ? bar : <Ctx>{bar}</Ctx>;

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>AcRangeBar harness</h1>
      <p style={{ marginBottom: 16, color: '#888' }}>
        Linear AcRangeBar. Drive with pointer or keyboard. The contract spec
        asserts pointer + keyboard interaction propagates to the consumer
        via onChange.
      </p>
      {wrapped}
    </div>
  );
}
