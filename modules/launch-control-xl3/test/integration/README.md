# Launch Control XL3 Integration Tests

This directory contains integration tests that validate the Launch Control XL3 library against real hardware. These tests include both hardware-dependent tests (using Vitest) and standalone utility tests (using tsx).

## Test Categories

### 1. Vitest Hardware Tests (CI/CD Compatible)

Located in `*.hardware.test.ts` files, these tests use Vitest and can be skipped if hardware is unavailable.

### 2. Standalone Utility Tests (Manual Execution)

Located in standalone `.test.ts` files, these are executable TypeScript files for manual validation and debugging.

---

## Vitest Hardware Tests

### Requirements

- Launch Control XL 3 device connected via USB
- Node.js 18+ with pnpm installed
- Device must be powered on and visible to system MIDI

### Running Vitest Hardware Tests

#### Default: Skip if Device Not Connected

```bash
# Run with automatic device detection (skips if SKIP_HARDWARE_TESTS=true)
pnpm test:integration
```

By default, tests will be SKIPPED unless device is connected.

#### Force Skip (for CI/CD)

```bash
# Explicitly skip hardware tests
pnpm test:integration:skip

# Or set env var manually
SKIP_HARDWARE_TESTS=true pnpm test:integration
```

#### Force Run (requires hardware)

```bash
# Force tests to run (will fail if device not connected)
pnpm test:integration:force

# Or set env var manually
SKIP_HARDWARE_TESTS=false pnpm test:integration
```

### Vitest Test Suites

#### slot-selection.hardware.test.ts

Tests the fix for Issue #36: Device firmware rejects writes to inactive slots.

**What it validates:**
- `selectTemplate()` uses correct device ID (0x02, not 0x11)
- Writing to inactive slots succeeds without status 0x9 errors
- Device properly acknowledges slot selection
- Sequential slot switching works correctly
- Timing delays are appropriate (100ms after slot selection)

**Test scenarios:**
1. Write to single inactive slot (slot 1)
2. Write to multiple inactive slots sequentially (slots 3, 5, 7)
3. Rapid slot switching (slots 2, 4, 6)
4. Protocol validation (selectTemplate called before write)
5. Device ID validation (0x02 in SysEx)
6. Error handling (factory slot 15, invalid slots)
7. Timing validation (100ms delay after selection)
8. Full read-modify-write cycle

---

## Standalone Utility Tests

These tests are executable TypeScript files that can be run directly with `tsx`. They're useful for manual validation, debugging, and protocol investigation.

### Prerequisites

#### Hardware Requirements
- **Novation Launch Control XL3** connected via USB
- **macOS or Linux** (MIDI port names may differ on other platforms)
- **Configured custom modes** in slots 3 and 10 recommended

#### Software Requirements
- Node.js 18+ with TypeScript support
- `tsx` runtime for executing TypeScript tests
- `midi` npm package (node-midi) for low-level MIDI access

### Available Standalone Tests

#### 1. Custom Mode Write and Verify (`custom-mode-write-verify.test.ts`)

**Purpose:** Validates that CustomMode API changes are correctly written to the device and can be read back with all modifications preserved. **Now includes 18-character mode name testing.**

**What it tests:**
- ✓ CustomMode read/write API
- ✓ Device firmware accepts valid modifications
- ✓ Data integrity through write/read cycle
- ✓ Control property changes (CC, channel, name)
- ✓ **18-character mode names** (protocol v2 validation)

**Test Suites:**

**Suite 1: Standard Property Changes**
- Tests mode name changes (short names)
- Tests control CC number modifications
- Tests control MIDI channel changes
- Tests control name changes
- Typically validates 13-16 property changes

**Suite 2: 18-Character Mode Names** (NEW)
- Tests 17-character names (under limit)
- Tests exactly 18-character names (at limit)
- Tests 18-character names with mixed case
- Tests 9-character names (over old 8-char limit)
- Validates round-trip persistence
- Character-by-character verification on mismatch

**Test flow:**
1. Read custom mode from slot 10 using library API
2. Make VALID changes using CustomMode structure
3. Write modified mode to slot 3
4. Read back from slot 3
5. Verify all changes were preserved

**Prerequisites:**
- Slot 10 must contain a configured custom mode with controls
- Slot 3 can be overwritten (test data will be written here)

**Usage:**
```bash
npx tsx test/integration/custom-mode-write-verify.test.ts
```

