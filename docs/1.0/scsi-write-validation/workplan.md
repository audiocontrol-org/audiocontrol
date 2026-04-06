# SCSI Write Validation - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:**

- Parent: TBD

## Technical Approach

Build a minimal CLI test harness that instantiates the S3000XL client and SCSI MIDI transport directly — no browser, no React, no Playwright. The harness runs write-readback tests against the live sampler to determine whether writes persist through the SCSI transport chain.

The critical insight is to test in two phases: first with caching **completely disabled** to eliminate it as a variable, then (if writes work) re-enable caching to validate cache invalidation behavior.

**Key architectural decisions:**

- **`noCache` as a first-class client option** — Not a test hack. Added to `S3000xlClientOptions` so any consumer can bypass caching for debugging. When true, the client never reads from or populates its internal caches.
- **CLI-only, no browser** — Uses `tsx` to run TypeScript directly in Node.js. The SCSI MIDI transport uses `fetch()` (available in Node 18+) and doesn't need a browser.
- **Same client code as the editor** — The test uses the real `createS3000xlClient()` and `createScsiMidiTransport()`, not a reimplementation. This ensures we're testing the actual code path, minus the browser/React/Playwright layers.
- **Deterministic write-readback pattern** — Every write test saves the original value, writes a known different value, reads back, compares, then restores the original. Tests are non-destructive.
- **Transport-agnostic test runner** — The same test suite can run against SCSI transport or HTTP MIDI transport, allowing direct comparison.

## Implementation Phases

### Phase 1: Add `noCache` Option to S3000XL Client

Add a `noCache` boolean to the client options that completely bypasses all caching.

#### 1.1 Extend Client Options

**Files to modify:**
- `modules/sampler-devices/src/devices/s3000xl/s3000xl-types.ts` — Add `noCache?: boolean` to `S3000xlClientOptions`

#### 1.2 Implement Cache Bypass

**Files to modify:**
- `modules/sampler-devices/src/devices/s3000xl/s3000xl-client.ts` — Guard all cache reads and cache writes with `if (!options.noCache)`

**Cache sites to bypass (all conditional on `!noCache`):**
- Program names cache (RPLIST response)
- Sample names cache (RSLIST response)
- Program header cache (RPDATA response, keyed by program number)
- Keygroup header cache (RKDATA response, keyed by program + keygroup number)
- Sample header cache (RSDATA response, keyed by sample number)

**Behavior when `noCache: true`:**
- `fetchProgramNames()` — always sends RPLIST, never reads/writes cache
- `fetchSampleNames()` — always sends RSLIST, never reads/writes cache
- `fetchProgramHeader(n)` — always sends RPDATA, never reads/writes cache
- `fetchKeygroupHeader(p, k)` — always sends RKDATA, never reads/writes cache
- `fetchSampleHeader(n)` — always sends RSDATA, never reads/writes cache
- Write methods — unchanged (they already send to device; they may still populate cache in the default case, but with noCache they skip cache population)
- `invalidate*Cache()` methods — become no-ops (nothing to invalidate)

**Success criteria:**
- Existing tests pass (noCache defaults to false, no behavior change)
- With `noCache: true`, every fetch method sends a fresh SysEx request

### Phase 2: CLI Test Harness

Build the thin CLI runner that connects to the SCSI bridge and runs tests.

#### 2.1 Harness Entry Point

**Files to create:**
- `scripts/scsi-write-test.ts` — Main CLI entry point

**Usage:**
```bash
tsx scripts/scsi-write-test.ts --bridge-url http://s3k.local:7033
tsx scripts/scsi-write-test.ts --bridge-url http://s3k.local:7033 --verbose
tsx scripts/scsi-write-test.ts --bridge-url http://s3k.local:7033 --test read-only
tsx scripts/scsi-write-test.ts --bridge-url http://s3k.local:7033 --test write-program
tsx scripts/scsi-write-test.ts --midi-url http://localhost:8080  # Compare via MIDI
```

**CLI options:**
- `--bridge-url <url>` — SCSI bridge URL (mutually exclusive with --midi-url)
- `--midi-url <url>` — HTTP MIDI server URL (for comparison tests)
- `--channel <n>` — MIDI/SysEx channel (default: 0)
- `--test <name>` — Run a specific test (default: all)
- `--verbose` — Log all SysEx bytes sent/received
- `--no-restore` — Skip restoring original values after write tests (for debugging)

**Harness setup:**
1. Create transport (SCSI or HTTP MIDI based on CLI args)
2. Create S3000XL client with `noCache: true`
3. Connect and verify sampler is reachable
4. Run selected tests
5. Report results

#### 2.2 SysEx Logging Wrapper

**Files to create:**
- `scripts/lib/logging-midi-io.ts` — MidiIO wrapper that logs all traffic

**Purpose:** Wraps any `MidiIO` adapter and logs every `send()` call and every incoming SysEx message with hex dumps. Enabled by `--verbose` flag.

```typescript
function createLoggingMidiIO(inner: MidiIO, logger: (msg: string) => void): MidiIO
```

**Success criteria:**
- All SysEx traffic visible in console output when `--verbose` is set
- Logs include direction (TX/RX), timestamp, byte count, and hex dump
- Does not interfere with timing or message delivery

### Phase 3: Test Suite — Phase A (No Cache)

The core write-readback tests with caching completely disabled.

#### 3.1 Connection and Read Tests

**Files to create:**
- `scripts/lib/test-connection.ts` — Connection verification
- `scripts/lib/test-reads.ts` — Read-only tests

