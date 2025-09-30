# Launch Control XL3 DAW Port Protocol Documentation

## Overview

The Launch Control XL3 uses a dual-port MIDI system for communication:
- **MIDI Port**: Standard port for SysEx data transfers (read/write custom modes, device info)
- **DAW Port**: Out-of-band control port for slot selection, mode changes, and other control messages

## Critical Discovery: Slot Selection via DAW Port

The slot byte in SysEx messages (position 9) **does not control where data is written**. Instead, the device uses an out-of-band slot selection mechanism via the DAW port.

### The Problem
When writing custom mode data using only the MIDI port:
- Sending to slot 0 (0x00) would write to physical slot 2
- The slot byte in the SysEx message was being ignored
- The device was using a previously selected slot or defaulting to slot 2

### The Solution
The Novation Components web editor uses the DAW port to select slots before writing:

```
1. Send slot selection via DAW port (CC message)
2. Send SysEx write command via MIDI port (with slot byte 0x00)
3. Device writes to the previously selected slot
```

## DAW Port Slot Selection Protocol (Updated)

### Two-Phase Negotiation Protocol

**IMPORTANT UPDATE**: Analysis of web editor transcripts reveals a more complex bidirectional protocol:

#### Phase 1: Query Current Slot
1. **Editor → Device**: Note On (channel 16, note 11, velocity 127)
2. **Editor → Device**: CC (channel 8, controller 30, value 0) - Query request
3. **Device → Editor**: Note On echo
4. **Device → Editor**: CC (channel 7, controller 30, current_value) - Current slot response
5. **Editor → Device**: Note Off (channel 16, note 11, velocity 0)
6. **Device → Editor**: Note Off echo

#### Phase 2: Set Target Slot
1. **Editor → Device**: Note On (channel 16, note 11, velocity 127)
2. **Editor → Device**: CC (channel 7, controller 30, target_value) - Set slot
3. **Editor → Device**: Note Off (channel 16, note 11, velocity 0)
4. **Device → Editor**: Echoes all messages

### Channel Usage (Corrected)
- **Channel 16** (0x0F/15): Note On/Off messages
- **Channel 8** (0x07/7): CC query messages (value = 0)
- **Channel 7** (0x06/6): CC slot selection and device responses

**Note**: Previous documentation incorrectly stated channel 6 for CC messages. The correct channels are 7 and 8.

### Slot Value Mapping
The CC value maps to physical slots as follows:
- CC Value 6 → Physical Slot 1 (API slot 0)
- CC Value 7 → Physical Slot 2 (API slot 1)
- CC Value 8 → Physical Slot 3 (API slot 2)
- ...
- CC Value 20 → Physical Slot 15 (API slot 14)

Formula: `CC_Value = Physical_Slot + 5` or `CC_Value = API_Slot + 6`

## Critical Discovery: SysEx Slot Encoding Pattern

**NEW FINDING**: The web editor uses a unique slot encoding in SysEx commands:

| Physical Slot | DAW CC Value | SysEx Bytes | Interpretation |
|--------------|--------------|-------------|----------------|
| Slot 1 | 6 | `45 00 00` | Write cmd, slot 0, flag 0 |
| Slot 2 | 7 | `45 00 01` | Write cmd, slot 0, flag 1 |
| Slot 3 | 8 | `45 00 02` | Write cmd, slot 0, flag 2 |

The web editor **always uses slot byte 00** but varies the third byte (flag) to indicate the target slot!

## Implementation Status (Updated December 2024)

### Completed Architectural Changes
✅ **Slot selection logic moved to protocol layer** - Successfully refactored from MIDI backend to DeviceManager/DawPortController
✅ **SysEx encoding fixed** - Now uses slot=0 with flag byte pattern matching web editor
✅ **Two-phase protocol implementation** - DawPortController implements full negotiation sequence
✅ **Correct channel mapping** - Fixed to use channels 16, 8, and 7 per web editor analysis

### Current Architecture
```
┌─────────────────────────────┐
│     LaunchControlXL3        │  Application Layer
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│     DeviceManager           │  Protocol Layer
│   (DawPortController)       │  ← Slot selection logic here
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│     MidiInterface           │  Interface Layer
│  (DAW port management)      │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│   MIDI Backend              │  Transport Layer
│ (EasyMidi/WebMidi)          │  ← No device-specific logic
└─────────────────────────────┘
```

### Implementation Example (Updated)

```typescript
// DawPortController with two-phase protocol
class DawPortControllerImpl {
  async selectSlot(slot: number): Promise<void> {
    const physicalSlot = slot + 1;
    const ccValue = physicalSlot + 5;

    // Phase 1: Query current slot
    await this.sendMessage([0x9F, 11, 127]);  // Note On ch16
    await this.sendMessage([0xB7, 30, 0]);    // CC ch8, query
    // Wait for device response (CC ch7)...
    await this.sendMessage([0x9F, 11, 0]);    // Note Off ch16

    // Small delay between phases
    await new Promise(resolve => setTimeout(resolve, 10));

    // Phase 2: Set target slot
    await this.sendMessage([0x9F, 11, 127]);  // Note On ch16
    await this.sendMessage([0xB6, 30, ccValue]); // CC ch7, set slot
    await this.sendMessage([0x9F, 11, 0]);    // Note Off ch16

    // Give device time to process
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
```