**Expected results:**
- **Suite 1:** All property changes should be preserved (name, CC numbers, channels)
- **Suite 2:** All 18-character mode names should write and read back identically
- Test saves detailed results to:
  - `/Users/orion/work/ol_dsp/modules/audio-control/tmp/custom-mode-write-verify-standard-*.json`
  - `/Users/orion/work/ol_dsp/modules/audio-control/tmp/custom-mode-write-verify-18char-*.json`

**Test cases for 18-character names:**
- `17CharacterMode1` - 17 characters (under limit)
- `EXACTLY18CHARSLONG` - Exactly 18 characters (at limit)
- `18CharModeName123` - 18 characters with mixed case
- `ShortName` - 9 characters (over old 8-char limit)

**Related issues:** #36

---

#### 2. Raw MIDI Round-Trip Validation (`raw-midi-round-trip.test.ts`)

**Purpose:** Validates byte-level data integrity through a complete write/read cycle using direct SysEx protocol.

**What it tests:**
- ✓ Novation SysEx protocol write sequence
- ✓ Device firmware data storage integrity
- ✓ No corruption during write/read operations
- ✓ Correct implementation of DAW port slot selection

**Test flow:**
1. Read raw bytes from slot 10 (known good)
2. Write those exact bytes to slot 3 using Novation protocol
3. Read back from slot 3
4. Compare byte-by-byte and report differences

**Prerequisites:**
- Slot 10 must contain valid custom mode data
- Slot 3 can be overwritten (test data will be written here)

**Usage:**
```bash
npx tsx test/integration/raw-midi-round-trip.test.ts
```

**Expected results:**
- 100% byte-for-byte match between source and read-back data
- No differences in page 0 or page 3
- Test saves detailed comparison to `/Users/orion/work/ol_dsp/modules/audio-control/tmp/raw-midi-round-trip-*.json`

**Protocol details:**
- Uses command 0x45 for write operations
- Uses command 0x77 (template change) for slot selection
- Follows Novation's documented write sequence: write page 0, send 0x77, write page 0 again, write page 3

**Related issues:** #36

---

#### 3. Basic Read Operations (`basic-read-operations.test.ts`)

**Purpose:** Validates fundamental device communication and read operations using direct SysEx protocol.

**What it tests:**
- ✓ Basic MIDI port communication
- ✓ SysEx message sending and receiving
- ✓ Device response to read commands
- ✓ Command 0x77 (template change) functionality
- ✓ Slot selection independence

**Test flow:**
1. Read from slot 10
2. Send command 0x77 to select slot 3
3. Read from slot 3
4. Read from slot 10 again to verify slot independence

**Prerequisites:**
- Slots 3 and 10 should contain custom modes (any configuration)

**Usage:**
```bash
npx tsx test/integration/basic-read-operations.test.ts
```

**Expected results:**
- Each read should return ~270 bytes (SysEx header + 256 bytes data + footer)
- Response lengths should be consistent across reads
- Slot 10 data should be identical in Test 1 and Test 4

**Protocol details:**
- Uses command 0x40 for read operations
- Each page read returns ~260+ bytes
- Command 0x77 changes the active template slot

---

### Running All Standalone Tests

To run all standalone tests sequentially:

```bash
# Run each test individually
npx tsx test/integration/basic-read-operations.test.ts
npx tsx test/integration/raw-midi-round-trip.test.ts
npx tsx test/integration/custom-mode-write-verify.test.ts
```

**Note:** Tests are not designed to run in parallel as they may interfere with each other's device state.

### Test Results

#### Success Criteria

Each standalone test defines its own success criteria:

1. **basic-read-operations.test.ts**
   - ✓ All reads return expected byte counts (~270 bytes)
   - ✓ No communication errors

2. **raw-midi-round-trip.test.ts**
   - ✓ 100% byte match between source and read-back
   - ✓ No data corruption in page 0 or page 3

3. **custom-mode-write-verify.test.ts**
   - ✓ Suite 1: All property modifications preserved (name, CC, channel)
   - ✓ Suite 1: Typically 13-16 individual property changes verified
   - ✓ Suite 2: All 4 test cases for 18-character names pass
   - ✓ Suite 2: Names write and read back byte-for-byte identical

#### Result Files

All standalone tests save detailed results to `/Users/orion/work/ol_dsp/modules/audio-control/tmp/`:

- `basic-read-operations-*.json` - Communication test results
- `raw-midi-round-trip-*.json` - Byte-level comparison data
- `custom-mode-write-verify-standard-*.json` - Property verification details (Suite 1)
- `custom-mode-write-verify-18char-*.json` - 18-character name test details (Suite 2)

---

## Configuration

### Vitest Integration Tests Config

Integration tests use a separate Vitest config:

