/**
 * Shared `window.__acHarness` namespace declaration for the `/_harness/*`
 * routes. Every harness mounts on its own route and writes ONLY to its own
 * sub-key under `window.__acHarness` (`envelopeTable`, `rangeBar`, …).
 *
 * The single namespace is intentional: a per-harness window global would
 * compose into the convention-canon trap (`__acHarness`, `__acRangeBarHarness`,
 * `__acEnvelopeGraphHarness`, …) where every new harness invents a new global
 * and existing specs drift. Collapsing to a single namespace + sub-keys means
 * adding a new harness adds a sub-key here and a sibling write in the harness
 * body — sibling harnesses never clobber each other's state.
 *
 * Each sub-key is optional because the harnesses load on distinct routes —
 * only one sub-key is populated per page load. Specs read
 * `window.__acHarness?.<harnessKey>?.<field>` and treat missing entries as
 * a contract failure (the harness body must have run before the spec reads).
 */
export {};

declare global {
  interface Window {
    __acHarness?: {
      envelopeTable?: {
        timeCalls: ReadonlyArray<{ index: number; value: number }>;
        levelCalls: ReadonlyArray<{ index: number; value: number }>;
        segments: ReadonlyArray<{ time: number; level: number }>;
      };
      rangeBar?: {
        changes: ReadonlyArray<number>;
        value: number;
      };
    };
  }
}
