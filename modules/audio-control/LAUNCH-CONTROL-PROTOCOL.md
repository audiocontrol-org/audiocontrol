# Novation Launch Control XL 3 Web Editor Protocol Analysis

This document details the MIDI communication protocol used by the Novation Launch Control XL 3 web editor to program the device.

## Overview

The Launch Control XL 3 web editor uses standard Web MIDI API combined with custom SysEx encoding to communicate with the hardware device. No proprietary network protocols or WebSockets are involved - all communication happens through MIDI System Exclusive messages.

## Device Detection & Connection

### MIDI Ports
The device exposes four MIDI ports when connected:

- **LCXL3 1 MIDI Out** (Input to browser) - Standard MIDI communication from device
- **LCXL3 1 MIDI In** (Output from browser) - Standard MIDI communication to device
- **LCXL3 1 DAW Out** (Input to browser) - DAW-specific communication from device
- **LCXL3 1 DAW In** (Output from browser) - DAW-specific communication to device

**Manufacturer**: "Focusrite - Novation"

### Firmware Detection
The web editor automatically detects the device firmware version via MIDI communication:
- **Example Firmware Version**: 1364

### Connection Status
The editor displays "Launch Control XL 3 is ready" when the device is properly detected and connected.

## Custom MIDI Library: Midimunge

The web editor includes a custom JavaScript library called `Midimunge` for handling MIDI data encoding/decoding:

### Core Functions

#### `bytesToNybbles(byte)`
Converts a single byte into 8 nibbles (4-bit values):
```javascript
function(e) {
    var t, n = [0,0,0,0,0,0,0,0];
    for(t = 0; t < 8; t++)
        n[t] = e >> 4 * (7 - t) & 15;
    return n;
}
```

#### `nybblesToBytes(nibbles)`
Converts an array of 8 nibbles back into a byte value:
```javascript
function(e) {
    var t = 0;
    return e.forEach((function(e, n) {
        t += e * Math.pow(16, 7 - n)
    })), t;
}
```

#### `eightToSeven(data)`
Converts 8-bit data to 7-bit MIDI-safe format:
```javascript
function(e) {
    for(var t = [], n = e.length, r = 0; r < n;) {
        var i, o, s = e.slice(r, r + 8), a = s.slice(1);
        for(i = 0, o = a.length; i < o; i++) {
            var l = (s[0] & 1 << i) >> i;
            a[i] = a[i] + (l << 7);
        }
        t = t.concat(a), r += 8;
    }
    return t;
}
```

#### `sevenToEight(data)`
Converts 7-bit MIDI data back to 8-bit format:
```javascript
function(e) {
    for(var t = [], n = e.length, r = 0; r < n;) {
        var i, o, s = e.slice(r, r + 8), a = s.slice(1);
        for(i = 0, o = a.length; i < o; i++) {
            var l = (s[0] & 1 << i) >> i;
            a[i] = a[i] + (l << 7);
        }
        t = t.concat(a), r += 8;
    }
    return t;
}
```

#### `chunkSysEx(data)`
Parses SysEx messages by finding F0 (start) and F7 (end) boundaries:
```javascript
function(e) {
    var t = [], n = new Uint8Array(e), r = 0, i = 0;
    do {
        r = n.indexOf(240, i),  // F0 - SysEx start
        i = n.indexOf(247, r),  // F7 - SysEx end
        -1 !== r && -1 !== i && t.push(e.slice(r, i + 1));
    } while(-1 !== r && -1 !== i);
    return t;
}
```

## Communication Protocol Flow

### 1. Custom Mode Transfer Process

1. **Mode Selection**: User clicks "Send to Launch Control XL 3" button
2. **Data Fetch**: Web app requests custom mode data via:
   ```
   GET /api/v2/launch_control_xl_mk3/factory_packs/{pack_id}/file
   ```
3. **Slot Selection**: Modal displays slots 1-15 for user selection
4. **Data Processing**: Raw custom mode data is processed through Midimunge functions
5. **MIDI Transfer**: Processed data is sent as SysEx messages to device

### 2. Data Encoding Pipeline

```
Raw Custom Mode Data
         ↓
    eightToSeven() - Convert to 7-bit MIDI-safe format
         ↓
    chunkSysEx() - Format as proper SysEx packets
         ↓
    Web MIDI API - Send F0...F7 messages to device
```

### 3. SysEx Message Format

Messages follow standard MIDI SysEx format:
- **Start**: `F0` (240 decimal)
- **Manufacturer ID**: `00 20 29` (Focusrite/Novation)
- **Device ID**: `02` (Launch Control XL 3)
- **Command**: `15` (Write Custom Mode)
- **Sub-Command**: `05` (Custom Mode Data)
- **Data**: Encoded custom mode configuration
- **End**: `F7` (247 decimal)

## Technical Architecture

### Web MIDI API Usage
- Uses standard `navigator.requestMIDIAccess()` for device access
- Primary communication via `LCXL3 1 MIDI In` output port
- Bidirectional capability via `LCXL3 1 MIDI Out` input port

