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
 * Fixture inventory note: a `fetch-tone-0.ndjson` fixture exists (single
 * `requestToneData(0)` round trip, captured 2026-05-10T04:31:04Z). It is
 * NOT sufficient for `loadToneBank(0)`, which emits 8 tone requests for
 * S-330 (`tonesPerBank = 8`). Un-skipping this spec needs a
 * `tones-bank-0.ndjson` fixture that captures the full bank load.
 *
 * Tracked: https://github.com/audiocontrol-org/audiocontrol/issues/404
 *
 * Once that fixture lands, un-skip these specs and replace
 * `?scenario=load-everything` with `?scenario=tones-bank-0`.
 */
import { test } from '@playwright/test';

test.describe('S-330 Tones -- simulated harness', () => {
  test.skip(
    'pending tones-bank-0 fixture (issue #404)',
    () => {
      // No-op body. The describe-level skip keeps the spec discoverable so
      // the follow-up to capture `tones-bank-0.ndjson` lands here naturally.
    },
  );
});
