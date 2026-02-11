# D-110 Integration Tests

This directory contains integration tests for the Roland D-110 synthesizer editor.

## Test Types

### Virtual MIDI Tests (`d110-sysex.test.ts`)

Tests SysEx message generation and parsing using virtual MIDI ports. These run without hardware and are included in the normal test suite.

```bash
pnpm test
```

### Hardware Integration Tests (`d110-hardware.test.ts`)

Tests real hardware communication with an actual Roland D-110. These require:

- Physical Roland D-110 synthesizer
- MIDI interface (default: "Volt 4")
- MIDI cables connecting interface to D-110
- D-110 powered on and set to correct device ID

## Running Hardware Tests

### Prerequisites

1. Connect your D-110 to a MIDI interface
2. Ensure the MIDI interface is recognized by your system
3. Power on the D-110
4. Set the D-110's device ID (default: 17)

### Run the Tests

```bash
# From the d110-editor directory
pnpm test:hardware
```

### Using a Different MIDI Interface

```bash
MIDI_DEVICE_NAME="My Interface" pnpm test:hardware
```

### Using a Different Device ID

The D-110 device ID is set in its system settings (17-32). If your D-110 uses a different ID:

```bash
D110_DEVICE_ID=18 pnpm test:hardware
```

### Skipping Hardware Tests

Hardware tests are automatically skipped when:
- The MIDI device is not found
- `SKIP_HARDWARE_TESTS=true` environment variable is set

```bash
SKIP_HARDWARE_TESTS=true pnpm test
```

## Test Coverage

### Connection Tests
- MIDI port detection
- Client initialization

### Low-Level SysEx Tests
- RQ1 request/response cycle
- Message parsing and validation

### System Parameter Tests
- Fetch system parameters (reverb, partial reserve, MIDI channels)
- Modify and verify reverb settings
- Restore original values

### Part Configuration Tests
- Fetch individual part configurations
- Fetch all 8 parts
- Modify and verify part output level
- Restore original values

### Tone Data Tests
- Fetch temporary tone data
- Validate parameter ranges
- Parse tone structure (common + 4 partials)

### Error Handling Tests
- Timeout with wrong device ID
- Invalid parameter validation

### Full Patch Tests
- Fetch complete patch (system + 8 parts)

## D-110 Protocol Notes

### SysEx Format

```
F0 41 [dev] 16 [cmd] [AA] [BB] [CC] [data...] [checksum] F7
```

| Byte | Description |
|------|-------------|
| F0 | SysEx start |
| 41 | Roland manufacturer ID |
| dev | Device ID (0x10-0x1F) |
| 16 | D-110 model ID |
| cmd | 0x11 (RQ1) or 0x12 (DT1) |
| AA BB CC | 3-byte address |
| data | Parameter data |
| checksum | Roland checksum |
| F7 | SysEx end |

### Memory Map

| Address | Description | Size |
|---------|-------------|------|
| 0x03:pp:00 | Part pp timbre | 16 bytes |
| 0x04:xx:xx | Temporary tones | 246 bytes each |
| 0x06:pp:00 | Patch pp memory | 138 bytes |
| 0x08:tt:00 | Tone tt RAM | 256 bytes |
| 0x10:00:00 | System parameters | 33 bytes |

### Checksum Calculation

```typescript
function checksum(data: number[]): number {
  let sum = 0;
  for (const byte of data) {
    sum += byte;
  }
  sum = sum & 0x7F;           // mod 128
  sum = 0x80 - sum;           // subtract from 128
  if (sum === 0x80) sum = 0;  // if 128, return 0
  return sum;
}
```

## Troubleshooting

### MIDI Device Not Found

```
Error: MIDI device "Volt 4" not found.
```

**Solutions:**
- Check MIDI interface is connected and powered
- Verify device name matches: run test to see available ports
- Set `MIDI_DEVICE_NAME` environment variable
- Check MIDI driver installation

### D-110 Not Responding

```
Error: Timeout waiting for D-110 response
```

**Solutions:**
- Ensure D-110 is powered on
- Check MIDI cables (IN to OUT, OUT to IN)
- Verify device ID matches (check D-110 system settings)
- Confirm D-110 is not in a mode that blocks SysEx

### Wrong Values Read Back

**Solutions:**
- Verify device ID is correct
- Check that no other software is sending MIDI to D-110
- Ensure D-110 memory protect is OFF

## Adding New Tests

1. Follow existing patterns for setup/teardown
2. Support `SKIP_HARDWARE_TESTS` environment variable
3. Always restore modified values
4. Use descriptive console output
5. Set appropriate timeouts
