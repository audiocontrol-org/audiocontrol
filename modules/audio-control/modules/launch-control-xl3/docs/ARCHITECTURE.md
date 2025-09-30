# Launch Control XL3 Library Architecture

**Purpose:** High-level overview for maintainers and AI assistants

## Quick Start for New Sessions

1. **Protocol Specification:** Read [`PROTOCOL.md`](./PROTOCOL.md) first
2. **Formal Spec:** See [`../formats/launch_control_xl3.ksy`](../formats/launch_control_xl3.ksy) for exact byte layouts
3. **Main Entry Point:** [`../src/LaunchControlXL3.ts`](../src/LaunchControlXL3.ts)
4. **Parser:** [`../src/core/SysExParser.ts`](../src/core/SysExParser.ts)

## Architecture Layers

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (User code, CLI, utilities)            │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│     LaunchControlXL3 (Main API)         │
│  • Device lifecycle management          │
│  • High-level control methods           │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────────────┐  ┌───▼──────────────┐
│ DeviceManager  │  │ CustomModeManager │
│ • Handshake    │  │ • Slot selection │
│ • Connection   │  │ • Mode fetch/send │
│ • DAW port     │  │ • Parsing         │
└───┬────────────┘  └───┬──────────────┘
    │                   │
    │         ┌─────────▼─────────┐
    │         │   SysExParser     │
    │         │ • Protocol parse  │
    │         │ • Message build   │
    │         └─────────┬─────────┘
    │                   │
┌───▼───────────────────▼─────────────────┐
│       MIDI Backend (Interface)          │
│  • JuceMidiBackend (HTTP server)        │
│  • WebMidiBackend (Browser API)         │
└─────────────────────────────────────────┘
```

## Key Components

### 1. LaunchControlXL3 (src/LaunchControlXL3.ts)

**Purpose:** Main user-facing API

**Responsibilities:**
- Device connection/disconnection
- High-level control operations
- Event management
- Delegates to specialized managers

**Key Methods:**
- `connect()` - Initialize device connection
- `readCustomMode(slot)` - Fetch mode from device
- `writeCustomMode(slot, mode)` - Send mode to device
- `setControlValue(id, value)` - Real-time control

### 2. DeviceManager (src/device/DeviceManager.ts)

**Purpose:** Low-level device communication

**Responsibilities:**
- MIDI port management
- 4-message handshake protocol
- DAW port control
- Message send/receive

**Handshake Sequence:**
```typescript
1. Send Novation SYN (F0 00 20 29 00 42 02 F7)
2. Receive SYN-ACK with serial number
3. Send Universal Device Inquiry (F0 7E 7F 06 01 F7)
4. Receive device info (manufacturer, model, firmware)
```

### 3. CustomModeManager (src/modes/CustomModeManager.ts)

**Purpose:** Custom mode operations

**Responsibilities:**
- Slot selection via DAW port
- Multi-page mode fetch
- Mode writing
- Data validation

**Fetch Process:**
```typescript
1. Select slot (via DAW port, 6-step protocol)
2. Request page 0 → Parse controls 0-15 + mode name + labels
3. Request page 1 → Parse controls 16-31 + labels
4. Request page 2 → Parse controls 32-47 + labels
5. Merge all data into CustomMode object
```

### 4. SysExParser (src/core/SysExParser.ts)

**Purpose:** Protocol parsing and message building

**Responsibilities:**
- Parse mode name (length-encoded)
- Parse control definitions (7 bytes each)
- Parse control labels (length-encoded)
- Build SysEx messages for device
- Control ID mapping (25-28 → 26-29 exception)

**Critical Functions:**
- `parseName()` - Parse mode name with length byte
- `parseControlLabels()` - Length-encoding label parser
- `mapLabelControlId()` - Handle control ID mapping exception

**Parsing Strategy:**
```typescript
// Mode name: 06 20 [length] [name_bytes]
const length = data[i + 2];
const name = String.fromCharCode(...data.slice(i + 3, i + 3 + length));

// Labels: [0x60 + length] [control_id] [name_bytes]
const length = markerByte - 0x60;
const controlId = data[i + 1];
const name = String.fromCharCode(...data.slice(i + 2, i + 2 + length));
const canonicalId = mapLabelControlId(controlId);
```

### 5. MIDI Backends (src/backends/)

**Purpose:** Abstract MIDI communication

**Implementations:**
- **JuceMidiBackend** - HTTP server (JUCE C++ backend)
- **WebMidiBackend** - Browser Web MIDI API

**Interface:**
```typescript
interface MidiBackend {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendSysEx(data: number[]): Promise<void>;
  onMessage(callback: (data: number[]) => void): void;
}
```

## Data Flow

### Reading a Custom Mode

```
User Code
  │
  ├─> device.readCustomMode(0)
  │