## Complete Read/Write Flow

### Writing to a Specific Slot
1. Send two-phase slot selection protocol to DAW port
2. Wait for device to process (~50ms)
3. Send SysEx write command to MIDI port
   - Use slot byte 0x00
   - Use flag byte to indicate actual slot (0x00 for slot 1, 0x01 for slot 2, etc.)
4. Device writes to the selected slot

### Reading from a Specific Slot
1. Send two-phase slot selection protocol to DAW port
2. Send SysEx read command to MIDI port
3. Device returns data from the selected slot

## Web Editor Behavior (Detailed Analysis)

Based on captured transcripts, the web editor:

1. **Slot Selection Dialog**: User selects target slot
2. **Phase 1 - Query**:
   - Sends Note On ch16 + CC ch8 value 0
   - Receives current slot from device (CC ch7)
3. **Phase 2 - Set**:
   - Sends Note On ch16 + CC ch7 with target slot value
4. **SysEx Write**:
   - Always uses slot byte 0x00
   - Uses flag byte (third byte) to encode actual slot
   - Sends 342-byte payload for 24 encoders

Example transcript for writing to Slot 1:
```
17:14:59.055  To DAW    Note On  16  B-2  127
17:14:59.056  To DAW    Control  8   30   0     # Query
17:14:59.061  From DAW  Control  7   30   7     # Device reports slot 2
17:14:59.084  To DAW    Note Off 16  B-2  0
17:15:01.531  To DAW    Note On  16  B-2  127
17:15:01.531  To DAW    Control  7   30   6     # Set slot 1
17:15:01.531  To DAW    Note Off 16  B-2  0
17:15:01.538  To MIDI   SysEx    ... 45 00 00 ... # Write with flag 00
```

## Testing Results (December 2024)

### Implementation Progress
- ✅ **Architectural refactoring** - Slot selection successfully moved to protocol layer
- ✅ **Two-phase negotiation protocol** - Correctly implemented with proper timing
- ✅ **Channel corrections** - Fixed to use channels 16, 8, 7 per web editor
- ✅ **SysEx encoding fix** - Now matches web editor pattern (slot=0, flag varies)
- ✅ **DAW port output** - Messages being sent correctly
- ⚠️ **Bidirectional communication** - Implementation complete but crashes with EasyMidi backend
- ❌ **Device slot selection** - Still not working despite correct protocol

### Technical Limitations Discovered

#### EasyMidi Backend Issue
The EasyMidi backend crashes when attempting to open both DAW input and output ports:
- Opening DAW output works fine
- Opening DAW input causes NAPI exception
- This prevents full bidirectional communication testing

#### Partial Success with SysEx Fix
After implementing the web editor's SysEx encoding pattern:
- Device now returns data (not just defaults)
- Data appears partially correct but corrupted
- Suggests the encoding is on the right track but may need additional refinement

### Round-Trip Test Results
```
Write: "SLOT0_TEST_MODE" with 48 controls → slot 0
Read: "!" with 26 controls ← partial/corrupted data
```

The partial data suggests the SysEx encoding change is working but:
1. DAW port slot selection may still not be working
2. Additional encoding details may be missing

## Important Notes

1. **Bidirectional Communication**: Device responds to queries - implementation needs to handle responses
2. **SysEx Flag Byte**: The third byte after command 0x45 determines actual slot, not the slot byte
3. **Timing Critical**: Small delays needed between protocol phases
4. **Channel Confusion**: Monitor may report channels differently than MIDI spec (0-based vs 1-based)

## Recommendations for Future Work

### Immediate Actions
1. **Backend Investigation**: Test with WebMidi backend which may handle multiple ports better
2. **Protocol Verification**: Use hardware MIDI monitor to verify exact DAW port messages
3. **SysEx Analysis**: Deep dive into remaining encoding differences between our implementation and web editor

### Longer-term Solutions
1. **Fix EasyMidi Backend**: Resolve the NAPI crash when opening multiple ports to same device
2. **Alternative Backend**: Implement a backend specifically for multi-port devices
3. **Protocol Documentation**: Work with Novation to get official protocol documentation

### Alternative Approaches
1. **Single-port Mode**: Accept that slot selection may not work without bidirectional DAW communication
2. **Web Editor Integration**: Use web editor's JavaScript API if available
3. **Manual Slot Selection**: Require users to manually select slots on the device before operations

## Testing Tools

Several utilities are available for testing and debugging:
- `utils/test-daw-port-monitor.ts` - Monitor DAW port messages
- `utils/test-slot-selection.ts` - Test slot selection via DAW port
- `utils/test-daw-port-integration.ts` - Full integration test with library
- `utils/test-slot-0-round-trip.ts` - Round-trip test for slot 0

## References

- Discovered through reverse engineering the Novation Components web editor
- Confirmed via Playwright automation and MIDI monitoring
- Tested with Launch Control XL3 firmware v1.0.10.84
- Web editor transcripts analyzed for slots 1, 2, and 3
- Implementation: `src/core/DawPortController.ts`, `src/device/DeviceManager.ts`