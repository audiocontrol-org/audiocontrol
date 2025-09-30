# Launch Control XL3 Protocol Specification

**Version:** 1.0
**Last Updated:** 2025-09-30
**Status:** Verified with hardware

## Overview

The Launch Control XL3 communicates via MIDI SysEx messages. Custom modes are fetched and stored using a multi-page protocol.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Custom Mode Fetch Protocol](#custom-mode-fetch-protocol)
- [Data Structures](#data-structures)
- [Examples](#examples)
- [Discovery Methodology](#discovery-methodology)

---

## Quick Reference

**Canonical Protocol Specification:** See [`../formats/launch_control_xl3.ksy`](../formats/launch_control_xl3.ksy)

The `.ksy` file is a Kaitai Struct specification that defines the **exact byte layout** of all protocol structures. It is:
- Machine-readable (can generate parsers)
- Human-readable (declarative format)
- Unambiguous (specifies exact byte positions, types, and sizes)
- Version-controlled (tracks protocol changes)

**Why .ksy?** It eliminates ambiguity. Instead of prose like "a length byte followed by name bytes", the spec states:
```yaml
- id: name_length
  type: u1
- id: name_bytes
  size: name_length
  type: str
  encoding: ASCII
```

---

## Custom Mode Fetch Protocol

### High-Level Flow

1. **Device Handshake** (4-message sequence)
   - Client sends SYN
   - Device responds with SYN-ACK containing serial number
   - Client sends Universal Device Inquiry (ACK)
   - Device responds with device info

2. **Slot Selection** (via DAW port)
   - Send Note On Ch16
   - Send CC query on Ch8
   - Device responds with current slot
   - Send CC selection on Ch7
   - Send Note Off Ch16

3. **Mode Fetch** (3 SysEx pages)
   - Request page 0 (controls 0-15 + mode name + labels)
   - Request page 1 (controls 16-31 + labels)
   - Request page 2 (controls 32-47 + labels)

### Multi-Page Structure

Custom mode data is split across **3 SysEx response pages** due to MIDI message size limits:

| Page | Controls | Contains Mode Name? | Label Control IDs |
|------|----------|---------------------|-------------------|
| 0    | 0-15     | Yes (first page only) | 0x10-0x1F |
| 1    | 16-31    | No | 0x20-0x2F |
| 2    | 32-47    | No | 0x30-0x3F |

Each page follows the same structure defined in `launch_control_xl3.ksy`.

---

## Data Structures

### Page Structure

```
[Page Header]
[Mode Name Section]  ← Only in page 0
[16× Control Definitions]
[Label Section]
```

**See [`launch_control_xl3.ksy`](../formats/launch_control_xl3.ksy) types:**
- `custom_mode_page` - Complete page structure
- `page_header` - Fixed 5-byte header
- `mode_name` - Variable-length name (page 0 only)
- `control_definition` - 7-byte control spec
- `label_section` - Variable-length labels

### Control Definition (7 bytes)

Each control is defined by exactly 7 bytes:

```
Offset | Type | Field        | Values
-------|------|--------------|------------------
0      | u1   | control_type | 0x00, 0x05, 0x09, 0x0D, 0x19, 0x25
1      | u1   | control_id   | 0x10-0x3F (16-63)
2      | u1   | midi_channel | 0-15
3      | u1   | cc_number    | 0-127
4      | u1   | min_value    | Usually 0
5      | u1   | max_value    | Usually 127
6      | u1   | behavior     | 0x0C=absolute, 0x0D=relative, 0x0E=toggle
```

### Mode Name Encoding

**Format:** `06 20 [length] [name_bytes...]`

- `06 20` - Fixed marker
- `length` - Number of characters (0-8)
- `name_bytes` - ASCII characters

**Example:**
```
06 20 08 43 48 41 4E 4E 45 56 45
      ↑  C  H  A  N  N  E  V  E
      └─ length = 8 chars
```

### Control Label Encoding ⭐

**Critical Discovery:** Labels use **length-encoding** where the marker byte encodes the string length.

**Format:** `[0x60 + length] [control_id] [name_bytes...] [next_marker]`

The marker byte range `0x60-0x6F` allows strings of 0-15 characters:
- `0x60` = empty string (0 chars)
- `0x65` = 5-character string
- `0x69` = 9-character string
- `0x6F` = 15-character string (maximum)

**Length calculation:**
```
length = marker_byte - 0x60
```

**Control ID Mapping:**
- Most label control IDs map directly to control IDs
- **Exception:** Label IDs 0x19-0x1C (25-28) map to control IDs 26-29 (+1 offset)

---

## Examples

### Example 1: "TEST1" Label

```
65 10 54 45 53 54 31 60
│  │  T  E  S  T  1
│  └─ Control ID 0x10
└─ Marker 0x65 = 0x60 + 5 → 5 characters
```

### Example 2: "High Pass" Label

```
69 14 48 69 67 68 20 50 61 73 73 60
│  │  H  i  g  h     P  a  s  s
│  └─ Control ID 0x14 (20)
└─ Marker 0x69 = 0x60 + 9 → 9 characters
```

### Example 3: Empty Label

```
60 11 60
│  │  └─ Next marker or terminator
│  └─ Control ID 0x11
└─ Marker 0x60 = 0x60 + 0 → 0 characters (empty)
```

### Example 4: Control ID Mapping Exception

Label with control ID 0x19 (25) maps to actual control ID 26:

```
68 19 4C 6F 77 20 46 72 65 71
│  │  L  o  w     F  r  e  q
│  └─ Label ID 0x19 → maps to control 26
└─ Marker 0x68 = 8 chars
```

**Mapping rule:**
```typescript
function mapLabelControlId(labelId: number): number {
  if (labelId >= 25 && labelId <= 28) {
    return labelId + 1;  // Labels 25-28 → controls 26-29
  }
  return labelId;  // Direct mapping for all others
}
```

---

## Discovery Methodology

**How was this protocol reverse-engineered?**

### Phase 1: Initial Analysis
1. Used existing heuristic parser (180+ lines, ~14% accuracy)
2. Captured MIDI traffic with CoreMIDI spy during device operations
3. Compared parser output with expected control names

### Phase 2: Systematic Testing
1. **Tools Used:**
   - Novation Components web editor (ground truth)
   - Playwright browser automation (programmatic control)
   - CoreMIDI MIDI snooping tool (traffic capture)
   - Custom analysis scripts

2. **Methodology:**
   - Changed control name from "High Pass" to "TEST1" in web editor
   - Sent modified mode to device via web editor
   - Captured exact MIDI bytes sent during operation
   - Retrieved mode from device
   - Compared byte sequences

3. **Key Discovery:**
   ```
   "TEST1" (5 chars):     65 10 54 45 53 54 31 60
   "High Pass" (9 chars): 69 14 48 69 67 68 20 50 61 73 73 60
   ```

   Realized: `0x65 = 0x60 + 5` and `0x69 = 0x60 + 9`

   **The marker byte encodes the string length!**

### Phase 3: Validation
1. Implemented length-encoding parser
2. Tested against all 21 named controls
3. Achieved 95% accuracy (20/21 correct)
4. One "failure" was intentional test data ("TEST1")

### Phase 4: Documentation
1. Created Kaitai Struct specification (`.ksy` file)
2. Validated spec by generating parser and comparing output
3. Documented control ID mapping exception (25-28 → 26-29)

---

## LED Control

**Important:** LED states are **NOT** stored in custom mode configurations.

LEDs are controlled via separate real-time MIDI messages:
- Message type: `0x78` (LED_CONTROL)
- Format: Standard MIDI CC or custom SysEx

Custom modes only store:
- Control definitions (CC mappings, channels, behaviors)
- Control labels (names)
- Mode name

---

## Parser Implementation

**Current Implementation:** `src/core/SysExParser.ts`

The parser follows the protocol specification exactly:

1. **Mode Name Parsing:**
   ```typescript
   // Format: 06 20 [length] [name_bytes]
   const lengthByte = data[i + 2];
   const nameLength = lengthByte;
   const nameBytes = data.slice(i + 3, i + 3 + nameLength);
   ```

2. **Control Label Parsing:**
   ```typescript
   // Format: [0x60 + length] [controlID] [name_bytes]
   const length = markerByte - 0x60;
   const controlId = data[i + 1];
   const nameBytes = data.slice(i + 2, i + 2 + length);
   const canonicalId = mapLabelControlId(controlId);
   ```

**Lines of code:** ~90 (down from 180+ heuristic version)
**Accuracy:** 95%+ (100% when test data removed)

---

## References

- **Formal Specification:** [`../formats/launch_control_xl3.ksy`](../formats/launch_control_xl3.ksy)
- **Parser Implementation:** [`../src/core/SysExParser.ts`](../src/core/SysExParser.ts)
- **Test Data:** [`../backup/`](../backup/) - Real device captures in JSON format

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-09-30 | Initial documented protocol after empirical discovery |

---

## Notes for Future Maintainers

1. **The `.ksy` file is the source of truth** for byte-level protocol details
2. **Test changes empirically** using the web editor + MIDI spy methodology
3. **Control ID mapping exception** (25-28 → 26-29) is hardware-specific, not a bug
4. **Length-encoding is critical** - marker byte `0x60 + length` determines string size
5. **No LED data in custom modes** - don't waste time looking for it

If protocol changes are needed:
1. Update `.ksy` file first
2. Validate with kaitai-struct-compiler
3. Update parser implementation to match
4. Add test case with real device capture