DeviceManager
  │
  ├─> Select slot via DAW port (6-step protocol)
  │
CustomModeManager
  │
  ├─> Request page 0
  │   └─> Parse with SysExParser
  │       ├─> parseName() → "CHANNEVE"
  │       ├─> parseControls() → 16 controls
  │       └─> parseControlLabels() → ["High Pass", "Low Pass", ...]
  │
  ├─> Request page 1
  │   └─> Parse 16 more controls + labels
  │
  ├─> Request page 2
  │   └─> Parse final 16 controls + labels
  │
  └─> Merge into CustomMode {
        name: "CHANNEVE",
        controls: { ... 48 controls ... }
      }
```

### Label Parsing Detail

```
Input: 69 14 48 69 67 68 20 50 61 73 73 60
       │  │  H  i  g  h     P  a  s  s
       │  └─ Control ID 0x14 (20)
       └─ Marker 0x69

Step 1: Calculate length
  length = 0x69 - 0x60 = 9

Step 2: Read control ID
  controlId = 0x14

Step 3: Read name bytes
  nameBytes = [0x48, 0x69, 0x67, 0x68, 0x20, 0x50, 0x61, 0x73, 0x73]
  name = "High Pass"

Step 4: Map control ID
  canonicalId = mapLabelControlId(0x14) = 0x14  // Direct mapping

Step 5: Store
  controlNames.set(0x14, "High Pass")
```

## Type System

### Core Types (src/types/)

```typescript
// CustomMode.ts
interface CustomMode {
  name: string;                              // Max 8 chars
  controls: Record<string, ControlMapping>;  // 48 controls
  metadata?: { ... };
  slot?: number;                             // 0-15
}

interface ControlMapping {
  controlId: number;         // 0x10-0x3F
  ccNumber: number;          // 0-127
  channel: number;           // 0-15 (MIDI channels)
  minValue: number;          // Usually 0
  maxValue: number;          // Usually 127
  behavior: 'absolute' | 'relative' | 'toggle';
  name?: string;             // User-assigned label
}
```

## Testing Strategy

### Unit Tests
- SysExParser parsing logic
- Control ID mapping
- Message building
- Data validation

### Integration Tests
- Full mode fetch cycle
- Multi-page parsing
- DAW port slot selection
- Handshake protocol

### Hardware Tests
- `utils/backup-current-mode.ts` - Real device fetch
- `utils/test-round-trip-node.ts` - Write then read validation
- Backup files in `backup/` directory serve as test fixtures

## Common Pitfalls

### 1. ❌ Control ID Confusion

**Problem:** Label control IDs 25-28 don't match control IDs 26-29

**Solution:** Always use `mapLabelControlId(labelId)` when parsing labels

```typescript
// WRONG
controlNames.set(labelControlId, name);

// CORRECT
const canonicalId = mapLabelControlId(labelControlId);
controlNames.set(canonicalId, name);
```

### 2. ❌ ASCII Overlap Ambiguity

**Problem:** Bytes 0x60-0x6F are both marker bytes AND valid ASCII letters

**Solution:** Use length-encoding, don't try to detect patterns

```typescript
// WRONG - trying to detect "looks like a marker"
if (byte >= 0x60 && byte <= 0x6F && nextByte >= 0x10) {
  // Might be a marker... or might be a letter 'h' in "High Pass"
}

// CORRECT - calculate length, read exact bytes
const length = markerByte - 0x60;
const nameBytes = data.slice(offset, offset + length);
```

### 3. ❌ Assuming LED Data Exists

**Problem:** Looking for LED configurations in custom mode fetch

**Solution:** LED states are NOT in custom mode data. They're real-time only.

```typescript
// WRONG
const ledColor = parseLedData(data);

// CORRECT
// Custom modes don't contain LED data.
// Use LED_CONTROL messages (0x78) for real-time LED control.
```

### 4. ❌ Forgetting Multi-Page Structure

**Problem:** Trying to parse all 48 controls from one page

**Solution:** Always fetch and merge all 3 pages

```typescript
// WRONG
const mode = parseCustomMode(page0Data);  // Only has 16 controls!

