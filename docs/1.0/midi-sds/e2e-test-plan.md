# MIDI SDS E2E Test Plan

**Feature:** MIDI Sample Dump Standard (SDS)
**Module:** `akai-s3k-editor`
**Test file:** `modules/akai-s3k-editor/e2e/device-sds-transfer.spec.ts`
**Run via:** `make test-e2e-s3k-device ARGS="--grep 'SDS'"`

## Prerequisites

- Akai S3000XL connected via MIDI loop (bidirectional)
- At least one sample loaded in device memory
- Device EXCL page set to: protocol=STANDARD, channel=1
- midi-server built and available (`make check-midi-server`)

## Test Infrastructure

Tests use the existing S3000XL e2e infrastructure:
- `run-http-midi-e2e.sh` starts midi-server + Vite dev server
- `connection-helper.ts` provides `connectToDevice()`, `waitForAppReady()`
- HTTP MIDI transport bridges Playwright to hardware
- Test timeout: 60s per test (SDS transfers are slow over MIDI)

## Test Suites

### 1. Samples Page Navigation

**Purpose:** Verify the Samples page loads and shows device samples.

| # | Test | Verification |
|---|------|-------------|
| 1.1 | Samples nav link is visible after connection | `a[href*="samples"]` exists in nav |
| 1.2 | Samples page loads and shows sample dropdown | Navigate to `/samples`, dropdown is visible |
| 1.3 | Sample dropdown is populated from device | Dropdown has more than 1 option (not just placeholder) |
| 1.4 | Sample names match device contents | At least one option has a non-empty name |

### 2. Receive from Device (SDS Dump Request)

**Purpose:** Verify the app can request and receive a sample via SDS.

**Approach:** This is the critical round-trip test. The app sends a dump request, the S3000XL responds with the sample data, and the app displays the result.

| # | Test | Steps | Verification |
|---|------|-------|-------------|
| 2.1 | Receive button is disabled with no selection | Load page | "Receive from Device" button is disabled |
| 2.2 | Receive button enables on sample selection | Select a sample from dropdown | Button is enabled |
| 2.3 | Receive completes successfully | Select sample, click "Receive from Device" | Progress bar appears, reaches 100%, received sample info is displayed |
| 2.4 | Received sample shows correct metadata | After receive | Sample number, sample rate, bit depth, sample count, loop info displayed |
| 2.5 | Download as WAV works | After receive, click "Download as WAV" | File download triggers, file is non-empty |
| 2.6 | Progress bar shows during transfer | During receive | Progress percentage updates, packet counts visible |
| 2.7 | Second receive replaces first result | Receive sample A, then receive sample B | Sample B info replaces sample A info |

### 3. Send to Device (WAV Upload via SDS)

**Purpose:** Verify the app can send a WAV file to the device via SDS.

**Approach:** Use Playwright's `fileChooser` event to upload a test WAV file, then verify the transfer completes. Round-trip verification: receive the same sample back and compare metadata.

**Test fixture:** Generate a known WAV file programmatically in the test setup (e.g., 100 samples of a sine wave at 44100Hz, 16-bit mono). Write it to a temp file or use Playwright's `setInputFiles()`.

| # | Test | Steps | Verification |
|---|------|-------|-------------|
| 3.1 | Send button enables on sample selection | Select a sample slot | "Send to Device" button is enabled |
| 3.2 | File picker opens on Send click | Click "Send to Device" | File dialog opens (verify via `fileChooser` event) |
| 3.3 | WAV file info is displayed after selection | Select a WAV file | File name, sample rate, bit depth, sample count shown |
| 3.4 | Send completes successfully | Select file, transfer runs | Progress bar reaches 100%, no error displayed |
| 3.5 | Invalid file shows error | Upload a non-WAV file | Parse error message displayed |

### 4. Round-Trip Verification

**Purpose:** The most important test — verify data integrity across send and receive.

**Approach per CLAUDE.md e2e tenet #4:**

```
Library (fixture) ──send──► Device ──receive──► Library (result)
       │                                              │
       └──────────── compare for equality ────────────┘
```

| # | Test | Steps | Verification |
|---|------|-------|-------------|
| 4.1 | Send then receive produces matching sample | 1. Generate known WAV fixture (e.g., 256 samples, 44100Hz, 16-bit sine wave) | Received sample length matches sent length |
|     |                                            | 2. Send to device at sample slot N | Received sample rate matches sent sample rate |
|     |                                            | 3. Receive from device at slot N | Sample data matches (or is within quantization tolerance) |
|     |                                            | 4. Compare | |
| 4.2 | Round-trip preserves loop points | Send WAV with known length, receive back | Loop start/end in received header are plausible (may be device-default if SDS doesn't carry loop metadata from WAV) |

**Note on 4.1:** The SDS protocol encodes 16-bit samples into 7-bit MIDI bytes with left-justification, then decodes back. The round-trip should be lossless for 16-bit data. If samples don't match exactly, log the differences for debugging.

### 5. Error Handling

**Purpose:** Verify the UI handles error conditions gracefully.

| # | Test | Steps | Verification |
|---|------|-------|-------------|
| 5.1 | Receive with no device shows error | Disconnect device, try receive | Error message displayed (timeout or connection error) |
| 5.2 | Send with no device shows error | Disconnect device, try send | Error message displayed |
| 5.3 | Invalid WAV format shows parse error | Upload a .txt file renamed to .wav | Parse error displayed, no transfer initiated |
| 5.4 | Error clears on new action | Trigger error, then select new sample | Error message clears |

### 6. UI State Management

**Purpose:** Verify the UI state is consistent during and after transfers.

| # | Test | Steps | Verification |
|---|------|-------|-------------|
| 6.1 | Buttons disabled during transfer | Start a receive | Both Send and Receive buttons disabled, dropdown disabled |
| 6.2 | Dropdown disabled during transfer | Start a receive | Sample select dropdown is disabled |
| 6.3 | Changing sample clears previous result | Receive sample A, change dropdown to B | Sample A info is cleared |
| 6.4 | Navigation away during idle is safe | Receive a sample, navigate to Programs, return to Samples | No crash, page loads cleanly (result may be cleared) |

## Test Fixture Generation

Tests that need WAV files should generate them programmatically:

```typescript
function generateTestWav(numSamples: number, sampleRate: number): Buffer {
  // Generate a 16-bit mono PCM WAV with a known waveform
  // (e.g., triangle wave for easy visual verification)
  const header = Buffer.alloc(44);
  const data = Buffer.alloc(numSamples * 2);
  // ... write RIFF header and sample data ...
  return Buffer.concat([header, data]);
}
```

This avoids depending on external fixture files and ensures reproducible test data.

## Implementation Notes

- Tests interact with the app UI, not raw MIDI APIs (per e2e tenets)
- No mocking — real MIDI hardware, real browser, real transfer
- No query parameter shortcuts or special test modes
- Tests should clean up: if a sample was sent to the device, the test doesn't need to delete it (S3000XL sample slots are overwritable)
- Timeouts should be generous (60s) since SDS transfers over MIDI are slow (~25s for 22K samples)
- Use `test.describe.serial()` for the round-trip test (4.1) since send must precede receive

## Priority Order

1. **Suite 2 (Receive)** — most important, validates core SDS path end-to-end
2. **Suite 4 (Round-trip)** — validates data integrity
3. **Suite 1 (Navigation)** — quick smoke tests
4. **Suite 3 (Send)** — validates upload path
5. **Suite 6 (UI state)** — validates UX
6. **Suite 5 (Error handling)** — edge cases
