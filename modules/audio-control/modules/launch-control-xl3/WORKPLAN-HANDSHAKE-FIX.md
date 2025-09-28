# Workplan: Fix Launch Control XL3 Handshake Implementation

## Problem Statement

The current handshake implementation in `LaunchControlXL3` does not follow the complete protocol documented in
`MIDI-PROTOCOL.md`. Specifically:

### Current Behavior

- Only sends Universal Device Inquiry: `F0 7E 00 06 01 F7` (6 bytes)
- Uses wrong device ID (`0x00` instead of `0x7F`)
- Skips Novation-specific SYN/SYN-ACK exchange
- Missing proper sequence coordination

### Expected Behavior (per MIDI-PROTOCOL.md)

The complete handshake should be a 4-message sequence:

1. **SYN Request**: `F0 00 20 29 00 42 02 F7` (8 bytes)
    - Novation-specific initialization message

2. **SYN-ACK Response**: `F0 00 20 29 00 42 02 [SERIAL_NUMBER] F7` (22 bytes)
    - Device responds with serial number

3. **ACK Request**: `F0 7E 7F 06 01 F7` (6 bytes)
    - Universal Device Inquiry with correct device ID (`0x7F` for broadcast)

4. **Device Response**: `F0 7E 00 06 02 00 20 29 48 01 00 00 01 00 0A 54 F7` (17 bytes)
    - Device identification information

## Technical Analysis

### Affected Files

- `src/core/SysExParser.ts` - Contains `buildDeviceQuery()` at line 404
- `src/device/DeviceManager.ts` - Handles connection and handshake coordination
- `test/handshake.test.ts` - Unit tests need updates

### Current Implementation Location

```typescript
// src/core/SysExParser.ts:404
static
buildDeviceQuery()
:
number[]
{
  return [
    0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7  // ❌ Incomplete, wrong device ID
  ];
}
```

### Protocol Constants

```typescript
// Novation Manufacturer ID
const NOVATION_MANUFACTURER_ID = [0x00, 0x20, 0x29];

// Launch Control XL3 Device ID
const LCXL3_DEVICE_ID = [0x48, 0x01];

// Universal System Exclusive IDs
const UNIVERSAL_NON_REALTIME = 0x7E;
const DEVICE_INQUIRY_REQUEST = 0x06;
const DEVICE_INQUIRY_REPLY = 0x02;
```

## Implementation Plan

### Phase 1: Update SysExParser

**Task 1.1: Add handshake message builders**

Create new static methods in `SysExParser`:

```typescript
static
buildNovationSyn()
:
number[]
{
  return [
    0xF0,              // SysEx start
    0x00, 0x20, 0x29,  // Novation manufacturer ID
    0x00,              // Device model (Launch Control)
    0x42,              // Command (handshake)
    0x02,              // Sub-command (SYN)
    0xF7               // SysEx end
  ];
}

static
buildUniversalDeviceInquiry()
:
number[]
{
  return [
    0xF0,              // SysEx start
    0x7E,              // Universal Non-Realtime
    0x7F,              // Device ID (broadcast)
    0x06,              // Sub-ID 1 (Device Inquiry)
    0x01,              // Sub-ID 2 (Inquiry Request)
    0xF7               // SysEx end
  ];
}

static
parseNovationSynAck(data
:
number[]
):
{
  valid: boolean;
  serialNumber ? : string;
}
{
  if (data.length !== 22) {
    return { valid: false };
  }

  if (data[0] !== 0xF0 || data[data.length - 1] !== 0xF7) {
    return { valid: false };
  }

  // Verify Novation manufacturer ID
  if (data[1] !== 0x00 || data[2] !== 0x20 || data[3] !== 0x29) {
    return { valid: false };
  }

  // Verify command bytes
  if (data[4] !== 0x00 || data[5] !== 0x42 || data[6] !== 0x02) {
    return { valid: false };
  }

  // Extract serial number (bytes 7-20)
  const serialBytes = data.slice(7, 21);
  const serialNumber = String.fromCharCode(...serialBytes);

  return { valid: true, serialNumber };
}
```

**Task 1.2: Update `buildDeviceQuery()` for backwards compatibility**

Keep the existing method but add JSDoc warning:

```typescript
/**
 * @deprecated Use the complete handshake sequence with buildNovationSyn()
 * and buildUniversalDeviceInquiry() instead. This method only performs
 * partial handshake and uses incorrect device ID.
 */
static
buildDeviceQuery()
:
number[]
{
  return [
    0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7
  ];
}
```

### Phase 2: Update DeviceManager

**Task 2.1: Implement complete handshake sequence**