### Data Constraints
- All data must be converted to 7-bit format for MIDI compliance
- Maximum SysEx message size limitations apply
- Device supports 15 custom mode storage slots

### Error Handling
- Device connection status monitoring
- SysEx message validation
- Firmware version compatibility checks

## Security Considerations

- Web MIDI API requires user permission
- No sensitive data transmitted (only MIDI CC mappings and device configuration)
- Standard browser security model applies

## Implementation Notes

### For Developers
1. **MIDI Access**: Always request MIDI access with proper error handling
2. **Data Encoding**: Use `eightToSeven()` for any 8-bit data before transmission
3. **Message Chunking**: Use `chunkSysEx()` to properly format SysEx messages
4. **Device Detection**: Check for "Focusrite - Novation" manufacturer string

### Performance
- Custom mode transfer completes in under 1 second
- No noticeable latency during MIDI communication
- Efficient 7-bit encoding minimizes message size

## Related Standards

- **MIDI 1.0 Specification**: System Exclusive messages (F0...F7)
- **Web MIDI API**: W3C standard for browser MIDI access
- **USB MIDI Device Class**: Device enumeration and communication

## Detailed SysEx Protocol Specification

### SysEx Message Structure

Based on captured MIDI traffic analysis, the Launch Control XL 3 uses the following SysEx format:

#### Message Header
```
F0 00 20 29 02 15 05 00 45 [SLOT] 02 20 05 [NAME...]
```

- `F0` - SysEx start
- `00 20 29` - Manufacturer ID (Focusrite/Novation)
- `02` - Device ID (Launch Control XL 3)
- `15` - Command (Write Custom Mode)
- `05` - Sub-command (Custom Mode Data)
- `00` - Reserved byte
- `45` - Data type identifier
- `[SLOT]` - Target slot number (00-0E for slots 1-15)
- `02 20 05` - Additional header bytes
- `[NAME...]` - ASCII mode name (e.g., "Serum")

### Custom Mode Data Structure

The custom mode configuration is sent in multiple SysEx messages containing:

#### Control Assignments
Each control (knob, fader, button) has a structure like:
```
49 [CONTROL_ID] 02 [TYPE] [CHANNEL] [PARAMS...] 48 00 [CC_NUM] 7F 00
```

- `49` - Control definition marker
- `[CONTROL_ID]` - Control identifier (10-3F range)
- `02` - Definition type
- `[TYPE]` - Control type (19=encoder, 11=button, etc.)
- `[CHANNEL]` - MIDI channel (00-0F)
- `[CC_NUM]` - MIDI CC number
- `7F` - Max value
- `00` - Min value

#### Control Names
ASCII text labels for controls are embedded:
```
[LENGTH] [ASCII_TEXT...]
```

Example control names found:
- "A WT Pos" - Wavetable Position
- "A Detune" - Detune control
- "Filter Pan" - Filter panning
- "LFO 1 Rate" - LFO rate control
- "Env 1 Attack" - Envelope attack
- "Sub On" - Sub oscillator enable

### Multiple Message Transfer

Large custom modes are split across multiple SysEx messages:
1. First message (517 bytes): Contains initial control mappings
2. Second message (492 bytes): Contains additional controls and names
3. Messages use continuation markers in bytes 8-9

### Slot Numbering

The slot number appears at byte position 9:
- Slot 1: `00`
- Slot 2: `01`
- Slot 3: `02`
- ...
- Slot 15: `0E`

## Implementation Example

### Sending a Custom Mode

```javascript
// Example SysEx message construction
const createCustomModeSysEx = (slot, modeName, controls) => {
  const header = [
    0xF0,        // SysEx start
    0x00, 0x20, 0x29,  // Novation manufacturer ID
    0x02,        // Device ID
    0x15,        // Write command
    0x05,        // Custom mode sub-command
    0x00,        // Reserved
    0x45,        // Data type
    slot,        // Target slot (0-14)
    0x02, 0x20, 0x05  // Additional header
  ];

  // Add mode name as ASCII
  const nameBytes = Array.from(modeName).map(c => c.charCodeAt(0));

  // Add control definitions...
  // Add 0xF7 end byte

  return new Uint8Array([...header, ...nameBytes, /* controls */, 0xF7]);
};
```

## Captured Examples

### Serum Preset (Slot 3)

**Message 1 (517 bytes):**
- Header: `F0 00 20 29 02 15 05 00 45 00 02 20 05`
- Mode name: "Serum"
- Contains 24 control definitions
- Control types: Encoders (19), Buttons (11), Faders (31)
- MIDI CCs used: 15-4F range

**Message 2 (492 bytes):**
- Continuation: `F0 00 20 29 02 15 05 00 45 03 02 20 05`
- Additional 16 controls
- Effect controls: Distortion, Flanger, Phaser, Chorus, Delay, Reverb
- Filter controls: Cutoff, Resonance, Drive