**Tests:**

| Test | What It Does |
|------|-------------|
| `connect` | Connect to bridge, check `/status`, verify `samplerReachable: true` |
| `scan` | Scan SCSI bus, verify S3000XL appears at expected ID |
| `read-program-names` | Fetch RPLIST, print all program names |
| `read-sample-names` | Fetch RSLIST, print all sample names |
| `read-program-header` | Fetch RPDATA for program 0, print key fields |
| `read-keygroup-header` | Fetch RKDATA for program 0 keygroup 0, print key fields |
| `read-sample-header` | Fetch RSDATA for sample 0, print key fields |

**Success criteria:**
- All reads return valid parsed data
- Program/sample names are non-empty strings
- Headers contain expected field structure

#### 3.2 Write-Readback Tests

**Files to create:**
- `scripts/lib/test-writes.ts` — Write-readback tests

**Test pattern (for each writable data type):**

```
1. READ current value       → save as `original`
2. MODIFY a known field     → create `modified` (change one field to a known different value)
3. WRITE modified value     → send to device
4. WAIT for write flush     → configurable delay (default: 500ms)
5. READ back from device    → save as `readback` (fresh fetch, no cache)
6. COMPARE readback vs modified
   → PASS if readback matches modified (write persisted)
   → FAIL if readback matches original (write did not persist)
   → ERROR if readback matches neither (something else is wrong)
7. RESTORE original value   → write original back to device
8. VERIFY restore           → read back, confirm matches original
```

**Specific write tests:**

| Test | Field Modified | Why This Field |
|------|---------------|----------------|
| `write-program-header` | Program name (12-char string) | Easy to verify visually on device LCD |
| `write-program-polyphony` | Polyphony value | Numeric field, simple comparison |
| `write-keygroup-zone` | Zone 1 low velocity | Numeric field in keygroup |
| `write-sample-header` | Sample name | String field, verifiable on device |

**Success criteria:**
- Each test clearly reports PASS/FAIL with before/after values
- Write-then-read returns the written value (not the original)
- Original value successfully restored after each test
- `--verbose` mode shows exact SysEx bytes for debugging failures

#### 3.3 SDS Round-Trip Test

**Files to create:**
- `scripts/lib/test-sds.ts` — SDS send/receive round-trip

**Test:**
1. Generate a known test sample (e.g., 256-sample sine wave at 44100 Hz)
2. Send to device via SDS (`sendSampleViaSds` with `noCache` client)
3. Wait for device to commit (configurable delay)
4. Receive back from device via SDS (`receiveSampleViaSds`)
5. Compare sent vs received sample data (allow for bit-depth rounding)

**Success criteria:**
- Sent and received audio data match within tolerance
- SDS header fields (sample rate, length, loop points) match
- Progress callbacks fire during both send and receive

### Phase 4: Test Suite — Phase B (Cache Validation)

Contingent on Phase A (Phase 3) passing — if writes work with no cache, test whether caching introduces the readback failure.

#### 4.1 Cache-Enabled Write-Readback Tests

**Files to create:**
- `scripts/lib/test-cache.ts` — Cache behavior tests

**Tests:**

| Test | What It Does |
|------|-------------|
| `cache-stale-read` | Write a field, read back WITHOUT invalidating cache — expect stale (old) value. Confirms cache is active. |
| `cache-invalidate-read` | Write a field, invalidate cache, read back — expect fresh (new) value. Confirms invalidation works. |
| `cache-write-invalidates` | If the client should auto-invalidate on write: write, read back — expect fresh value without explicit invalidation. |

**Success criteria:**
- With cache enabled and no invalidation, reads return stale data (proves cache is working)
- With cache enabled and proper invalidation, reads return fresh data
- If auto-invalidation is expected on writes, verify it happens

### Phase 5: MIDI Comparison (Optional)

Run the same test suite over regular MIDI to compare behavior.

#### 5.1 MIDI Transport Support

**Files to modify:**
- `scripts/scsi-write-test.ts` — Add `--midi-url` option that creates `httpMidiTransport` instead of SCSI transport

**Purpose:** If SCSI writes fail but MIDI writes succeed, the problem is in the SCSI transport chain. If both fail, the problem is in the client or protocol layer.

**Success criteria:**
- Same tests produce same output format regardless of transport
- Results clearly labeled with transport type for comparison

## Task Breakdown

| # | Task | Phase | Est. |
|---|------|-------|------|
| 1 | Add `noCache` option to `S3000xlClientOptions` | 1.1 | 0.25d |
| 2 | Implement cache bypass in client methods | 1.2 | 0.5d |
| 3 | Build CLI entry point with arg parsing | 2.1 | 0.5d |
| 4 | Build SysEx logging wrapper | 2.2 | 0.25d |
| 5 | Implement connection and read tests | 3.1 | 0.5d |
| 6 | Implement write-readback tests (no cache) | 3.2 | 1d |
| 7 | Implement SDS round-trip test | 3.3 | 0.5d |
| 8 | Run Phase A against live hardware, document results | 3 | 0.5d |
| 9 | Implement cache validation tests (Phase B) | 4.1 | 0.5d |
| 10 | Add MIDI transport option for comparison | 5.1 | 0.25d |

## Dependencies

- Phase 1 has no dependencies (client change only)
- Phase 2 depends on Phase 1 (needs `noCache` option)
- Phase 3 depends on Phase 2 (needs CLI harness)
- Phase 4 depends on Phase 3 passing (only runs if no-cache writes succeed)
- Phase 5 is independent (can run anytime after Phase 2)
