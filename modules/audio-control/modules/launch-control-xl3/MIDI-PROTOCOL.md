# Launch Control XL 3 Protocol - Corrected Implementation

## Summary

Based on analysis of actual MIDI capture logs from the working web editor and successful device communication, we have
identified the correct protocol format for Launch Control XL 3 custom mode operations.

## Key Protocol Discoveries

### ✅ Critical Findings

1. **Direct Binary Format**: NO Midimunge encoding - use direct binary values
2. **Different Control Markers**: Write operations use `0x49`, Read responses use `0x48`
3. **Control ID Offset**: Add `0x28` to control IDs when writing (e.g., fader 0x00 becomes 0x28)
4. **Required Sections**: Messages MUST include label/color data after controls
5. **Data Header Format**: Must start with `00 20 08` followed by mode name (max 8 chars)
6. **Message Size**: Working messages are 400-500+ bytes with complete data

## Protocol Commands

### Handshake
```
Request  (SYN)    : F0 00 20 29 00 42 02 F7                                             ( 8 bytes)
Response (SYN-ACK): F0 00 20 29 00 42 02 4C 58 32 38 30 39 33 35 34 30 30 34 36 39 F7   (22 bytes)
Request  (ACK)    : F0 7E 7F 06 01 F7                                                   ( 6 bytes)
Response          : F0 7E 00 06 02 00 20 29 48 01 00 00 01 00 0A 54 F7                  (17 bytes)
```

### READ Custom Mode

```
Request:  F0 00 20 29 02 15 05 00 40 [SLOT] 00 F7  (12 bytes)
Response: F0 00 20 29 02 15 05 00 10 [SLOT] [DATA...] F7  (85-450+ bytes)
```

### WRITE Custom Mode

```
Request:  F0 00 20 29 02 15 05 00 45 [SLOT] [DATA...] F7  (400-500+ bytes)
Response: F0 00 20 29 02 15 05 00 15 [SLOT] 06 F7  (12 bytes acknowledgment)
```

## Custom Mode Data Structure

### WRITE Format (Sending TO device)

```
00 20 08 [MODE_NAME] [CONTROLS] [LABELS_COLORS]
│  │  │   │           │          │
│  │  │   │           │          └── Required label and color data
│  │  │   │           └── Control definitions with 0x49 markers
│  │  │   └── Mode name in ASCII (max 8 chars, no terminator)
│  │  └── Format indicator
└──────── Header sequence
```

### READ Format (Response FROM device)

```
06 20 08 [MODE_NAME] 21 00 [CONTROLS] [LABELS]
│  │  │   │          │  │   │          │
│  │  │   │          │  │   │          └── Control labels (optional)
│  │  │   │          │  │   └── Control definitions with 0x48 markers
│  │  │   │          └───── Name terminator
│  │  │   └── Mode name in ASCII
│  │  └── Format indicator
└──────── Header sequence
```

## Control Definition Formats

### WRITE Control Structure (11 bytes)

```
49 [ID+0x28] 02 [TYPE] [CH] 01 40 00 [CC] 7F 00
│  │         │  │      │    │  │  │  │    │  │
│  │         │  │      │    │  │  │  │    │  └── Terminator
│  │         │  │      │    │  │  │  │    └── Max (always 0x7F in write)
│  │         │  │      │    │  │  │  └── CC number (0-127)
│  │         │  │      │    │  │  └── Min (always 0x00 in write)
│  │         │  │      │    │  └── Behavior parameter
│  │         │  │      │    └── Fixed parameter
│  │         │  │      └── MIDI channel (0-15)
│  │         │  └── Control type (see below)
│  │         └── Definition type (always 0x02)
│  └── Control ID with +0x28 offset
└── Write control marker (0x49)
```

### READ Control Structure (10 bytes)

```
48 [ID] 02 [TYPE] [CH] 01 48 [MIN] [CC] [MAX]
│  │    │  │      │    │  │  │     │    │
│  │    │  │      │    │  │  │     │    └── Max value
│  │    │  │      │    │  │  │     └── CC number
│  │    │  │      │    │  │  └── Min value (actual)
│  │    │  │      │    │  └── Parameter 2
│  │    │  │      │    └── Parameter 1
│  │    │  │      └── MIDI channel (0-15)
│  │    │  └── Control type
│  │    └── Definition type (0x02)
│  └── Control ID (no offset)
└── Read control marker (0x48)
```