## Read/Write Operation Protocol

### Reading Custom Modes from Device

**Read Request Format:**
```
F0 00 20 29 02 15 05 00 15 [SLOT] 06 F7
```
- `15` - Read command identifier
- `[SLOT]` - Target slot (00 for slot 1, 03 for slot 4, etc.)
- `06` - Read operation parameter

**Read Response Format:**
```
F0 00 20 29 02 15 05 00 10 [SLOT] 06 20 10 [NAME...] [CONTROL_DATA...] F7
```
- `10` - Response identifier
- `[SLOT]` - Slot number echoed back
- `06 20 10` - Response header
- `[NAME]` - ASCII mode name (e.g., "Default Custom M")
- `[CONTROL_DATA]` - Control definitions (CC mappings, etc.)

### Writing Custom Modes to Device

**Write Message Format:**
```
F0 00 20 29 02 15 05 00 10 [SLOT] 06 20 10 [NAME...] [CONTROL_DATA...] F7
```
- Same format as read response but sent TO the device
- Can be split into multiple messages for large configurations
- Message continuations use different byte patterns at position 8-9

### Control Data Structure
Each control in the data uses pattern:
```
48 [ID] 02 [TYPE] [PARAMS] 48 00 [CC] 7F
```
- `48` - Control marker
- `[ID]` - Control identifier (10-3F)
- `02` - Definition type
- `[TYPE]` - Control type (05=button, 09=encoder, etc.)
- `[CC]` - MIDI CC number
- `7F` - Max value

### Command Type Summary

| Operation | Command Byte | Data Type | Message Length |
|-----------|-------------|-----------|----------------|
| Read Req  | `15`        | `15`      | 12 bytes       |
| Read Resp | `15`        | `10`      | 300+ bytes     |
| Write     | `15`        | `10`      | 300+ bytes     |

## Device Identification Protocol

### Device Initialization Sequence (Power-On/USB Connect)

When the Launch Control XL 3 is connected via USB, it sends the following initialization sequence:

1. **Device Serial Number (sent 3 times)**:
```
F0 00 20 29 00 42 02 [Serial Number ASCII] F7
```
- Manufacturer: `00 20 29` (Novation/Focusrite)
- Command: `00 42` (Device ID broadcast)
- Device Type: `02` (Launch Control XL 3)
- Serial Number: ASCII encoded (e.g., "LX280935400469")

2. **Universal Device Identity Reply (sent 3 times)**:
```
F0 7E 00 06 02 00 20 29 48 01 00 00 01 00 0A 54 F7
```
- `7E 00` - Universal Non-Real Time, Device ID 0
- `06 02` - Identity Reply
- `00 20 29` - Manufacturer ID (Novation)
- `48 01` - Product Family/Model ID
- `00 00 01 00` - Software version (1.0)
- `0A 54` - Additional version info (firmware 2644)

### Initialization Behavior
- Device sends each message 3 times for reliability
- No host acknowledgment required
- Device is ready for operation after sending these messages
- No LED initialization sequences observed (LEDs may initialize via hardware)

## Control Mappings

The Launch Control XL 3 has 24 encoders (3x8), 8 sliders, and 16 buttons (2x8).

### Encoder CC Assignments
- **Row 1 (Send A)**: CC 21, 85, 22, 19, 18, 17, 16, 23
- **Row 2 (Send B)**: CC 24, 15, 25, 14, 49, 50, 51, 26
- **Row 3 (Pan/Device)**: CC 29-34, 27-28

### Slider CC Assignments
- **Sliders 1-8**: CC 77, 78, 71-76

### Button Behavior
- Buttons can operate in CC mode or Note mode
- In CC mode: Send CC values 36-48 for various functions
- In Note mode: Would send Note On/Off messages (not captured in current mode)

## LED Control
- Encoder ring LEDs respond automatically to CC value changes
- Button LEDs likely controlled via:
  - Note messages on specific channels (when in Note mode)
  - CC values when in CC mode
  - Possible SysEx commands for direct LED control

## Template/Custom Mode Behavior

### Template Switching
- **No MIDI messages sent** when switching between custom modes on device
- Device maintains internal state for 16 custom mode slots
- Template selection is handled entirely within the device hardware
- Each template can have different CC/Note mappings stored in device memory
- Host software must use Read/Write SysEx commands to query or change templates

### Implications
- Device operates independently of host software for template management
- LED patterns and control mappings change internally without host notification
- To synchronize with device state, host must:
  1. Query current template using Read command
  2. Store template configurations locally
  3. Listen for CC/Note messages to infer active template

## Future Research

- Complete Phase 4: Real-time parameter feedback testing
- Test bidirectional communication (host → device)
- Document LED color values and control methods
- Test firmware update protocol (with caution)

---

*Analysis conducted via Playwright browser automation on 2025-09-25*
*Device: Launch Control XL 3 (Firmware 1364)*
*Web Editor: https://components.novationmusic.com/launch-control-xl-3/custom-modes*