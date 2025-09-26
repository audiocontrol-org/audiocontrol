# Launch Control XL 3 - Troubleshooting Guide

## Common Issues and Solutions

### 1. Device Not Found

**Problem:** The Launch Control XL 3 is not detected by the library.

**Solutions:**
- Ensure the device is connected via USB and powered on
- Check that the device shows up in your system's MIDI devices
- On macOS: Check Audio MIDI Setup application
- On Windows: Check Device Manager under Sound, video and game controllers
- On Linux: Run `amidi -l` to list MIDI devices

**Code to check available devices:**
```typescript
import { NodeMidiBackend } from '@ol-dsp/launch-control-xl3';

const backend = new NodeMidiBackend();
await backend.initialize();

const inputs = await backend.getInputPorts();
const outputs = await backend.getOutputPorts();

console.log('Input ports:', inputs.map(p => p.name));
console.log('Output ports:', outputs.map(p => p.name));
```

### 2. SysEx Messages Not Received

**Problem:** Custom mode read/write operations fail or timeout.

**Root Cause:** By default, node-midi ignores SysEx messages.

**Solution:** Ensure the MIDI backend has SysEx filtering disabled:
```typescript
// In NodeMidiBackend, this is already handled:
input.ignoreTypes(false, false, false);
```

### 3. Custom Mode Not Storing Controls

**Problem:** Device acknowledges write but reads back empty or partial mode.

**Causes and Solutions:**

1. **Missing Label/Color Data**
   - The device requires label and color sections even if empty
   - Solution: Use CustomModeBuilder which automatically includes these sections

2. **Incorrect Control Markers**
   - Write operations must use 0x49 marker (not 0x48)
   - Control IDs must have +0x28 offset when writing
   - Solution: Use the high-level API which handles this automatically

3. **Wrong Message Format**
   - Must use direct binary encoding (NOT Midimunge)
   - Mode name must be ASCII, max 8 characters
   - Solution: Use CustomModeBuilder for proper formatting

### 4. Parser Errors with Mode Names

**Problem:** Mode names containing 'H' (0x48) cause parsing errors.

**Solution:** Updated parser prioritizes name terminator (0x21 0x00) over control markers. Ensure you're using the latest version.

### 5. Acknowledgment Timeouts

**Problem:** Write operations timeout waiting for acknowledgment.

**Solutions:**
- Increase timeout duration (default is 5000ms)
- Check USB cable quality and connection
- Ensure no other software is accessing the device
- Try disconnecting and reconnecting the device

**Code example with custom timeout:**
```typescript
const lcxl3 = new LaunchControlXL3(true); // Enable debug mode
// Modify timeout if needed (before connecting)
lcxl3.ackTimeoutMs = 10000; // 10 seconds
```

### 6. TypeScript Compilation Errors

**Problem:** Import errors with module resolution.

**Solution:** The project uses Node16/NodeNext module resolution. All imports must include `.js` extension:
```typescript
// Correct
import { CustomModeBuilder } from '@/builders/CustomModeBuilder.js';

// Incorrect
import { CustomModeBuilder } from '@/builders/CustomModeBuilder';
```

### 7. Multiple Slot Confusion

**Problem:** CHANNEV mode appears to use multiple slots.

**Clarification:**
- CHANNEV is a single mode that fits in one slot
- The web editor may send additional messages for labels/colors
- Each slot can hold one complete custom mode with all controls

### 8. Control Type Mismatch

**Problem:** Controls have wrong behavior or type.

**Control Type Reference:**
- `0x00` - Faders
- `0x05` - Top row encoders
- `0x09` - Middle row encoders
- `0x0D` - Bottom row encoders
- `0x19` - Side buttons
- `0x25` - Bottom buttons

### 9. LED Colors Not Working

**Problem:** LED colors don't change or show wrong colors.

**Solutions:**
- Ensure you're using the correct color values from the Color enum
- Some controls may not support all colors
- Check that LED control is enabled in device settings

### 10. Build Errors

**Problem:** TypeScript or build errors.

**Common fixes:**
```bash
# Clean and rebuild
rm -rf dist/
npm run build

# Check TypeScript compilation
npx tsc --noEmit

# Update dependencies
pnpm install
```

## Debug Mode

Enable debug mode for detailed logging:
```typescript
const lcxl3 = new LaunchControlXL3(true); // Enable debug
```

This will log:
- All SysEx messages sent/received
- Custom mode operations
- Acknowledgment handling
- Parse errors

## Protocol Verification

To verify the protocol implementation:

1. **Capture Working Messages:**
   - Use a MIDI monitor to capture messages from the web editor
   - Save as .syx files for analysis

2. **Compare Message Structure:**
   ```typescript
   // Log the exact bytes being sent
   const message = SysExParser.buildCustomModeWriteMessage(0, customMode);
   console.log('Message bytes:', message.map(b => b.toString(16).padStart(2, '0')).join(' '));
   ```

3. **Verify Acknowledgment:**
   - Successful write: 12-byte response with 0x15 command and 0x06 status
   - Failed write: Different status code or no response

## Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/anthropics/claude-code/issues)
2. Enable debug mode and capture logs
3. Include your code, error messages, and debug output
4. Specify your OS and Node.js version

## Known Limitations

- Maximum mode name length: 8 characters
- Maximum 127 controls per mode (hardware limit)
- Some control combinations may not be supported by hardware
- USB 2.0 required for reliable communication