/**
 * Playwright config for Tier 1 wiring tests.
 *
 * Wiring tests verify the device-write seam: given a programmatic value
 * change on an editor control, the expected SysEx / parameter-write
 * traffic reaches the simulated MIDI adapter. They run against the
 * simulated harness ('?midi=simulated&scenario=<name>') -- no device,
 * no MIDI hardware, no SCSI.
 *
 * Patterns like locator.fill() / input.value = X / dispatchEvent('change')
 * are appropriate here because Tier 1 isolates the write path, not the
 * user-facing interaction model. See test/wiring/README.md for the full
 * tier contract and the reform spec (workplan 9R-A) for context.
 */

import { defineHarnessConfig } from './playwright.harness.shared';

export default defineHarnessConfig({
  testDir: './test/wiring',
  timeoutMs: 15_000,
  configName: 'playwright.wiring.config.ts',
});
