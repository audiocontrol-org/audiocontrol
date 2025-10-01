# Launch Control XL3 Protocol Specification

**Version:** 1.3
**Last Updated:** 2025-09-30
**Status:** Verified with hardware

## Overview

The Launch Control XL3 communicates via MIDI SysEx messages. Custom modes are fetched and stored using a multi-page protocol.

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

2. **Slot Selection** (via DAW port - see [DAW Port Protocol](#daw-port-protocol))
   - Phase 1: Query current slot (6-message sequence)
   - Phase 2: Set target slot (3-message sequence)

3. **Mode Fetch** (3 SysEx pages)
   - Request page 0 (controls 0-15 + mode name + labels)
   - Request page 1 (controls 16-31 + labels)
   - Request page 2 (controls 32-47 + labels)

### Read Request Slot Byte Behavior ⭐

**Critical Discovery (2025-09-30):** The read request contains a slot byte, but its behavior differs from intuitive expectations:

- **Slot byte = 0x00:** Reads from DAW-port-selected slot (CORRECT for write/read round-trip)
- **Slot byte > 0x00:** Reads from explicit slot, IGNORING DAW port selection

**Discovery Method:** MIDI spy analysis during write/read round-trip testing revealed mismatch when using explicit slot bytes.

**Implication:** When using DAW port protocol for slot selection, read requests MUST use slot byte `0x00` to read from the selected slot. Using explicit slot values (1-15) will read from those slots regardless of DAW port state.

**Example:**
```
DAW port selects slot 2 (CC value 0x07)
Read with slot byte 0x00 → Returns slot 2 data ✓
Read with slot byte 0x01 → Returns slot 1 data (ignores DAW port) ✗
```

### Multi-Page Structure

Custom mode data is split across **3 SysEx response pages** due to MIDI message size limits:

| Page | Controls | Contains Mode Name? | Label Control IDs |
|------|----------|---------------------|-------------------|
| 0    | 0-15     | Yes (first page only) | 0x10-0x1F |
| 1    | 16-31    | No | 0x20-0x2F |
| 2    | 32-47    | No | 0x30-0x3F |

Each page follows the same structure defined in `launch_control_xl3.ksy`.

---

## Custom Mode Write Protocol

### Overview

Writing a custom mode to the device uses command `0x45` with a multi-page protocol and acknowledgement handshake.

**Discovery Method:** Web editor MIDI traffic capture using CoreMIDI spy (2025-09-30)

### Write Flow with Acknowledgements ⭐

**Critical Discovery (2025-09-30):** The device sends acknowledgement SysEx messages after receiving each page. The client MUST wait for these acknowledgements before sending the next page.

**Complete Write Sequence:**
1. Send page 0 write command (`0x45 00`)
2. **Wait for device acknowledgement** (`0x15 00 06`)
3. Send page 3 write command (`0x45 03`)
4. **Wait for device acknowledgement** (`0x15 03 06`)

**Timing:** Device typically responds within 24-27ms. Web editor waits for acknowledgement before proceeding.

**Discovery Method:** Playwright browser automation + CoreMIDI spy, observing [DEST] and [SRC] traffic during web editor write operations.

### Multi-Page Write Protocol

Custom modes require **TWO pages** to be written (not three like reads):

| Page | Control IDs | Contains Mode Name? |
|------|-------------|---------------------|
| 0    | 0x10-0x27 (16-39) | Yes |
| 3    | 0x28-0x3F (40-63) | Yes |

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
                           │  └─ Page 0
                           └─ Write command 0x45

37:06.079  [← Device] Page 0 Acknowledgement (27ms later)
F0 00 20 29 02 15 05 00 15 00 06 F7
                           │  │  └─ Status 0x06 (success)
                           │  └─ Page 0 acknowledged
                           └─ Acknowledgement command 0x15

37:06.079  [→ Device] Page 3 Write (sent immediately after ACK)
F0 00 20 29 02 15 05 00 45 03 00 20 08 43 48 41 4E 4E 45 56 45 ...
                           │  │
                           │  └─ Flag 0x00
                           └─ Page 3

37:06.103  [← Device] Page 3 Acknowledgement (24ms later)
F0 00 20 29 02 15 05 00 15 03 06 F7
                           │  │  └─ Status 0x06 (success)
                           │  └─ Page 3 acknowledged
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

### Phase 4: Documentation
1. Created Kaitai Struct specification (`.ksy` file)
2. Validated spec by generating parser and comparing output
3. Documented control ID mapping exception (25-28 → 26-29)

---

## DAW Port Protocol

### Overview

The Launch Control XL3 uses a **dual-port MIDI system**:
- **MIDI Port**: SysEx data transfers (read/write custom modes, device info)
- **DAW Port**: Out-of-band control (slot selection, mode switching)

**Critical Discovery:** The slot byte in SysEx messages does NOT control target slot. Instead, the device uses an out-of-band slot selection protocol via the DAW port.

### Two-Phase Slot Selection Protocol

Slot selection requires a bidirectional negotiation with the device:

#### Phase 1: Query Current Slot (6 messages)
```
1. Client → Device: Note On  (Ch16, Note 11, Vel 127)  [0x9F, 0x0B, 0x7F]
2. Client → Device: CC Query (Ch8,  CC 30,  Val 0)     [0xB7, 0x1E, 0x00]
3. Device → Client: Note On echo
4. Device → Client: CC Response (Ch7, CC 30, current_slot)
5. Client → Device: Note Off (Ch16, Note 11, Vel 0)    [0x8F, 0x0B, 0x00]
6. Device → Client: Note Off echo
```

#### Phase 2: Set Target Slot (3 messages)
```
1. Client → Device: Note On  (Ch16, Note 11, Vel 127)  [0x9F, 0x0B, 0x7F]
2. Client → Device: CC Set   (Ch7,  CC 30,  target_slot) [0xB6, 0x1E, value]
3. Client → Device: Note Off (Ch16, Note 11, Vel 0)    [0x8F, 0x0B, 0x00]
```

### Channel Mapping

- **Channel 16 (0x0F)**: Note On/Off wrapper messages
- **Channel 8 (0x07)**: Query messages (CC value = 0)
- **Channel 7 (0x06)**: Set commands and device responses

### Slot Value Encoding

CC values map to physical slots with an offset:

| Physical Slot | API Slot | CC Value |
|---------------|----------|----------|
| 1 | 0 | 6 |
| 2 | 1 | 7 |
| 3 | 2 | 8 |
| ... | ... | ... |
| 15 | 14 | 20 |

**Formula:**
```
CC_Value = Physical_Slot + 5
CC_Value = API_Slot + 6
```

### Implementation Example

```typescript
async selectSlot(apiSlot: number): Promise<void> {
  const ccValue = apiSlot + 6;  // Convert API slot to CC value

  // Phase 1: Query current slot
  await sendDAW([0x9F, 0x0B, 0x7F]);  // Note On Ch16
  await sendDAW([0xB7, 0x1E, 0x00]);  // CC Query Ch8
  const response = await waitForResponse();  // Device sends current slot
  await sendDAW([0x8F, 0x0B, 0x00]);  // Note Off Ch16

  await delay(10);  // Inter-phase delay

  // Phase 2: Set target slot
  await sendDAW([0x9F, 0x0B, 0x7F]);        // Note On Ch16
  await sendDAW([0xB6, 0x1E, ccValue]);     // CC Set Ch7
  await sendDAW([0x8F, 0x0B, 0x00]);        // Note Off Ch16

  await delay(50);  // Allow device to process
}
```

### Complete Read/Write Flow

**Writing to a specific slot:**
1. Execute two-phase slot selection protocol (DAW port)
2. Wait ~50ms for device to process
3. Send SysEx write command (MIDI port)
4. Device writes to the selected slot

**Reading from a specific slot:**
1. Execute two-phase slot selection protocol (DAW port)
2. Send SysEx read command (MIDI port)
3. Device returns data from the selected slot

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

If protocol changes are needed:
1. Update `.ksy` file first
2. Validate with kaitai-struct-compiler
3. Update parser implementation to match
4. Add test case with real device capture
