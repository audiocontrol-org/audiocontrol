# Launch Control XL3 Protocol Specification

**Version:** 1.7
**Last Updated:** 2025-10-09
**Status:** Verified with hardware

## Overview

The Launch Control XL3 communicates via MIDI SysEx messages. Custom modes are fetched and stored using a multi-page protocol with slot selection via SysEx slot byte parameter.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Custom Mode Fetch Protocol](#custom-mode-fetch-protocol)
- [Custom Mode Write Protocol](#custom-mode-write-protocol)
- [Data Structures](#data-structures)
- [Parsed Response Format](#parsed-response-format)
- [Examples](#examples)
- [Discovery Methodology](#discovery-methodology)

---

## Quick Reference

**Canonical Protocol Specification:** See [`../formats/launch_control_xl3.ksy`](../formats/launch_control_xl3.ksy)

The `.ksy` file is a Kaitai Struct specification that defines the **exact byte layout** of all protocol structures. It serves as:
- Formal specification (unambiguous binary format)
- Documentation (declarative, human-readable)
- Validation tool (can verify parser correctness)
- Version control (tracks protocol changes)

**Note:** The library uses a hand-written parser in `SysExParser.ts` (90 lines, highly readable). The `.ksy` file serves as formal documentation, not for code generation.

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

2. **Slot Selection** (via SysEx slot byte parameter)
   - Simply include the target slot number (0-14) in the SysEx read request
   - Slot 15 (0x0F) is reserved for immutable factory content and cannot be read or written

3. **Mode Fetch** (2 SysEx pages)
   - Request page 0 (controls 0x10-0x27 + mode name + labels)
   - Request page 1 (controls 0x28-0x3F + mode name + labels)

### Read Request Format

**SysEx Read Request:**
```
F0 00 20 29 02 15 05 00 40 [PAGE] [SLOT] F7
```

Where:
- `F0` = SysEx start
- `00 20 29` = Novation manufacturer ID
- `02` = Device ID (Launch Control XL 3)
- `15` = Command (Custom mode)
- `05` = Sub-command
- `00` = Reserved
- `40` = Read operation
- `[PAGE]` = Page byte (0x00 for page 0, 0x03 for page 1)
- `[SLOT]` = Slot number (0-14) - Slot 15 (0x0F) is reserved and immutable
- `F7` = SysEx end

**Page byte mapping:**
- Logical page 0 → SysEx page byte 0x00
- Logical page 1 → SysEx page byte 0x03

**Discovery Method:** Empirical testing (2025-10-01). The SysEx slot byte parameter directly selects the target slot without requiring DAW port protocol.

**Implementation:** See `SysExParser.buildCustomModeReadRequest(slot, page)` at line 966-994 in `src/core/SysExParser.ts`.

### Multi-Page Structure

Custom mode data is split across **2 SysEx response pages** due to MIDI message size limits:

| Logical Page | SysEx Page Byte | Controls | Contains Mode Name? | Label Control IDs |
|--------------|-----------------|----------|---------------------|-------------------|
| 0            | 0x00            | 0x10-0x27 (24 controls) | Yes (both pages) | 0x10-0x27 |
| 1            | 0x03            | 0x28-0x3F (24 controls) | Yes (both pages) | 0x28-0x3F |

**Total: 48 controls** (0x10-0x3F)

Each page follows the same structure defined in `launch_control_xl3.ksy`.

**Discovery Method:** MIDI spy capture (2025-10-01) - Web editor slot fetch revealed page bytes 0x00 and 0x03.

**Important:** Pages are fetched **sequentially**, not in parallel. Send page 0 request, wait for response, then send page 1 request. See `DeviceManager.readCustomMode()` at line 621-780.

---

## Custom Mode Write Protocol

### Overview

Writing a custom mode to the device uses command `0x45` with a multi-page protocol and acknowledgement handshake.

**Discovery Method:** Web editor MIDI traffic capture using CoreMIDI spy (2025-09-30)

### Write Flow with Acknowledgements

**Critical Discovery (2025-09-30):** The device sends acknowledgement SysEx messages after receiving each page. The client MUST wait for these acknowledgements before sending the next page.

**Complete Write Sequence:**
1. Send page 0 write command (`0x45 00`)
2. **Wait for device acknowledgement** (`0x15 00 06`)
3. Send page 1 write command (`0x45 03`)
4. **Wait for device acknowledgement** (`0x15 03 06`)

**Timing:** Device typically responds within 24-27ms. Web editor waits for acknowledgement before proceeding.

**Discovery Method:** Playwright browser automation + CoreMIDI spy, observing [DEST] and [SRC] traffic during web editor write operations.

### Multi-Page Write Protocol

Custom modes require **TWO pages** to be written:

| Logical Page | SysEx Page Byte | Control IDs | Contains Mode Name? |
|--------------|-----------------|-------------|---------------------|
| 0            | 0x00            | 0x10-0x27 (16-39) | Yes |
| 1            | 0x03            | 0x28-0x3F (40-63) | Yes |

**Note:** Control IDs 0x00-0x0F do not exist on the device hardware. Only IDs 0x10-0x3F (48 controls total).

### SysEx Message Format

**Write Command:**
```
F0 00 20 29 02 15 05 00 45 [page] 00 [mode_data] F7
│  └─ Novation ID       │  │  │  └─ Write command
│                       │  │  └─ Sub-command
│                       │  └─ Command (Custom mode)
│                       └─ Device ID
└─ SysEx start
```

**Acknowledgement Response:**
```
F0 00 20 29 02 15 05 00 15 [page] 06 F7
│                       │  │  │  └─ Status (0x06 = success)
│                       │  │  └─ Page number acknowledged
│                       │  └─ Acknowledgement command
│                       └─ Command group
```

**Key Differences from Read Protocol:**
- Command byte: `0x45` (write) vs `0x40` (read request) / `0x10` (read response)
- Page byte followed by `0x00` flag
- Mode name format: `20 [length] [bytes]` (no `06` prefix)
- **Requires waiting for acknowledgements between pages**

### Slot Selection for Writes

Slot selection is handled by the SysEx slot byte parameter. Simply include the target slot number (0-14) when constructing the write request.

**No DAW port protocol required.** Earlier protocol versions incorrectly assumed DAW port was mandatory. Empirical testing confirmed the SysEx slot byte works independently.

See `DeviceManager.writeCustomMode()` at line 785-878 for implementation.

### Mode Name Encoding

**Write format:**
```
20 [length] [name_bytes...]
```

**Example:**
```
20 08 43 48 41 4E 54 45 53 54
│  │  └─ "CHANTEST" (8 ASCII bytes)
│  └─ Length (8)
└─ Prefix
```

**Read format (for comparison):**
```
06 20 [length] [name_bytes...]
```

**Discovery:** By comparing MIDI captures of web editor write operations with different mode names:
1. Captured write with "CHANNEVE": `20 08 43 48 41 4E 4E 45 56 45`
2. Captured write with "CHANTEST": `20 08 43 48 41 4E 54 45 53 54`
3. Pattern identified: `0x20` prefix, length byte, raw ASCII

**Validation:** 2025-09-30 - Verified with Novation Components web editor v1.60.0

### Example: Complete Write Sequence with Acknowledgements

**Captured from web editor (2025-09-30 at 37:06):**

```
37:06.052  [→ Device] Page 0 Write
F0 00 20 29 02 15 05 00 45 00 00 20 08 43 48 41 4E 4E 45 56 45 ...
                           │  │  │  Mode name: "CHANNEVE"
                           │  │  └─ Flag 0x00
                           │  └─ Page 0 (SysEx byte 0x00)
                           └─ Write command 0x45

37:06.079  [← Device] Page 0 Acknowledgement (27ms later)
F0 00 20 29 02 15 05 00 15 00 06 F7
                           │  │  └─ Status 0x06 (success)
                           │  └─ Page 0 acknowledged
                           └─ Acknowledgement command 0x15

37:06.079  [→ Device] Page 1 Write (sent immediately after ACK)
F0 00 20 29 02 15 05 00 45 03 00 20 08 43 48 41 4E 4E 45 56 45 ...
                           │  │
                           │  └─ Flag 0x00
                           └─ Page 1 (SysEx byte 0x03)

37:06.103  [← Device] Page 1 Acknowledgement (24ms later)
F0 00 20 29 02 15 05 00 15 03 06 F7
                           │  │  └─ Status 0x06 (success)
                           │  └─ Page 1 acknowledged
                           └─ Acknowledgement command 0x15
```

**Key Observations:**
- Web editor waits for acknowledgement before sending next page
- Acknowledgements arrive 24-27ms after write command
- Status byte `0x06` indicates successful receipt
- Page number in acknowledgement matches write command page number

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

### Control Label Encoding

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

## Parsed Response Format (JavaScript/TypeScript)

After SysEx parsing, the `DeviceManager.readCustomMode()` returns data in one of two formats:

### Array Format (Legacy/Fallback)
```javascript
{
  name: "MODE_NAME",  // String, max 8 characters
  controls: [
    {
      controlId: 0x10,       // number: 0x10-0x3F main controls, 0x68-0x6F side buttons
      channel: 0,            // number: 0-15
      ccNumber: 13,          // number: 0-127
      minValue: 0,           // number: 0-127 (optional)
      maxValue: 127,         // number: 0-127 (optional)
      behaviour: 'absolute'  // string: 'absolute' | 'relative1' | 'relative2' | 'toggle'
    }
    // ... up to 48 controls
  ],
  colors: [],               // Color mappings (optional)
  labels: Map<number, string>  // Control labels keyed by control ID
}
```

### Object Format (Real Device Response)
```javascript
{
  name: "MODE_NAME",
  controls: {
    "0x10": { controlId: 0x10, channel: 0, ccNumber: 13, ... },
    "0x11": { controlId: 0x11, channel: 1, ccNumber: 14, ... },
    // ... keyed by control ID (hex string)
  },
  colors: [],
  labels: Map<number, string>
}
```

**Note**: The `CustomModeManager.parseCustomModeResponse()` handles both formats automatically using:
```typescript
const controlsArray = Array.isArray(response.controls)
  ? response.controls
  : Object.values(response.controls);
```

This defensive coding ensures compatibility with device firmware variations.

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

### Phase 4: Slot Selection Discovery
1. Initial assumption: DAW port protocol required for slot selection
2. Tested SysEx slot byte parameter directly (2025-10-01)
3. Discovery: Slot byte works independently - DAW port NOT required
4. Updated code to use SysEx slot byte (commit 756cacd)
5. Removed DawPortController infrastructure

### Phase 5: Documentation
1. Created Kaitai Struct specification (`.ksy` file)
2. Validated spec by generating parser and comparing output
3. Documented control ID mapping exception (25-28 → 26-29)
4. Updated all documentation to reflect slot selection discovery

---

## DAW Port Protocol (DEPRECATED)

**Status:** DEPRECATED as of 2025-10-01

**Historical Note:** Earlier protocol versions documented an extensive 2-phase DAW port protocol for slot selection. This was based on observations of the web editor, which does use the DAW port for some operations.

**Discovery (2025-10-01):** The SysEx slot byte parameter works independently for slot selection. Simply include the slot number (0-14) in the SysEx read/write request. No DAW port communication required.

**Implementation:** The DawPortController class has been removed from the codebase (commit 756cacd). See `DeviceManager.ts` lines 627 and 790 for comments confirming this.

**Why the confusion?** The web editor uses DAW port for UI feedback and mode switching, but it's not required for SysEx slot targeting. The SysEx slot byte is the canonical mechanism.

**Reference:** For historical documentation of the DAW port protocol, see git history before commit 756cacd (2025-10-09).

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
- **Device Manager:** [`../src/device/DeviceManager.ts`](../src/device/DeviceManager.ts)
- **Test Data:** [`../backup/`](../backup/) - Real device captures in JSON format

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.7 | 2025-10-09 | **MAJOR UPDATE:** Corrected page mapping documentation. Logical pages 0 and 1 map to SysEx page bytes 0x00 and 0x03. Removed extensive DAW port protocol documentation (deprecated). Clarified that slot selection uses SysEx slot byte directly. Updated all examples to reflect working code. |
| 1.6 | 2025-10-01 | **DEFINITIVE:** SysEx read/write DOES have slot parameter. Format is `F0 00 20 29 02 15 05 00 40 [PAGE] [SLOT] F7` where `[SLOT]` is slot number 0-14 (slot 15 reserved and immutable). DAW port protocol is NOT required for slot selection. |
| 1.5 | 2025-10-01 | **RETRACTED:** Incorrectly stated SysEx has no slot parameter. |
| 1.4 | 2025-10-01 | **Critical:** Corrected read protocol - uses 2 pages (0x00, 0x03), not 3 pages (0, 1, 2). Documented complete DAW port bidirectional protocol with device echoes. |
| 1.3 | 2025-09-30 | Added Parsed Response Format section documenting both array and object control formats |
| 1.2 | 2025-09-30 | **Critical:** Discovered write acknowledgement protocol (command 0x15). Device sends ACK after each page write. Client must wait for ACK before sending next page. |
| 1.1 | 2025-09-30 | Documented write protocol (command 0x45) with mode name format discovery |
| 1.0 | 2025-09-30 | Initial documented protocol after empirical discovery |

---

## Notes for Future Maintainers

1. **The `.ksy` file is the source of truth** for byte-level protocol details
2. **Test changes empirically** using the web editor + MIDI spy methodology
3. **Control ID mapping exception** (25-28 → 26-29) is hardware-specific, not a bug
4. **Length-encoding is critical** - marker byte `0x60 + length` determines string size
5. **No LED data in custom modes** - don't waste time looking for it
6. **Device returns controls in both array and object format** - parser must handle both
7. **Slot selection uses SysEx slot byte** - no DAW port protocol required
8. **Page bytes:** Logical page 0→0x00, logical page 1→0x03 in SysEx messages

If protocol changes are needed:
1. Update `.ksy` file first
2. Validate with kaitai-struct-compiler
3. Update parser implementation to match
4. Add test case with real device capture
5. Update this documentation