Update `DeviceManager.ts` to implement the 4-message protocol:

```typescript
private async
performHandshake()
:
Promise < DeviceInfo > {
  const logger = this.logger;
  const timeout = this.config.handshakeTimeout ?? 5000;

  // Step 1: Send Novation SYN
  logger.debug('Handshake Step 1: Sending Novation SYN...');
  const synMessage = SysExParser.buildNovationSyn();
  await this.midiInterface.sendMessage(synMessage);

  // Step 2: Wait for SYN-ACK
  logger.debug('Handshake Step 2: Waiting for SYN-ACK...');
  const synAckData = await this.waitForMessage(
    (data) => {
      const parsed = SysExParser.parseNovationSynAck(data);
      return parsed.valid;
    },
    timeout,
    'SYN-ACK'
  );

  const synAck = SysExParser.parseNovationSynAck(synAckData);
  logger.info(`Received SYN-ACK with serial: ${synAck.serialNumber}`);

  // Step 3: Send Universal Device Inquiry (ACK)
  logger.debug('Handshake Step 3: Sending Universal Device Inquiry...');
  const inquiryMessage = SysExParser.buildUniversalDeviceInquiry();
  await this.midiInterface.sendMessage(inquiryMessage);

  // Step 4: Wait for Device Response
  logger.debug('Handshake Step 4: Waiting for Device Response...');
  const responseData = await this.waitForMessage(
    (data) => SysExParser.isDeviceInquiryResponse(data),
    timeout,
    'Device Response'
  );

  const deviceInfo = SysExParser.parseDeviceInquiryResponse(responseData);
  logger.info(`Handshake complete. Device: ${deviceInfo.manufacturerId}`);

  return deviceInfo;
}

private async
waitForMessage(
  validator
:
(data: number[]) => boolean,
  timeoutMs
:
number,
  messageName
:
string
):
Promise < number[] > {
  return new Promise<number[]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      this.midiInterface.removeMessageListener(handler);
      reject(new Error(`Handshake timeout waiting for ${messageName}`));
    }, timeoutMs);

    const handler = (message: MidiMessage) => {
      if (validator(Array.from(message.data))) {
        clearTimeout(timeout);
        this.midiInterface.removeMessageListener(handler);
        resolve(Array.from(message.data));
      }
    };

    this.midiInterface.addMessageListener(handler);
  });
}
```

**Task 2.2: Add message listener management**

Update `MidiInterface.ts` to support temporary message listeners:

```typescript
export interface MidiInterface {
  // ... existing methods ...

  addMessageListener(handler: (message: MidiMessage) => void): void;

  removeMessageListener(handler: (message: MidiMessage) => void): void;
}
```

### Phase 3: Update Tests

**Task 3.1: Update handshake unit tests**

Update `test/handshake.test.ts`:

```typescript
describe('Complete Handshake Sequence', () => {
  it('should perform full 4-message handshake', async () => {
    const sendSpy = vi.spyOn(mockBackend, 'sendMessage');

    const connectionPromise = controller.connect();

    // Wait for SYN
    await vi.waitFor(() => {
      const calls = sendSpy.mock.calls;
      const synSent = calls.some(call => {
        const message = Array.from(call[1].data);
        return arraysEqual(message, [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7]);
      });
      expect(synSent).toBe(true);
    });

    // Simulate SYN-ACK
    mockBackend.simulateNovationSynAck();

    // Wait for ACK (Universal Inquiry)
    await vi.waitFor(() => {
      const calls = sendSpy.mock.calls;
      const ackSent = calls.some(call => {
        const message = Array.from(call[1].data);
        return arraysEqual(message, [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);
      });
      expect(ackSent).toBe(true);
    });

    // Simulate Device Response
    mockBackend.simulateDeviceInquiryResponse();

    await connectionPromise;
    expect(controller.isConnected()).toBe(true);
  });

  it('should timeout if SYN-ACK not received', async () => {
    mockBackend.shouldRespondToSyn = false;

    await expect(controller.connect()).rejects.toThrow(/timeout.*SYN-ACK/i);
  });

  it('should reject invalid SYN-ACK serial number format', async () => {
    mockBackend.invalidSynAck = true;

    await expect(controller.connect()).rejects.toThrow(/invalid.*SYN-ACK/i);
  });

  it('should extract serial number from SYN-ACK', async () => {
    const deviceHandler = vi.fn();
    controller.on('device:connected', deviceHandler);

    await controller.connect();

    expect(deviceHandler).toHaveBeenCalled();
    expect(deviceHandler.mock.calls[0][0]).toMatchObject({
      serialNumber: expect.stringMatching(/^LX2\d{11}$/),
    });
  });
});
```

