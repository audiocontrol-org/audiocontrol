/**
 * S-330 Play page -- simulated MIDI harness.
 *
 * SKIPPED for Phase 0 Task 8.
 *
 * Diagnostic: PlayPage.tsx mounts -> auto-runs:
 *
 *   loadPatchBank(0).then(() => loadFunctionParams())
 *
 * `loadFunctionParams` is `clientRef.current.requestFunctionParameters()`
 * which sends a multi-mode (function-parameter) SysEx address, NOT the
 * patch-area address that the fixture continues with after patch 0..7.
 *
 * The mismatch fires at the SAME byte-6 area-selector boundary as the
 * Tones page (different area code, same kind of mismatch). The fixture's
 * sequence after the first 8 patches is more patch records (it captured
 * `loadPatchRange(0, 64)` -- 64 patches, not 8), so any post-patch SysEx
 * the editor emits will fail loudly.
 *
 * To unblock this spec we need a `play-init.ndjson` fixture that captures
 * `loadPatchRange(0, 8)` followed by `requestFunctionParameters()` -- the
 * Phase 0 Task 4 CLI runner can record this once we have hardware time.
 */
import { test } from '@playwright/test';

test.describe('S-330 Play -- simulated harness', () => {
  test.skip(
    'pending play-init fixture',
    () => {
      // No-op body. The describe-level skip keeps the spec discoverable so
      // the follow-up to capture `play-init.ndjson` lands here naturally.
    },
  );
});
