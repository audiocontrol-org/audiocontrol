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