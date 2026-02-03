# Hardware Integration Tests

This directory contains integration tests that communicate with actual hardware samplers via MIDI.

## Overview

Hardware integration tests validate real-world MIDI communication with vintage samplers. These tests require physical hardware and are skipped by default in CI/CD pipelines.

## Available Tests

### Roland S-330 Hardware Test (`s330-hardware.test.ts`)

Comprehensive test suite for Roland S-330 sampler communication using the RQD/DAT/WSD protocol.

**Test Coverage:**
- MIDI connection establishment
- RQD/DAT protocol for reading patch data
- Patch parameter parsing and validation
- WSD/DAT/EOD protocol for writing patch data
- Change persistence verification
- Original value restoration
- Error handling and timeouts

**Requirements:**
- Physical Roland S-330 sampler
- MIDI interface (default: "Volt 4")
- MIDI cables connecting interface to S-330
- S-330 powered on and responsive

## Running Hardware Tests

### Prerequisites

1. Connect your S-330 to a MIDI interface
2. Ensure the MIDI interface is recognized by your system
3. Power on the S-330

### Running the S-330 Test

```bash
# From the sampler-devices directory
pnpm test:hardware:s330
```

### Using a Different MIDI Interface

If your MIDI interface has a different name, set the `MIDI_DEVICE_NAME` environment variable:

```bash
MIDI_DEVICE_NAME="My Interface" pnpm test:hardware:s330
```

### Skipping Hardware Tests

Hardware tests are automatically skipped when:
- The MIDI device is not found
- `SKIP_HARDWARE_TESTS=true` environment variable is set

To explicitly skip:

```bash
SKIP_HARDWARE_TESTS=true pnpm test
```

## Test Flow

### S-330 Hardware Test Flow

1. **Connection Phase**
   - Detects available MIDI ports
   - Connects to specified MIDI interface
   - Initializes S330Client

2. **Read Phase**
   - Requests patches 1-32 using RQD command
   - Receives DAT packets from S-330
   - Combines and denibblizes patch data
   - Parses patch structure

3. **Validation Phase**
   - Extracts test patch (patch 1)
   - Validates parameter ranges
   - Stores original values

4. **Modification Phase**
   - Modifies patch parameters (level, bender range)
   - Nibblizes modified data
   - Sends via WSD/DAT/EOD handshake

5. **Verification Phase**
   - Re-fetches patches
   - Confirms modifications persisted
   - Validates new values

6. **Restoration Phase**
   - Sends original patch data back
   - Verifies restoration succeeded
   - Confirms original values restored

## Protocol Details

### Roland S-330 Protocol

The S-330 uses a unique handshake-based protocol, unlike most Roland devices:

**Commands:**
- `RQD (0x41)`: Request data - returns DAT or RJC
- `WSD (0x40)`: Want to send data - returns ACK or RJC
- `DAT (0x42)`: Data transfer packet (bidirectional)
- `ACK (0x43)`: Acknowledge receipt
- `EOD (0x45)`: End of data transfer
- `ERR (0x4E)`: Communication error
- `RJC (0x4F)`: Rejection (data not available)

**Important Notes:**
- S-330 does NOT support RQ1/DT1 commands
- DT1 writes are silently ignored for function parameters
- All data is nibblized (2 bytes per actual data byte)
- Patches use stride of 4 at bank 00 00

**Data Types:**
- `0x00`: All data
- `0x01`: Patches 1-32
- `0x02`: Patches 33-64
- `0x03`: Tones 1-32
- `0x04`: Tones 33-64 (requires expanded memory)
- `0x05`: Function/system parameters

## Troubleshooting

### MIDI Device Not Found

```
Error: MIDI device "Volt 4" not found.
Available inputs: [...]
```

**Solutions:**
- Check MIDI interface is connected and powered
- Verify device name matches available ports
- Set `MIDI_DEVICE_NAME` environment variable
- Check MIDI driver installation

### S-330 Not Responding

```
Error: S-330 response timeout
```

**Solutions:**
- Ensure S-330 is powered on
- Check MIDI cables are connected correctly
- Verify MIDI interface direction (IN/OUT)
- Check S-330 MIDI channel settings
- Confirm device ID matches (default: 0)

### Changes Don't Persist

If modifications are sent but don't persist:

1. Check WSD/DAT/EOD protocol is used (not DT1)
2. Verify data is properly nibblized
3. Ensure checksums are calculated correctly
4. Wait adequate time between send and readback (500ms)
5. Check S-330 memory protection settings

### Test Failures After Protocol Changes

If tests fail after modifying protocol code:

1. Review SysEx message format
2. Validate checksum calculation
3. Verify nibblization/denibblization
4. Check command byte values
5. Test with raw MIDI monitor first

## Writing New Hardware Tests

When adding tests for new hardware:

1. **Follow the existing pattern:**
   - Use `beforeAll` for setup, `afterAll` for teardown
   - Support `SKIP_HARDWARE_TESTS` environment variable
   - Provide clear error messages when hardware unavailable

2. **Implement graceful skipping:**
   ```typescript
   const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

   it('test name', { skip: shouldSkip }, async () => {
       // test code
   });
   ```

3. **Always restore original state:**
   - Save original values before modification
   - Restore in test or afterAll hook
   - Verify restoration succeeded

4. **Add documentation:**
   - Update this README
   - Document protocol specifics
   - Provide troubleshooting tips

5. **Add npm script:**
   ```json
   "test:hardware:devicename": "vitest run test/integration/devicename-hardware.test.ts"
   ```

## References

- [Roland S-330 SysEx Documentation](../../docs/s330_sysex.md)
- [S330Client API](../../../sampler-midi/src/client/client-roland-s330.ts)
- [Vitest Documentation](https://vitest.dev/)
- [EasyMIDI Library](https://www.npmjs.com/package/easymidi)
