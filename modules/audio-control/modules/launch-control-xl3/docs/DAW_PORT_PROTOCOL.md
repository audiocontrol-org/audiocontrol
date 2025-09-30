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

## DAW Port Slot Selection Protocol

### Message Sequence
The complete protocol for selecting a slot consists of three MIDI messages sent to the DAW port:

1. **Note On** - Start signal
   - Note: 11
   - Velocity: 127
   - Channel: 15 (0x0F)
   - Status byte: 0x9F

2. **Control Change** - Slot selection
   - Controller: 30 (0x1E)
   - Value: Physical slot number + 5
   - Channel: 6 (0x05)
   - Status byte: 0xB5

3. **Note Off** - End signal
   - Note: 11
   - Velocity: 0
   - Channel: 15 (0x0F)
   - Status byte: 0x9F (with velocity 0)

### Slot Value Mapping
The CC value maps to physical slots as follows:
- CC Value 6 → Physical Slot 1 (API slot 0)
- CC Value 7 → Physical Slot 2 (API slot 1)
- CC Value 8 → Physical Slot 3 (API slot 2)
- ...
- CC Value 20 → Physical Slot 15 (API slot 14)

Formula: `CC_Value = Physical_Slot + 5` or `CC_Value = API_Slot + 6`

## Implementation Example

### Using easymidi
```typescript
import easymidi from 'easymidi';

// Open DAW port
const dawOutput = new easymidi.Output('LCXL3 1 DAW In');

// Select physical slot 1 (API slot 0)
function selectSlot(apiSlot: number) {
  const physicalSlot = apiSlot + 1;
  const ccValue = physicalSlot + 5;

  // Note On
  dawOutput.send('noteon', {
    note: 11,
    velocity: 127,
    channel: 15
  });

  // CC for slot selection
  dawOutput.send('cc', {
    controller: 30,
    value: ccValue,
    channel: 6
  });

  // Note Off
  dawOutput.send('noteon', {
    note: 11,
    velocity: 0,  // velocity 0 = Note Off
    channel: 15
  });
}
```

### Raw MIDI Bytes
```typescript
// Select physical slot 2 (API slot 1)
const messages = [
  [0x9F, 11, 127],  // Note On, channel 15
  [0xB5, 30, 7],    // CC 30, value 7, channel 5 (6 in 1-based)
  [0x9F, 11, 0]     // Note Off, channel 15
];
```

## Complete Read/Write Flow

### Writing to a Specific Slot
1. Send slot selection messages to DAW port
2. Wait ~50ms for device to process
3. Send SysEx write command to MIDI port (slot byte can be 0x00)
4. Device writes to the selected slot

### Reading from a Specific Slot
1. Send slot selection messages to DAW port (optional - device may remember)
2. Send SysEx read command to MIDI port
3. Device returns data from the selected slot

## Web Editor Behavior

The Novation Components web editor follows this exact protocol:
1. When user clicks "Send to Launch Control XL 3", a slot selection dialog appears
2. When user selects a slot and clicks "Overwrite Custom Mode":
   - Sends the 3-message sequence to DAW port
   - Sends SysEx write command with only 24 encoders (342 bytes)
   - Slot byte in SysEx is always 0x00

## Important Notes

1. **Slot State Persistence**: The device appears to remember the last selected slot
2. **Default Behavior**: Without DAW port selection, writes may go to slot 2 by default
3. **Acknowledgment**: The device sends a 12-byte acknowledgment after successful write:
   ```
   F0 00 20 29 02 15 05 00 15 00 07 F7
   ```
   The second-to-last byte (0x07) appears to echo status information

4. **Backwards Compatibility**: Libraries that don't use the DAW port will have unpredictable slot behavior

## Testing Tools

Several utilities are available for testing and debugging:
- `utils/test-daw-port-monitor.ts` - Monitor DAW port messages
- `utils/test-slot-selection.ts` - Test slot selection via DAW port
- `utils/test-daw-port-integration.ts` - Full integration test with library

## References

- Discovered through reverse engineering the Novation Components web editor
- Confirmed via Playwright automation and MIDI monitoring
- Tested with Launch Control XL3 firmware v1.0.10.84