- **Config file:** `vitest.integration.config.ts`
- **Execution:** Sequential (one device, no parallel tests)
- **Timeouts:** 30s test, 15s hooks (longer for hardware)
- **Retries:** 0 (show real hardware issues)
- **Reporter:** Verbose (detailed hardware operation logs)

### Differences from Unit Tests

| Aspect | Unit Tests | Integration Tests (Vitest) | Standalone Tests |
|--------|------------|---------------------------|------------------|
| Config | `vitest.config.ts` | `vitest.integration.config.ts` | N/A (tsx) |
| Execution | Parallel (threads) | Sequential (single fork) | Manual |
| Timeout | 5s test, 3s hooks | 30s test, 15s hooks | No timeout |
| Requires hardware | No | Yes (or skipped) | Yes |
| Run in CI | Yes (always) | Only if device available | No |

---

## Protocol Features Validated

### SysEx Commands Tested

| Command | Purpose | Tested By |
|---------|---------|-----------|
| 0x40 | Read custom mode page | All tests |
| 0x45 | Write custom mode page | raw-midi-round-trip, custom-mode-write-verify, slot-selection |
| 0x77 | Select template slot (DAW port) | All tests |

### Data Integrity Checks

- **Byte-level:** `raw-midi-round-trip.test.ts` validates exact byte preservation
- **Property-level:** `custom-mode-write-verify.test.ts` validates structured data
- **Communication:** `basic-read-operations.test.ts` validates protocol basics
- **Slot selection:** `slot-selection.hardware.test.ts` validates pre-selection requirement
- **18-char names:** `custom-mode-write-verify.test.ts` Suite 2 validates protocol v2 extended names

### Custom Mode Properties Validated

The tests verify these CustomMode properties:
- `name` (18 characters max - protocol v2)
- `controls` object with 48 control mappings
- Control properties: `ccNumber`, `midiChannel`, `name`
- Label parsing and encoding
- Color configurations
- LED states (if present)

---

## Troubleshooting

### Common Issues for Vitest Tests

#### Tests Skip Automatically

This is EXPECTED behavior if:
- `SKIP_HARDWARE_TESTS=true` is set
- Device not connected
- Device not accessible to Node.js MIDI

**Solution:** Connect device and use `pnpm test:integration:force`

#### Connection Timeout

```
Error: Connection timeout after 15000ms
```

**Possible causes:**
1. Device not powered on
2. USB cable disconnected
3. MIDI driver issue (check system MIDI devices)
4. Device in bootloader mode (disconnect and reconnect)

**Solution:**
- Check USB connection
- Verify device appears in system MIDI devices
- Restart device (unplug/replug USB)

#### Status 0x9 Error

```
Error: Device returned status 0x9 (slot not selected)
```

**This should NOT happen after fix.** If it does:
1. Verify you're on branch `fix/issue-36-correct-device-id`
2. Check that `DeviceManager.writeCustomMode()` calls `selectTemplate()`
3. Verify device ID is 0x02 in SysEx messages

### Common Issues for Standalone Tests

#### "Port 'LCXL3 1 MIDI Out' not found"

- Ensure device is connected via USB
- Check MIDI port names with:
  ```bash
  npx tsx -e "const m = require('midi'); const o = new m.Output(); for(let i=0; i<o.getPortCount(); i++) console.log(i, o.getPortName(i));"
  ```
- Update port names in test files if different on your platform

#### "No response from device"

- Verify device is powered on
- Check USB connection
- Close any other applications using the device (DAW, Components, etc.)
- Try re-plugging the USB cable

#### "Slot 10 has no controls"

- Load a factory preset into slot 10 using Components
- Or use a different source slot by editing the test file

#### 18-Character Mode Name Test Failures

If Suite 2 tests fail:
- Check that you're using the latest protocol version (v2)
- Verify device firmware supports 18-character names
- Check result JSON for character-by-character comparison
- Ensure no truncation at 8 characters (old limit)

#### Test timeouts

- Increase delay times in test files (currently 1000ms for reads, 500ms for writes)
- Device may be slower on some systems

### Debug Mode

Enable verbose MIDI logging by modifying standalone test files:

```typescript
// Add after midiInput setup
midiInput.on('message', (deltaTime: number, message: number[]) => {
  console.log('MIDI:', message.map(b => b.toString(16).padStart(2, '0')).join(' '));
  lastResponse = Array.from(message);
});
```

---

## Development Workflow

### Adding New Vitest Integration Tests

