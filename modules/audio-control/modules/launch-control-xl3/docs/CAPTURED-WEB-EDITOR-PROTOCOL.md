# Captured Web Editor MIDI Protocol

## Complete Bidirectional MIDI Conversation

This document contains the complete MIDI conversation captured between the Novation web editor and the Launch Control XL3 device when sending a custom mode.

## Summary

When the web editor sends a custom mode to the device:

1. **TO Device (via LCXL3 1 MIDI In)**: 342-byte SysEx message with command 0x45
2. **TO Device (via LCXL3 1 DAW In)**: Note On/CC/Note Off sequence
3. **FROM Device (via LCXL3 1 MIDI Out)**: 12-byte SysEx acknowledgment with command 0x15
4. **FROM Device (via LCXL3 1 DAW Out)**: Note On/CC/Note Off echo

## Captured Messages

### Write Operation #1 (Slot 0)

#### TO Device (LCXL3 1 MIDI In) - 342 bytes:
```
F0 00 20 29 02 15 05 00 45 00 01 20 10 2A 4E 65
77 20 43 75 73 74 6F 6D 20 4D 6F 64 65 49 10 02
05 00 01 40 00 0D 7F 00 49 11 02 05 00 01 40 00
0E 7F 00 49 12 02 05 00 01 40 00 0F 7F 00 49 13
02 05 00 01 40 00 10 7F 00 49 14 02 05 00 01 40
00 11 7F 00 49 15 02 05 00 01 40 00 12 7F 00 49
16 02 05 00 01 40 00 13 7F 00 49 17 02 05 00 01
40 00 14 7F 00 49 18 02 09 00 01 40 00 15 7F 00
49 19 02 09 00 01 40 00 16 7F 00 49 1A 02 09 00
01 40 00 17 7F 00 49 1B 02 09 00 01 40 00 18 7F
00 49 1C 02 09 00 01 40 00 19 7F 00 49 1D 02 09
00 01 40 00 1A 7F 00 49 1E 02 09 00 01 40 00 1B
7F 00 49 1F 02 09 00 01 40 00 1C 7F 00 49 20 02
0D 00 01 40 00 1D 7F 00 49 21 02 0D 00 01 40 00
1E 7F 00 49 22 02 0D 00 01 40 00 1F 7F 00 49 23
02 0D 00 01 40 00 20 7F 00 49 24 02 0D 00 01 40
00 21 7F 00 49 25 02 0D 00 01 40 00 22 7F 00 49
26 02 0D 00 01 40 00 23 7F 00 49 27 02 0D 00 01
40 00 24 7F 00 60 10 60 11 60 12 60 13 60 14 60
15 60 16 60 17 60 18 60 19 60 1A 60 1B 60 1C 60
1D 60 1E 60 1F 60 20 60 21 60 22 60 23 60 24 60
25 60 26 60 27 F7
```

#### TO Device (LCXL3 1 DAW In):
```
9F 0B 7F  // Note On, channel 16, note 11, velocity 127
B6 1E 07  // CC, channel 7, controller 30, value 7
9F 0B 00  // Note Off, channel 16, note 11, velocity 0
```

#### FROM Device (LCXL3 1 MIDI Out) - 12 bytes:
```
F0 00 20 29 02 15 05 00 15 00 07 F7
```

### Write Operation #2 (Slot 3)

