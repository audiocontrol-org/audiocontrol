# Launch Control XL 3 Web Editor Analysis

## Key Findings

After analyzing the official Novation web editor's MIDI communication using Playwright browser automation, we discovered critical information about the Launch Control XL 3 protocol.

## What the Web Editor Actually Does

**The web editor does NOT write custom modes to the device.** Instead, it only:

1. **LED Control**: Sends LED color commands to provide visual feedback
2. **Configuration Display**: Shows control mappings in the browser interface
3. **User Interface**: Provides editing capabilities that are browser-only

## Captured MIDI Traffic

When clicking "Send to Launch Control XL 3" in the web editor, only LED control messages are sent:

```
Pattern: F0 00 20 29 11 78 [LED_ID] [COLOR] F7

Examples from captured traffic:
F0 00 20 29 11 78 41 60 F7  (LED control - encoder 1)
F0 00 20 29 11 78 42 12 F7  (LED control - encoder 2)
F0 00 20 29 11 78 43 12 F7  (LED control - encoder 3)
F0 00 20 29 11 78 44 12 F7  (LED control - encoder 4)
...
```

Where:
- `F0 00 20 29 11` = Novation SysEx header
- `78` = LED control command
- `[LED_ID]` = Control identifier (0x41-0x48 for encoders, etc.)
- `[COLOR]` = Color code (0x0C=off, 0x0F=red, 0x3C=green, 0x60=amber, etc.)
- `F7` = SysEx end

## Protocol Analysis

### What Works ✅
- **LED Control**: `F0 00 20 29 11 78 [LED_ID] [COLOR] F7`
- **Device Inquiry**: `F0 7E 00 06 01 F7`
- **Standard MIDI**: CC, Note On/Off messages via DAW ports

### What Doesn't Work ❌
- **Custom Mode Read**: No response to read requests
- **Custom Mode Write**: No acknowledgment of write operations
- **Bidirectional SysEx**: Device doesn't respond to custom mode SysEx

## Implications

1. **Custom modes are likely stored in firmware** and not user-writable via MIDI
2. **The device uses hardware-based slot switching** (physical buttons/interface)
3. **Web editor provides visual representation only** - no actual device programming
4. **Our protocol documentation was partially incorrect** about custom mode capabilities

## Corrected Implementation Strategy

Based on these findings, a practical Launch Control XL 3 library should focus on:

1. **LED Control**: Implement comprehensive LED color/pattern control
2. **MIDI Monitoring**: Listen for control changes from device
3. **Visual Feedback**: Provide software-side control mapping visualization
4. **Hardware Integration**: Work with existing device custom modes rather than trying to write them

## Technical Details

### Device Ports
- **LCXL3 1 MIDI In/Out**: For SysEx LED control and device communication
- **LCXL3 1 DAW In/Out**: For standard MIDI CC/Note messages

### LED Control Implementation
```typescript
// LED control message format
const ledControlMessage = [
  0xF0, 0x00, 0x20, 0x29, 0x11, // Novation SysEx header
  0x78,                          // LED control command
  ledId,                         // Control identifier
  colorCode,                     // LED color
  0xF7                          // SysEx end
];
```

### Color Codes
- `0x0C` = Off
- `0x0F` = Red
- `0x3C` = Green
- `0x60` = Amber
- `0x3F` = Yellow
- `0x3D` = Blue (approximate)

## Conclusion

The Launch Control XL 3's custom mode functionality appears to be firmware-based and not programmable via MIDI SysEx. The web editor is essentially a configuration tool that provides visual feedback but doesn't actually program the device.

Our implementation should focus on LED control and working with the device's existing custom modes rather than attempting to write new ones.