1. Create test file in `test/integration/` with `*.hardware.test.ts` suffix
2. Use `describe.skipIf(SKIP_HARDWARE_TESTS)` wrapper
3. Set appropriate timeouts (hardware is slower than mocks)
4. Clean up device state in `afterEach` or `afterAll`
5. Document what hardware scenario is being tested
6. Update this README

Example:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DeviceManager } from '@/device/DeviceManager.js';
import { JuceMidiBackend } from '@/backends/JuceMidiBackend.js';

const SKIP_HARDWARE_TESTS = process.env.SKIP_HARDWARE_TESTS === 'true';

describe.skipIf(SKIP_HARDWARE_TESTS)('My Hardware Feature', () => {
  let deviceManager: DeviceManager;
  let backend: JuceMidiBackend;

  beforeAll(async () => {
    backend = new JuceMidiBackend();
    await backend.initialize();

    deviceManager = new DeviceManager({
      midiBackend: backend,
      autoConnect: false,
    });

    await deviceManager.initialize();
    await deviceManager.connect();
  }, 15000);

  afterAll(async () => {
    if (deviceManager) {
      await deviceManager.disconnect();
      await deviceManager.cleanup();
    }
    if (backend) {
      await backend.cleanup();
    }
  });

  it('should test hardware feature', async () => {
    // Your test here
  }, 20000); // 20s timeout for hardware operation
});
```

### Adding New Standalone Tests

1. Create new test file in `test/integration/` with `.test.ts` suffix (NOT `.hardware.test.ts`)
2. Add JSDoc header with purpose, prerequisites, validation points
3. Use consistent test structure (setup, execute, verify, teardown)
4. Save results to `/Users/orion/work/ol_dsp/modules/audio-control/tmp/`
5. Update this README with test documentation
6. Add executable shebang: `#!/usr/bin/env tsx`

### Test Naming Convention

- **Vitest tests:** `{feature}.hardware.test.ts`
- **Standalone tests:** `{feature}-{operation}.test.ts`
- Examples: `slot-selection.hardware.test.ts`, `custom-mode-write-verify.test.ts`
- Avoid generic names like `test1.ts`, `integration-test.ts`

### Protocol Validation Checklist

When validating new protocol features:
- [ ] Test with real hardware
- [ ] Verify byte-level correctness
- [ ] Test edge cases (empty controls, max values, etc.)
- [ ] Document discovery methodology
- [ ] Update `docs/PROTOCOL.md`
- [ ] Create test fixture in `backup/`

---

## Performance Expectations

### Vitest Hardware Tests

Typical test suite execution times (with device connected):

- Single slot write: ~2-3s (including 100ms delay)
- Multiple slot writes: ~5-10s (3 slots)
- Rapid switching: ~4-6s (3 slots)
- Full read-modify-write: ~4-5s

Total suite: ~30-60s

### Standalone Tests

- Basic read operations: ~5-10s
- Raw MIDI round-trip: ~10-15s
- Custom mode write/verify (both suites): ~25-35s
  - Suite 1 (standard): ~10-15s
  - Suite 2 (18-char names): ~15-20s (4 test cases)

---

## CI/CD Integration

### Vitest Tests in CI/CD

In CI/CD pipelines where hardware is not available:

```yaml
# GitHub Actions example
- name: Run integration tests (skip if no device)
  run: pnpm test:integration
  continue-on-error: true  # Don't fail pipeline if device not available
```

Or explicitly skip:

```yaml
- name: Run integration tests (CI - skip hardware)
  run: pnpm test:integration:skip
```

### Standalone Tests in CI/CD

Standalone tests should NOT be run in CI/CD pipelines as they require hardware and manual execution.

---

## Related Documentation

- **Protocol Specification:** [`docs/PROTOCOL.md`](../../docs/PROTOCOL.md)
- **Architecture Overview:** [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)
- **Maintenance Guide:** [`docs/MAINTENANCE.md`](../../docs/MAINTENANCE.md)
- **Issue #36:** Slot selection fix

---

## Contributing

When adding integration tests:
1. Follow existing test structure and documentation patterns
2. Ensure tests are self-contained and don't depend on specific device state
3. Add comprehensive JSDoc headers for standalone tests
4. Update this README with test documentation
5. Test against real hardware before committing
6. Choose appropriate test type (Vitest vs standalone)

---

## Questions or Issues

For protocol questions or test failures:
1. Check `docs/PROTOCOL.md` for specification details
2. Review MIDI captures in `/Users/orion/work/ol_dsp/modules/audio-control/tmp/`
3. Compare against working backup fixtures in `backup/`
4. Consult `docs/MAINTENANCE.md` for documentation requirements
