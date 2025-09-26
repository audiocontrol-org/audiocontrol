# Launch Control XL 3 Reverse Engineering Workplan

This workplan outlines the steps needed to capture the remaining protocol information for complete device control.

## Current Status

### ✅ Already Captured
- [x] SysEx format for writing custom modes
- [x] Manufacturer ID (00 20 29) and Device ID (02)
- [x] Control mapping structure (knobs, faders, buttons)
- [x] Slot targeting mechanism (00-0E for slots 1-15)
- [x] Multi-message transfer protocol
- [x] 7-bit encoding via Midimunge library

### ❌ Still Needed
- [ ] Reading configurations from device
- [ ] LED control protocol
- [ ] Template/mode switching commands
- [ ] Real-time parameter feedback
- [ ] Device initialization sequence
- [ ] Error response handling

## Phase 1: Read Operations

### 1.1 Capture "Get Custom Mode from Launch Control XL 3"

**Objective**: Understand how to read current configurations from the device

**Steps**:
1. Set up enhanced MIDI capture to monitor both input and output
2. Click "Get Custom Mode from Launch Control XL 3" button
3. Capture the request SysEx sent to device
4. Capture the response SysEx from device
5. Analyze the data structure of returned configuration

**Expected Findings**:
- Read command byte (likely different from 0x15)
- Query format for specific slots
- Response message structure
- How mode names and parameters are encoded in responses

### 1.2 Test Reading Different Slots

**Objective**: Verify if we can query specific slots

**Steps**:
1. Program different modes in slots 1, 2, and 3
2. Use read operation on each slot
3. Compare request messages to identify slot selection byte
4. Document response differences

## Phase 2: LED & Visual Feedback

### 2.1 Capture LED State Changes

**Objective**: Learn how to control button LEDs and their colors

**Steps**:
1. Monitor MIDI when switching between factory templates
2. Look for LED state messages when buttons are pressed
3. Test with different colored templates (notice some presets show different colors)
4. Capture any RGB or color index values

**Expected Findings**:
- LED control command structure
- Color value encoding (RGB or indexed)
- Brightness/intensity control
- LED state persistence settings

### 2.2 Button Feedback Testing

**Objective**: Understand button toggle states and LED feedback

**Steps**:
1. Create custom mode with toggle buttons
2. Monitor MIDI messages when toggling buttons
3. Check if LED states are controlled by device or host
4. Test momentary vs toggle button behaviors

## Phase 3: Mode Switching & Device State

### 3.1 Template/Bank Switching

**Objective**: Understand how device switches between modes/templates

**Steps**:
1. Monitor MIDI when using device buttons to switch templates
2. Check if switching sends messages to host
3. Test programmatic template switching from web editor
4. Capture any bank select or program change messages

**Expected Findings**:
- Template switch command format
- Current template query command
- Bank organization (if any)
- Template activation confirmation

### 3.2 Device Initialization

**Objective**: Capture device startup and handshake sequence

**Steps**:
1. Start MIDI capture before connecting device
2. Connect device via USB
3. Monitor initial handshake messages
4. Document device identification sequence
5. Capture firmware version query/response

**Expected Findings**:
- Device announcement messages
- Capability negotiation
- Firmware version format
- Supported features enumeration

## Phase 4: Real-time Communication

### 4.1 Parameter Feedback

**Objective**: Understand bidirectional parameter updates

**Steps**:
1. Set up DAW with MIDI learn on multiple parameters
2. Move knobs/faders on device
3. Send MIDI CC from DAW back to device
4. Monitor if device updates LED rings or displays
5. Check for parameter value request/response

**Expected Findings**:
- Value display update protocol
- LED ring position updates
- Motorized fader protocol (if supported)
- Pick-up mode configuration

### 4.2 High-Resolution Control

**Objective**: Check for 14-bit MIDI or NRPN support

**Steps**:
1. Test if device supports 14-bit MIDI (CC + CC+32)
2. Check for NRPN/RPN message support
3. Test resolution of knob movements
4. Monitor for any proprietary high-res protocols

## Phase 5: Advanced Features

### 5.1 Firmware Communication

**Objective**: Document firmware-related messages (for safety, not implementation)