// CORRECT
const page0 = parseCustomModePage(page0Data);  // Controls 0-15
const page1 = parseCustomModePage(page1Data);  // Controls 16-31
const page2 = parseCustomModePage(page2Data);  // Controls 32-47
const mode = mergePages(page0, page1, page2);  // All 48 controls
```

## Development Workflow

### Making Protocol Changes

1. **Update formal spec:** Edit `formats/launch_control_xl3.ksy`
2. **Validate spec:** Run `kaitai-struct-compiler --help formats/launch_control_xl3.ksy`
3. **Update parser:** Modify `src/core/SysExParser.ts` to match
4. **Update docs:** Sync changes to `docs/PROTOCOL.md`
5. **Test empirically:** Use backup utility + real device
6. **Add test case:** Save device capture in `backup/` directory

### Debugging Protocol Issues

1. **Capture MIDI traffic:**
   ```bash
   cd ../../modules/coremidi/midi-snoop
   make run
   # Traffic appears in spy output
   ```

2. **Enable debug logging:** Parser already has extensive console.log statements

3. **Compare with web editor:**
   - Use Novation Components web editor as ground truth
   - Use Playwright automation to control web editor programmatically
   - Compare byte sequences

4. **Analyze with .ksy viewer:**
   - Use Kaitai Struct IDE: https://ide.kaitai.io/
   - Upload `.ksy` file and binary data
   - Visualize parsed structures

## Performance Characteristics

- **Handshake:** ~500ms (4 message round-trips)
- **Slot selection:** ~300ms (6-step DAW port protocol)
- **Page fetch:** ~100ms per page
- **Total mode fetch:** ~1.5-2.0 seconds
- **Parsing:** <10ms (in-memory, no I/O)

## File Organization

```
launch-control-xl3/
├── docs/
│   ├── ARCHITECTURE.md     ← You are here
│   └── PROTOCOL.md         ← Protocol specification
├── formats/
│   └── launch_control_xl3.ksy  ← Canonical formal spec (Kaitai Struct)
├── src/
│   ├── LaunchControlXL3.ts     ← Main API entry point
│   ├── core/
│   │   └── SysExParser.ts      ← Protocol parsing/building
│   ├── device/
│   │   └── DeviceManager.ts    ← Low-level MIDI
│   ├── modes/
│   │   └── CustomModeManager.ts  ← Mode operations
│   ├── backends/
│   │   ├── JuceMidiBackend.ts  ← HTTP backend
│   │   └── WebMidiBackend.ts   ← Browser backend
│   ├── types/
│   │   ├── CustomMode.ts       ← Core type definitions
│   │   ├── protocol.ts         ← Protocol types
│   │   └── device.ts           ← Device types
│   └── generated/              ← Kaitai-generated parser (optional)
├── utils/
│   ├── backup-current-mode.ts  ← Fetch and save modes
│   └── test-*.ts               ← Various test utilities
└── backup/                     ← Real device captures (test fixtures)
```

## External Dependencies

### Runtime
- `kaitai-struct` (optional) - If using generated parser

### Development
- `kaitai-struct-compiler` - Generate parsers from `.ksy` specs
- `playwright` - Web automation for testing web editor
- CoreMIDI spy - MIDI traffic capture (JUCE-based)

### JUCE Backend
- HTTP server (C++) at `http://localhost:7777`
- See `../../juce/midi-server/` for implementation

## Key Decisions & Rationale

### Why Not Use Generated Kaitai Parser?

**Decision:** Keep hand-written parser in `SysExParser.ts`

**Rationale:**
1. Parser is now simple (90 lines) after removing heuristics
2. Generated parser is less readable (~200 lines)
3. No build step complexity
4. Direct control over error messages
5. TypeScript-native (no JS/TS interop)

**Keep `.ksy` file because:**
- Serves as formal, unambiguous spec
- Can generate visualizations
- Can validate changes before coding
- Machine-readable documentation

### Why Length-Encoding?

**Discovery:** Through empirical testing, not speculation

**Evidence:**
```
"TEST1": 65 10 54 45 53 54 31 60
         ↑
         0x65 = 0x60 + 5 characters

"High Pass": 69 14 48 69 67 68 20 50 61 73 73 60
             ↑
             0x69 = 0x60 + 9 characters
```

**Impact:** Eliminates all parsing ambiguity. No heuristics needed.

### Why Multi-Page Protocol?

**Constraint:** MIDI SysEx message size limits

**Solution:** Device splits 48 controls across 3 pages of 16 controls each

**Trade-off:** More round-trips (slower), but reliable pagination

## Future Considerations

### Potential Protocol Extensions
- Mode writing (currently send-only via web editor)
- LED configurations (if device adds support)
- Additional control types
- Firmware updates

### Known Limitations
- No LED state in custom modes
- Maximum 8-character mode names
- Maximum 15-character control labels
- Fixed 48 controls per mode

---

**Last Updated:** 2025-09-30
**Maintainers:** See git history for contributors
