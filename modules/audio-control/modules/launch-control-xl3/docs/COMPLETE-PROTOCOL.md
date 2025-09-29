# Launch Control XL3 Complete Protocol Documentation

## Overview

This document provides comprehensive documentation of the Launch Control XL3 MIDI protocol, including SysEx custom mode operations and DAW port communications.

## Port Configuration

The Launch Control XL3 presents multiple MIDI ports:

### Standard MIDI Ports
- **LCXL3 1 MIDI In**: Input TO the device (for sending commands)
- **LCXL3 1 MIDI Out**: Output FROM the device (for receiving responses)

### DAW Integration Ports
- **LCXL3 1 DAW In**: DAW-specific input
- **LCXL3 1 DAW Out**: DAW-specific output (Note On/Off and CC messages)

## SysEx Protocol

### Message Structure
All SysEx messages follow this format:
```
F0 00 20 29 02 15 05 00 [CMD] [SLOT] [DATA...] F7
```

Where:
- `F0`: SysEx start
- `00 20 29`: Novation manufacturer ID
- `02`: Device ID (Launch Control XL 3)
- `15`: Command group (custom modes)
- `05`: Sub-command
- `00`: Reserved
- `[CMD]`: Operation command byte
- `[SLOT]`: Slot number (0x00-0x0E for slots 1-15)
- `[DATA]`: Optional payload data
- `F7`: SysEx end

### Command Bytes

| Byte | Direction | Operation | Description |
|------|-----------|-----------|-------------|
| 0x45 | TO device | Write | Write custom mode with full data payload |
| 0x40 | TO device | Read Request | Request custom mode data from slot |
| 0x15 | FROM device | Write ACK | Acknowledgment of write operation |
| 0x10 | FROM device | Read Response | Custom mode data response |

## Custom Mode Operations

### Write Operation (0x45)

**Request (TO device):**
```
F0 00 20 29 02 15 05 00 45 [SLOT] [ENCODED_DATA] F7
```

The encoded data contains:
1. Mode name (null-terminated string with 0x20 prefix)
2. Control definitions (48 controls using 0x49 markers)
3. Control labels (using 0x69/0x6a/0x6b markers)
4. LED colors (using 0x60 markers)

**Response (FROM device):**
```
F0 00 20 29 02 15 05 00 15 [SLOT] [STATUS] F7
```
- STATUS: 0x06 or 0x07 = success, 0xF7 = only end byte (timeout/failure)

### Read Operation (0x40)

**Request (TO device):**
```
F0 00 20 29 02 15 05 00 40 [SLOT] 00 F7
```

**Response (FROM device):**
```
F0 00 20 29 02 15 05 00 10 [SLOT] [DATA] F7
```

If slot is empty, device responds with:
```
F0 00 20 29 02 15 05 00 10 [SLOT] F7
```

## DAW Port Communications

The DAW ports handle performance-related MIDI messages separate from configuration:

### DAW Out Port Messages

During custom mode operations, the following messages appear on the DAW Out port:

1. **Note On/Off Messages (Channel 16)**
   - Format: `9F 0B 7F` (Note On, note 11, velocity 127)
   - Format: `9F 0B 00` (Note Off, note 11, velocity 0)
   - Purpose: Likely signals mode changes or UI updates

2. **Control Change Messages (Channel 7)**
   - Format: `B6 1E [VALUE]` (CC 30 on channel 7)
   - Values observed: 0x06, 0x07
   - Purpose: Status indicators for custom mode operations

### Message Correlation

When writing custom modes:
1. SysEx write command sent on MIDI In port
2. DAW Out port emits Note On/CC/Note Off sequence
3. MIDI Out port sends SysEx acknowledgment

## Data Format Details

### Control Definition (0x49 marker)
```
49 [ID] 02 [TYPE] 00 01 40 00 [CC] 7F 00
```
- ID: Control ID (0x28-0x5F)
- TYPE: 0x00=encoder, 0x05=fader, 0x09/0x0D/0x19=button types
- CC: CC number

### Control Label (0x69 marker)
```
69 [ID] [ASCII_TEXT]
```
- ID: Control ID
- ASCII_TEXT: Variable-length label text

### LED Color (0x60 marker)
```
60 [ID] [COLOR]
```
- ID: Control ID
- COLOR: 0x0C (red) or other color values

## Implementation Status

### Working Features
- ✅ Device handshake and connection
- ✅ Read custom modes from device
- ✅ Write custom modes to device (with 0x45)
- ✅ Receive write acknowledgments
- ✅ Parse custom mode data structures

### Known Issues
1. **Round-trip verification**: Written data may not always read back correctly
   - Slot 0 returns corrupted data
   - Other slots may timeout on read after write
   - This suggests additional state management may be required

2. **DAW Port Function**: The exact purpose of DAW port messages during configuration is unclear
   - May be for LED feedback
   - Could signal UI state changes
   - Requires further investigation

## Test Results Summary

### Write Operation
- Sends ~800 byte SysEx messages with 0x45 command
- Device acknowledges with 12-byte response (0x15)
- DAW port shows correlated activity

### Read Operation
- Intermittent success reading back written data
- Slot 0 shows data corruption
- Other slots may timeout suggesting write didn't persist

### DAW Port Activity
- Note On/Off on channel 16 (note 11)
- CC messages on channel 7 (controller 30)
- Appears to correlate with mode changes

## Recommendations

1. **For reliable operation**: Use factory modes or pre-configured custom modes
2. **For custom mode development**: Test thoroughly as round-trip may not work consistently
3. **Monitor all ports**: DAW ports provide additional status information
4. **Consider timing**: Device may need delays between write and read operations

## Protocol Verification

This documentation is based on:
- Direct web editor traffic capture
- Automated testing with known data patterns
- Analysis of device responses
- Monitoring of all MIDI ports simultaneously

Last updated: 2024 (firmware v1.0.10.84)