**Steps**:
1. Monitor messages when checking for firmware updates
2. Document version query protocol
3. **DO NOT** attempt actual firmware updates
4. Note any bootloader-related commands to avoid

**Expected Findings**:
- Version check command
- Update availability query
- Bootloader entry commands (to avoid accidentally)

### 5.2 Error Handling

**Objective**: Understand error response messages

**Steps**:
1. Send malformed SysEx messages
2. Send commands with invalid parameters
3. Try accessing non-existent slots
4. Monitor error response format
5. Document error codes

**Expected Findings**:
- Error message format
- Error code definitions
- Recovery procedures
- Timeout behaviors

## Phase 6: Extended Protocol Mapping

### 6.1 Command Discovery

**Objective**: Map all available command bytes

**Steps**:
1. Systematically test command bytes (00-7F after manufacturer ID)
2. Monitor device responses
3. Use small parameter variations to understand command purpose
4. Document any undocumented features

**Safe Testing Range**:
```
F0 00 20 29 02 [XX] ... F7
                ^^
                Test 00-7F here
```

### 6.2 Device Capabilities Query

**Objective**: Find device capability/feature queries

**Steps**:
1. Look for device info commands
2. Test common SysEx universal commands
3. Check for Novation-specific capability queries
4. Document supported features list

## Implementation Strategy

### Capture Tools Needed

1. **Enhanced MIDI Monitor**
   - Bidirectional message capture
   - Timestamp correlation
   - Message pairing (request/response)
   - Binary diff for similar messages

2. **Automated Testing Script**
   ```javascript
   // Pseudo-code for systematic testing
   for (let cmd = 0x00; cmd <= 0x7F; cmd++) {
     if (isSafeCommand(cmd)) {
       const sysex = buildTestSysex(cmd);
       await sendAndCapture(sysex);
       await delay(100);
     }
   }
   ```

3. **Protocol Documentation Template**
   ```
   Command: 0xXX
   Purpose: [Description]
   Request:  F0 00 20 29 02 XX [params] F7
   Response: F0 00 20 29 02 XX [data] F7
   Parameters:
     - Byte 6: [purpose]
     - Byte 7: [purpose]
   Example: [Hex dump with annotation]
   ```

## Safety Guidelines

### ⚠️ Commands to Avoid

1. **Never send**:
   - Firmware update commands
   - Factory reset commands
   - Bootloader entry commands
   - Unidentified commands > 0x7F

2. **Test carefully**:
   - Start with read-only operations
   - Use small parameter changes
   - Monitor device behavior for anomalies
   - Have factory reset procedure ready

### 🔒 Safe Testing Protocol

1. **Backup First**
   - Document all current custom modes
   - Note current firmware version
   - Save any custom configurations

2. **Test Incrementally**
   - One command at a time
   - Wait for device response
   - Document immediately
   - Verify device still responsive

3. **Recovery Plan**
   - Know how to factory reset via hardware
   - Have Novation Components ready for recovery
   - Document any concerning behaviors

## Deliverables

### Documentation Updates

1. **LAUNCH-CONTROL-PROTOCOL.md**
   - Complete SysEx command reference
   - All message formats
   - Example code for each operation

2. **API Specification**
   - TypeScript interfaces for all messages
   - Command/response pairs
   - Error code mappings

3. **Implementation Library**
   - Full protocol implementation
   - Safe command wrappers
   - Device state management

## Timeline Estimate

- **Phase 1-2**: 2-3 hours (core functionality)
- **Phase 3-4**: 2-3 hours (device state & real-time)
- **Phase 5-6**: 4-6 hours (advanced & mapping)
- **Documentation**: 2-3 hours
- **Implementation**: 8-12 hours

**Total**: ~20-30 hours for complete protocol reverse engineering and implementation

## Next Immediate Steps

1. [ ] Set up comprehensive MIDI capture system
2. [ ] Test "Get Custom Mode" operation
3. [ ] Capture LED control during mode switches
4. [ ] Document device initialization sequence
5. [ ] Create TypeScript interfaces for captured protocols

---

*Created: 2025-09-25*
*Target Device: Novation Launch Control XL 3*
*Firmware: 1364*