# Integration Tests

Hardware integration tests for Launch Control XL 3 device.

## Requirements

- Launch Control XL 3 device connected via USB
- Node.js 18+ with pnpm installed
- Device must be powered on and visible to system MIDI

## Running Integration Tests

### Default: Skip if Device Not Connected

```bash
# Run with automatic device detection (skips if SKIP_HARDWARE_TESTS=true)
pnpm test:integration
```

By default, tests will be SKIPPED unless device is connected.

### Force Skip (for CI/CD)

```bash
# Explicitly skip hardware tests
pnpm test:integration:skip

# Or set env var manually
SKIP_HARDWARE_TESTS=true pnpm test:integration
```

### Force Run (requires hardware)

```bash
# Force tests to run (will fail if device not connected)
pnpm test:integration:force

# Or set env var manually
SKIP_HARDWARE_TESTS=false pnpm test:integration
```

## Test Suites

### slot-selection.hardware.test.ts

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

## Configuration

Integration tests use a separate Vitest config:

- **Config file:** `vitest.integration.config.ts`
- **Execution:** Sequential (one device, no parallel tests)
- **Timeouts:** 30s test, 15s hooks (longer for hardware)
- **Retries:** 0 (show real hardware issues)
- **Reporter:** Verbose (detailed hardware operation logs)

## Differences from Unit Tests

| Aspect | Unit Tests | Integration Tests |
|--------|------------|-------------------|
| Config | `vitest.config.ts` | `vitest.integration.config.ts` |
| Execution | Parallel (threads) | Sequential (single fork) |
| Timeout | 5s test, 3s hooks | 30s test, 15s hooks |
| Requires hardware | No | Yes (or skipped) |
| Run in CI | Yes (always) | Only if device available |

## Troubleshooting

### Tests Skip Automatically

This is EXPECTED behavior if:
- `SKIP_HARDWARE_TESTS=true` is set
- Device not connected
- Device not accessible to Node.js MIDI

**Solution:** Connect device and use `pnpm test:integration:force`

### Connection Timeout

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

### Status 0x9 Error

```
Error: Device returned status 0x9 (slot not selected)
```

**This should NOT happen after fix.** If it does:
1. Verify you're on branch `fix/issue-36-correct-device-id`
2. Check that `DeviceManager.writeCustomMode()` calls `selectTemplate()`
3. Verify device ID is 0x02 in SysEx messages

### Mock Tests Always Run

The file includes a mock test suite that runs even when hardware tests are skipped:

```typescript
describe('Slot Selection Mock Tests', () => {
  it('should handle connection failure gracefully', async () => {
    // This test runs even with SKIP_HARDWARE_TESTS=true
  });
});
```

This is intentional - ensures test file syntax is valid even without hardware.

## Adding New Integration Tests

1. Create test file in `test/integration/`
2. Use `describe.skipIf(SKIP_HARDWARE_TESTS)` wrapper
3. Set appropriate timeouts (hardware is slower than mocks)
4. Clean up device state in `afterEach` or `afterAll`
5. Document what hardware scenario is being tested

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

## Performance Expectations

Typical test suite execution times (with device connected):

- Single slot write: ~2-3s (including 100ms delay)
- Multiple slot writes: ~5-10s (3 slots)
- Rapid switching: ~4-6s (3 slots)
- Full read-modify-write: ~4-5s

Total suite: ~30-60s

## CI/CD Integration

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

## Related Documentation

- [`docs/PROTOCOL.md`](../../docs/PROTOCOL.md) - Device protocol specification
- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) - Code architecture
- [Issue #36](https://github.com/user/repo/issues/36) - Slot selection fix