#### TO Device (LCXL3 1 MIDI In) - 342 bytes:
```
F0 00 20 29 02 15 05 00 45 03 01 20 10 2A 4E 65
77 20 43 75 73 74 6F 6D 20 4D 6F 64 65 49 28 02
00 00 01 40 00 05 7F 00 49 29 02 00 00 01 40 00
06 7F 00 49 2A 02 00 00 01 40 00 07 7F 00 49 2B
02 00 00 01 40 00 08 7F 00 49 2C 02 00 00 01 40
00 09 7F 00 49 2D 02 00 00 01 40 00 0A 7F 00 49
2E 02 00 00 01 40 00 0B 7F 00 49 2F 02 00 00 01
40 00 0C 7F 00 60 28 60 29 60 2A 60 2B 60 2C 60
2D 60 2E 60 2F 49 30 02 19 03 01 50 00 25 7F 00
49 31 02 19 03 01 50 00 26 7F 00 49 32 02 19 03
01 50 00 27 7F 00 49 33 02 19 03 01 50 00 28 7F
00 49 34 02 19 03 01 50 00 29 7F 00 49 35 02 19
03 01 50 00 2A 7F 00 49 36 02 19 03 01 50 00 2B
7F 00 49 37 02 19 03 01 50 00 2C 7F 00 49 38 02
25 03 01 50 00 2D 7F 00 49 39 02 25 03 01 50 00
2E 7F 00 49 3A 02 25 03 01 50 00 2F 7F 00 49 3B
02 25 03 01 50 00 30 7F 00 49 3C 02 25 03 01 50
00 31 7F 00 49 3D 02 25 03 01 50 00 32 7F 00 49
3E 02 25 03 01 50 00 33 7F 00 49 3F 02 25 03 01
50 00 34 7F 00 60 30 60 31 60 32 60 33 60 34 60
35 60 36 60 37 60 38 60 39 60 3A 60 3B 60 3C 60
3D 60 3E 60 3F F7
```

#### FROM Device (LCXL3 1 MIDI Out) - 12 bytes:
```
F0 00 20 29 02 15 05 00 15 03 07 F7
```

## Protocol Analysis

### SysEx Format (TO Device)
```
F0 00 20 29 02 15 05 00 45 [SLOT] [DATA...] F7
```
- Bytes 0-7: Fixed header
- Byte 8: **0x45** - Write command with data
- Byte 9: Slot number (0x00 or 0x03)
- Bytes 10+: Encoded custom mode data
- Last byte: 0xF7 (SysEx end)

### SysEx Format (FROM Device)
```
F0 00 20 29 02 15 05 00 15 [SLOT] [STATUS] F7
```
- Bytes 0-7: Fixed header
- Byte 8: **0x15** - Write acknowledgment
- Byte 9: Slot number
- Byte 10: Status (0x06 or 0x07 = success)
- Byte 11: 0xF7 (SysEx end)

### Data Structure

The 342-byte message contains:

1. **Mode Name** (bytes 10-29):
   - 0x01 0x20: Marker for name section
   - 0x10 0x2A: Length or identifier
   - ASCII text: "New Custom Mode"

2. **Control Definitions** (using 0x49 markers):
   - Each control: `49 [ID] 02 [TYPE] 00 01 40 00 [CC] 7F 00`
   - Control IDs: 0x10-0x3F (48 controls total)
   - Types:
     - 0x00: Encoder (rotary)
     - 0x05: Encoder
     - 0x09: Encoder
     - 0x0D: Encoder
     - 0x19: Button
     - 0x25: Button

3. **LED Colors** (using 0x60 markers):
   - Format: `60 [ID]`
   - One for each control

## Key Findings

1. **Command byte 0x45 is correct** for write operations
2. **0x49 markers** are used for control definitions (not 0x48)
3. **0x60 markers** are used for LED colors
4. **DAW port activity** accompanies configuration changes
5. **Two slots written**: The web editor writes the same mode to multiple slots

## Comparison with Our Library

Our library needs to:
1. Use **0x49** markers instead of 0x48 for controls
2. Use **0x60** markers for LED colors
3. Use **0x40** in control definition bytes (not 0x48)
4. Use **0x50** for button controls (slots 3)
5. Include proper padding bytes (0x00)

The web editor uses different type codes based on the slot:
- Slot 0: Types 0x05, 0x09, 0x0D
- Slot 3: Types 0x00, 0x19, 0x25