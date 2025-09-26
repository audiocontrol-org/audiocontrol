# Launch Control XL 3 Protocol - Corrected Implementation

## Summary

Based on analysis of actual MIDI capture logs from the working web editor, we have identified the correct protocol format for Launch Control XL 3 custom mode operations.

## Key Findings

### ✅ Confirmed Working Protocol

**READ Operation (Request custom mode FROM device):**
```
Request:  F0 00 20 29 02 15 05 00 40 [SLOT] 00 F7  (12 bytes)
Response: F0 00 20 29 02 15 05 00 10 [SLOT] 06 20 0E [DATA...] F7  (434-560 bytes)
```

**WRITE Operation (Send custom mode TO device):**
```
Request:  F0 00 20 29 02 15 05 00 45 [SLOT] 00 20 0E [DATA...] F7  (452-572 bytes)
Response: F0 00 20 29 02 15 05 00 15 [SLOT] 06 F7  (12 bytes acknowledgment)
```

### ❌ Previous Incorrect Protocol

Our original implementation was using:
- Read command: `0x15` ❌ (should be `0x40` ✅)
- Write command: `0x10` ❌ (should be `0x45` ✅)
- Parameter field: `0x06` ❌ (should be `0x00` for read requests ✅)

## Detailed Protocol Analysis

### Message Structure

**Common SysEx Header:**
```
F0 00 20 29 02 15 05 00 [COMMAND] [SLOT] [PARAMS...] F7
│  │  │  │  │  │  │  │   │         │      │
│  │  │  │  │  │  │  │   │         │      └── Additional parameters
│  │  │  │  │  │  │  │   │         └── Slot number (0-14 for slots 1-15)
│  │  │  │  │  │  │  │   └── Command byte (0x40=read, 0x45=write, 0x15=ack)
│  │  │  │  │  │  │  └── Reserved (always 0x00)
│  │  │  │  │  │  └── Sub-command (always 0x05)
│  │  │  │  │  └── Command (always 0x15 for custom mode)
│  │  │  │  └── Device ID (0x02 for Launch Control XL 3)
│  │  │  └── Manufacturer ID (Focusrite/Novation)
│  │  └── Manufacturer ID continued
│  └── Manufacturer ID continued
└── SysEx start
```

### Example Real Communication

**Actual working read request/response:**
```
→ TO DEVICE:   F0 00 20 29 02 15 05 00 40 00 00 F7
← FROM DEVICE: F0 00 20 29 02 15 05 00 10 00 06 20 0E 44 69 67 69 74 61 6B 74 20 6D 69 78 65 72 21 00 48 10 02 21 00 00 08 00 53 7F 48 11 02 21 00 01 08 00 53 7F...

Mode name: "Digitakt mixer!"
Control data follows with 0x48 markers
```

### Response Data Format

**Custom Mode Response Structure:**
```
F0 00 20 29 02 15 05 00 10 [SLOT] 06 20 0E [NAME...] [CONTROLS...] F7
│                           │      │  │  │   │        │
│                           │      │  │  │   │        └── Control definitions
│                           │      │  │  │   └── Mode name (null-terminated)
│                           │      │  │  └── Name length marker
│                           │      │  └── Data type marker
│                           │      └── Additional header
│                           └── Slot number
```

**Control Definition Format:**
```
48 [ID] 02 [TYPE] [CH] [P1] [P2] [CC] 7F [00]
│  │    │  │      │    │    │    │    │   │
│  │    │  │      │    │    │    │    │   └── Padding
│  │    │  │      │    │    │    │    └── Max value (127)
│  │    │  │      │    │    │    └── CC number
│  │    │  │      │    │    └── Parameter 2
│  │    │  │      │    └── Parameter 1
│  │    │  │      └── MIDI channel (0-based)
│  │    │  └── Control type (0x21=encoder, 0x00=fader, etc.)
│  │    └── Definition type (always 0x02)
│  └── Control ID (0x10-0x17=faders, 0x18-0x27=encoders, 0x30-0x3F=buttons)
└── Control marker (always 0x48)
```

## Implementation Status

### ✅ What Works
1. **Protocol Format**: Corrected to match web editor exactly
2. **Message Structure**: Proper 12-byte read requests
3. **Device Response**: Confirmed device responds with 434-byte messages
4. **Command Bytes**: Correct `0x40` for read, `0x45` for write operations

### ❓ Technical Issue
**Node.js MIDI Input Handling**: Our implementations send the correct protocol but fail to capture the confirmed device responses. This appears to be a technical issue with:

- **Event handler setup timing**
- **Node-midi library SysEx handling**
- **Input buffer management for large messages**

The device IS responding (confirmed by external MIDI monitoring), but our Node.js event handlers aren't receiving the data.

## Next Steps for Implementation

1. **Investigate Node-midi SysEx Handling**: The library may need specific configuration for large SysEx messages
2. **Alternative MIDI Libraries**: Consider Web MIDI API or native implementations
3. **Response Timing**: May need different event handler setup or timing
4. **Port Configuration**: Verify correct input port configuration for SysEx

## Corrected Test Implementation

```typescript
// Correct read request
const readRequest = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, 0x00, 0x00, 0xF7];

// Expected response format
// F0 00 20 29 02 15 05 00 10 00 06 20 0E [NAME] [CONTROLS] F7
```

## Files Created
- `test-correct-web-editor-protocol.ts` - Uses exact protocol from capture
- `test-exact-web-editor-sequence.ts` - Includes DAW port pre-sequence
- `test-capture-response.ts` - Focused response capture implementation
- `test-cli-sysex.ts` - CLI infrastructure approach

All implementations use the correct protocol but encounter the same Node.js response capture issue.

## Conclusion

The protocol has been successfully corrected and matches the working web editor implementation exactly. The remaining challenge is a technical Node.js implementation detail for capturing large SysEx responses, not a protocol issue.