## Control Types and IDs

### Hardware Control IDs

- `0x00-0x07`: Faders 1-8
- `0x10-0x17`: Top row encoders 1-8
- `0x18-0x1F`: Middle row encoders 1-8
- `0x20-0x27`: Bottom row encoders 1-8
- `0x28-0x2F`: Side buttons
- `0x30-0x3F`: Bottom buttons

### Control Type Values

- `0x00`: Faders
- `0x05`: Top row encoders
- `0x09`: Middle row encoders
- `0x0D`: Bottom row encoders
- `0x19`: Various button types
- `0x25`: Various button types

## Label and Color Data (Required for Write)

### Label Format

```
69 [ID+0x28] [ASCII_TEXT...]
│  │          │
│  │          └── Label text in ASCII
│  └── Control ID with offset
└── Label marker
```

### Color Format

```
60 [ID+0x28]
│  │
│  └── Control ID with offset
└── Color marker
```

## Working Example: CHANNEV Custom Mode

### Successful Write Message Structure (465 bytes)

```
F0 00 20 29 02 15 05 00 45 00      // Header, write to slot 0
00 20 08                            // Data header
43 48 41 4E 4E 45 56 45            // "CHANNEVE" mode name
49 10 02 05 00 01 48 00 0D 7F 00   // First encoder: CC13
49 11 02 05 00 01 48 00 0E 7F 00   // Second encoder: CC14
[... more controls ...]
68 10 4D 69 63 20 47 61 69 6E      // Label: "Mic Gain"
[... more labels ...]
60 10 60 11 60 12                  // Colors for controls
[... more colors ...]
F7                                  // End
```

### Device Acknowledgment

```
F0 00 20 29 02 15 05 00 15 00 06 F7  // 12-byte ACK for slot 0
```

## Implementation Notes

1. **Message Completeness**: Device acknowledges incomplete messages but doesn't store the data
2. **Label/Color Requirement**: Without these sections, controls won't be stored
3. **Name Length**: Mode names should be 8 characters or less
4. **Control Order**: Controls should be sorted by ID for best compatibility
5. **Acknowledgment Timing**: Wait for ACK before sending additional messages
6. **Multi-Message Modes**: Some modes may span multiple slots (rare)

## Verified Working Implementation

```typescript
// Build message with proper format
const message = [
  0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x45, slot,
  0x00, 0x20, 0x08,                    // Data header
  ...nameBytes,                        // Mode name (ASCII)
  ...controlDefs,                      // Controls with 0x49 markers
  ...labelData,                        // Labels with 0x69 markers
  ...colorData,                        // Colors with 0x60 markers
  0xF7
];

// Control definition example
const control = [
  0x49,                   // Write marker
  controlId + 0x28,       // ID with offset
  0x02,                   // Definition type
  controlType,            // 0x00/0x05/0x09/0x0D
  channel,                // 0-15
  0x01, 0x40, 0x00,      // Fixed parameters
  ccNumber,               // CC number
  0x7F, 0x00             // Max and terminator
];
```

## Files Created During Investigation

### Test Scripts

- `send-exact-web-message.ts` - Sends captured web editor message
- `send-complete-channev.ts` - Sends both CHANNEV messages with proper ACK waiting
- `send-channev-to-slot-1.ts` - Sends CHANNEV to slot 1 using exact format
- `test-simple-mode.ts` - Tests minimal custom mode
- `read-and-parse-channev.ts` - Reads and analyzes CHANNEV from device

### Documentation

- `docs/midi-capture.md` - Captured MIDI communication from web editor
- `docs/send-channev-sysex-1.syx` - Complete first CHANNEV message (encoders)
- `docs/send-channev-sysex-2.syx` - Complete second CHANNEV message (faders/buttons)

## Conclusion

The Launch Control XL 3 uses a specific binary protocol that requires:

- Exact control structure format (11 bytes for write, 10 for read)
- Control ID offset (+0x28) when writing
- Complete messages with label/color data
- Different markers for write (0x49) vs read (0x48) operations

The protocol has been successfully reverse-engineered and verified with actual hardware.