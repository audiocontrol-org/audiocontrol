/**
 * S-330 Tones page -- simulated MIDI harness.
 *
 * SKIPPED for Phase 0 Task 8.
 *
 * Diagnostic: the TonesPage's `loadInitialData()` calls `loadToneBank(0)`
 * directly (no patch load first). The first SysEx the page emits is
 * therefore a tone-area data request:
 *
 *   send([0xF0 0x41 0x00 0x1E 0x41 0x00 ... 0x00 0x79 0xF7 (15 bytes)])
 *     at sequence 0
 *     does not match recorded outbound
 *     [0xF0 0x41 0x00 0x1E 0x41 0x00 ... 0x00 0x78 0xF7 (15 bytes)]
 *     -- first diff at byte 6: expected 0x00, got 0x03
 *
 * The fixture (`load-everything.ndjson`) was captured by running
 * `loadPatchRange(0, 64)` THEN `loadToneRange(0, 32)` -- the per-tone
 * requests are at fixture sequences 128+, not at sequence 0. Byte 6 in
 * the SysEx address field selects the area: 0x00 = patch, 0x03 = tone.
 *
 * To unblock this spec we need a `tones-only` (or `connect-then-tones`)
 * fixture whose first outbound record is the tone-0 request. That
 * requires hardware to record, which is out of scope for this task.
 *
 * Follow-up: capture a `tones-only.ndjson` scenario via the Phase 0 Task 4
 * CLI runner, then unskip these specs and replace `?scenario=load-everything`
 * with `?scenario=tones-only`.
 */
import { test } from '@playwright/test';

test.describe('S-330 Tones -- simulated harness', () => {
  test.skip(
    'pending tones-only fixture',
    () => {
      // No-op body. The describe-level skip keeps the spec discoverable so
      // the follow-up to capture `tones-only.ndjson` lands here naturally.
    },
  );
});
