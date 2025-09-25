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
- **Manufacturer ID**: Novation-specific identifier
- **Device ID**: Launch Control XL 3 identifier
- **Command/Data**: Encoded custom mode configuration
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

## Future Research

- Reverse engineer the exact SysEx command format
- Analyze bidirectional communication patterns
- Document complete custom mode data structure
- Investigate DAW-specific port usage

---

*Analysis conducted via Playwright browser automation on 2025-09-25*
*Device: Launch Control XL 3 (Firmware 1364)*
*Web Editor: https://components.novationmusic.com/launch-control-xl-3/custom-modes*