**Task 3.2: Add MockMidiBackend support**

Update `MockMidiBackend` in test file:

```typescript
class MockMidiBackend implements MidiBackendInterface {
  shouldRespondToSyn = true;
  invalidSynAck = false;

  simulateNovationSynAck(): void {
    if (!this.shouldRespondToSyn) return;

    const serialNumber = 'LX28093540046969';
    const response: number[] = [
      0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02,
      ...Array.from(serialNumber).map(c => c.charCodeAt(0)),
      0xF7
    ];

    if (this.invalidSynAck) {
      response[6] = 0xFF; // Corrupt command byte
    }

    this.simulateIncomingMessage({
      timestamp: Date.now(),
      data: response,
      type: 'sysex',
    });
  }

  simulateDeviceInquiryResponse(): void {
    const response: number[] = [
      0xF0, 0x7E, 0x00, 0x06, 0x02,
      0x00, 0x20, 0x29,  // Novation
      0x48, 0x01,         // Launch Control XL3
      0x00, 0x00,         // Device family
      0x01, 0x00, 0x0A, 0x54,  // Firmware version
      0xF7
    ];

    this.simulateIncomingMessage({
      timestamp: Date.now(),
      data: response,
      type: 'sysex',
    });
  }
}
```

### Phase 4: Integration Testing

**Task 4.1: Hardware test script**

Create `utils/test-complete-handshake.ts`:

```typescript
import { LaunchControlXL3 } from '@/LaunchControlXL3.js';
import { EasyMidiBackend } from '@/core/backends/EasyMidiBackend.js';
import { ConsoleLogger } from '@/core/Logger.js';

async function testCompleteHandshake() {
  const logger = new ConsoleLogger({
    prefix: 'HandshakeTest',
    includeTimestamp: true
  });

  const backend = new EasyMidiBackend(logger);
  const controller = new LaunchControlXL3({
    midiBackend: backend,
    logger,
  });

  try {
    logger.info('Starting complete handshake test...');
    await controller.connect();

    logger.info('✅ Handshake successful!');
    logger.info(`Device: ${JSON.stringify(controller.getDeviceInfo(), null, 2)}`);

    await controller.disconnect();
    logger.info('✅ Disconnected cleanly');
  } catch (error) {
    logger.error('❌ Handshake failed:', (error as Error).message);
    process.exit(1);
  }
}

testCompleteHandshake();
```

**Task 4.2: Add to test suite**

Update `package.json` with new test script:

```json
{
  "scripts": {
    "test:handshake:node": "tsx utils/test-complete-handshake.ts",
    "test:handshake:unit": "vitest run test/handshake.test.ts"
  }
}
```

## Backwards Compatibility

### Automatic Fallback Strategy

If the complete handshake fails, fall back to simple Universal Device Inquiry:

```typescript
private async
performHandshake()
:
Promise < DeviceInfo > {
  try {
    return await this.performCompleteHandshake();
  } catch(error) {
    this.logger.warn('Complete handshake failed, trying fallback:', (error as Error).message);
    return await this.performSimpleHandshake();
  }
}

private async
performCompleteHandshake()
:
Promise < DeviceInfo > {
  // 4-message sequence as documented above
}

private async
performSimpleHandshake()
:
Promise < DeviceInfo > {
  // Original implementation (Universal Inquiry only)
  this.logger.debug('Using simple handshake (Universal Inquiry only)');
  const inquiryMessage = SysExParser.buildDeviceQuery();
  await this.midiInterface.sendMessage(inquiryMessage);

  const responseData = await this.waitForMessage(
    (data) => SysExParser.isDeviceInquiryResponse(data),
    this.config.handshakeTimeout ?? 5000,
    'Device Response'
  );

  return SysExParser.parseDeviceInquiryResponse(responseData);
}
```

### Configuration Option

Add opt-in flag to `LaunchControlXL3Options`:

```typescript
export interface LaunchControlXL3Options {
  // ... existing options ...

  /**
   * Use complete Novation handshake sequence (SYN/SYN-ACK/ACK/Response).
   * If false or if complete handshake fails, falls back to simple Universal
   * Device Inquiry.
   *
   * @default true
   */
  useCompleteHandshake?: boolean;
}
```

## Documentation Updates

### Task 5.1: Update MIDI-PROTOCOL.md

Add implementation status section:

```markdown
## Implementation Status

### ✅ Complete Handshake (v2.0.0+)

The controller now implements the full 4-message handshake sequence:

1. **SYN**: Novation-specific initialization
2. **SYN-ACK**: Device responds with serial number
3. **ACK**: Universal Device Inquiry
4. **Response**: Device identification

### Fallback Support

If the complete handshake fails, the controller automatically falls back to
the simple Universal Device Inquiry for compatibility with older devices or
non-standard implementations.
```

### Task 5.2: Update README.md

Add handshake details to README:

```markdown
## Device Handshake

The controller performs a complete 4-message handshake on connection:

1. Sends Novation-specific SYN
2. Receives SYN-ACK with device serial number
3. Sends Universal Device Inquiry (ACK)
4. Receives device identification

If the complete handshake fails, it automatically falls back to a simple
Universal Device Inquiry for compatibility.

### Configuration

```typescript
const controller = new LaunchControlXL3({
  useCompleteHandshake: true,  // default
  handshakeTimeout: 5000,      // milliseconds
});
```

```

### Task 5.3: Update JSDoc

Add detailed JSDoc to `performHandshake()`:

```typescript
/**
 * Performs device handshake according to Launch Control XL3 protocol.
 *
 * Implements the complete 4-message sequence:
 * 1. SYN: Novation initialization (8 bytes)
 * 2. SYN-ACK: Device serial number response (22 bytes)
 * 3. ACK: Universal Device Inquiry (6 bytes)
 * 4. Response: Device identification (17 bytes)
 *
 * If `useCompleteHandshake` is false or the complete sequence fails,
 * falls back to simple Universal Device Inquiry.
 *
 * @throws {Error} If handshake times out or receives invalid response
 * @returns {Promise<DeviceInfo>} Device identification information
 *
 * @see MIDI-PROTOCOL.md for complete protocol specification
 */
private async performHandshake(): Promise<DeviceInfo>
```

## Testing Strategy

### Unit Tests

- ✅ Test each message builder function
- ✅ Test SYN-ACK parser with valid/invalid data
- ✅ Test complete 4-message sequence
- ✅ Test timeout scenarios at each step
- ✅ Test fallback to simple handshake
- ✅ Test serial number extraction

### Integration Tests

- ✅ Test with real hardware (Launch Control XL3)
- ✅ Test with MIDI loopback (software simulation)
- ✅ Test with modified timeout values
- ✅ Verify logging output at each step

### Performance Tests

- ✅ Measure handshake completion time
- ✅ Verify timeout behavior under load
- ✅ Test concurrent connection attempts

## Risk Assessment

### Low Risk

- Adding new message builders (no breaking changes)
- Adding SYN-ACK parser (new functionality)
- Logging improvements (visibility only)

### Medium Risk

- Changing handshake sequence (mitigated by fallback)
- Timeout handling (need careful testing)
- Message listener management (ensure proper cleanup)

### High Risk

- None (fallback ensures backwards compatibility)

## Success Criteria

### Functional Requirements

- ✅ Controller sends all 4 messages in correct order
- ✅ Controller validates SYN-ACK response
- ✅ Controller extracts serial number correctly
- ✅ Controller uses correct device ID (0x7F)
- ✅ Fallback works when complete handshake unavailable

### Performance Requirements

- ✅ Handshake completes within 2 seconds (typical)
- ✅ Timeout occurs within configured duration
- ✅ No memory leaks in message listeners

### Quality Requirements

- ✅ All unit tests pass
- ✅ Integration test passes with real hardware
- ✅ Code coverage ≥ 80%
- ✅ TypeScript compilation succeeds with strict mode
- ✅ Documentation updated and accurate

## Timeline

### Phase 1: SysExParser Updates

- Estimated: 2-3 hours
- Priority: High
- Blocking: Yes (required for subsequent phases)

### Phase 2: DeviceManager Updates

- Estimated: 3-4 hours
- Priority: High
- Blocking: Yes (core functionality)

### Phase 3: Test Updates

- Estimated: 2-3 hours
- Priority: High
- Blocking: No (can parallel with Phase 4)

### Phase 4: Integration Testing

- Estimated: 2-3 hours
- Priority: Medium
- Blocking: No (validation only)

### Phase 5: Documentation

- Estimated: 1-2 hours
- Priority: Low
- Blocking: No (can be done last)

**Total Estimated Time**: 10-15 hours

## Implementation Order

1. Update `SysExParser.ts` with new message builders
2. Update `SysExParser.ts` with SYN-ACK parser
3. Update `DeviceManager.ts` with complete handshake
4. Add message listener support to `MidiInterface.ts`
5. Update unit tests
6. Test with real hardware
7. Update documentation
8. Final review and PR

## Notes

- The complete handshake is optional with automatic fallback
- No breaking changes to public API
- Maintains compatibility with older devices
- Improves protocol correctness and logging
- Enables serial number extraction for device tracking