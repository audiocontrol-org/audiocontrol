# Launch Control XL3 Reverse-Engineered SysEx Protocol

## Executive Summary

Through extensive reverse engineering using Web MIDI monitoring, browser automation, and protocol analysis, we have discovered critical discrepancies between the official documentation and actual device behavior. Most importantly, **the web editor appears to be pre-staging data on the device through an undocumented mechanism** before sending simple activation commands.

## Key Discoveries

### 1. The 12-Byte Mystery Command

The web editor sends only a 12-byte SysEx message when writing custom modes:
```
0xF0 0x00 0x20 0x29 0x02 0x15 0x05 0x00 0x15 [slot] 0x06 0xF7
```

This command does NOT contain any custom mode data, yet after sending it:
- The device successfully stores the custom mode
- Reading the slot returns the complete custom mode data including our test names

### 2. Evidence of Hidden Data Transfer

**Proof that data IS written:**
- Created control with name "SPY_TEST_1" in web editor
- Sent only the 12-byte command
- Read slot 0 back and found: `0x6a 0x10 0x53 0x50 0x59 0x5f 0x54 0x45 0x53 0x54 0x5f 0x31` (label for "SPY_TEST_1")

**The paradox:**
- No MIDI messages containing this data were captured
- The 12-byte command contains no payload
- Yet the data appears on the device

### 3. Protocol Byte Positions

#### Read Response Format (0x10)
```
Byte 0-7:  0xF0 0x00 0x20 0x29 0x02 0x15 0x05 0x00
Byte 8:    0x10 - Read response indicator
Byte 9:    [slot] - Slot number
Byte 10+:  Custom mode data
```

#### Write Command Format (0x15)
```
Byte 0-7:  0xF0 0x00 0x20 0x29 0x02 0x15 0x05 0x00
Byte 8:    0x15 - Write/activate command
Byte 9:    [slot] - Slot number
Byte 10:   0x06 - Unknown marker (always 0x06)
Byte 11:   0xF7 - SysEx end
```

### 4. Our Incorrect Implementation (0x45)

Our SysExParser incorrectly used 0x45 at byte 8 for writes, sending full data payloads. This doesn't work because:
- The device expects 0x15 for write commands
- The 0x15 command is only 12 bytes and contains no data
- Full data must be pre-staged through another mechanism

## Hypotheses for Hidden Data Transfer

### Theory 1: Browser-Side State Management
The web editor may be:
1. Building the complete mode in browser memory
2. Using undocumented MIDI commands to incrementally update device RAM
3. Sending the 12-byte 0x15 command to commit/activate the changes

### Theory 2: Multiple Virtual MIDI Ports
The device presents multiple MIDI ports:
- "LCXL3 1 MIDI In/Out" - Standard MIDI
- "LCXL3 1 DAW In/Out" - DAW integration
- Possibly hidden ports for configuration

### Theory 3: Non-MIDI Data Channel
The web editor could be using:
- WebUSB API for direct USB communication
- Hidden WebSocket/HTTP endpoints
- Browser storage that the device firmware reads

## Test Results

### Successful Operations
- ✅ Reading custom modes (0x40 command → 0x10 response)
- ✅ Detecting device presence and handshake
- ✅ Capturing web editor's 12-byte commands
- ✅ Confirming data IS written to device

### Failed Operations
- ❌ Writing with 0x45 + full payload (our incorrect assumption)
- ❌ Writing with 0x10 + full payload (mimicking read response format)
- ❌ Writing with just 0x15 12-byte command (no data to write)
- ❌ Capturing the actual data transfer messages

## Implementation Recommendations

### Immediate Fix Options

1. **Continue Investigation**
   - Monitor ALL MIDI ports simultaneously
   - Use USB protocol analyzer
   - Decompile web editor JavaScript

2. **Workaround Using Factory Modes**
   - Use only the 8 factory template modes
   - These work with simple 12-byte activation commands
   - Limited but functional

3. **Hybrid Approach**
   - Use our current read implementation (working)
   - Document write as "unsupported pending further research"
   - Focus on LED control and other working features

## Technical Details

### Custom Mode Data Structure
```
Mode Name: Null-terminated string with 0x2a prefix
Controls:  0x48 [id] [params...] repeated for each control
Labels:    0x6a/0x6b [id] [ASCII text] for named controls
Colors:    0x60 [id] [color] for LED colors
Footer:    0x06 0x00 0x04 0x40 0xF7
```

### Observed Message Flow
```
1. Web Editor → Device: [UNKNOWN DATA TRANSFER METHOD]
2. Web Editor → Device: 0xF0...0x15 [slot] 0x06 0xF7 (12 bytes)
3. Device → Host: (No immediate response)
4. Host → Device: 0xF0...0x40 [slot] 0x00 0xF7 (read request)
5. Device → Host: 0xF0...0x10 [slot] [FULL DATA] 0xF7
```

## Conclusion

The Launch Control XL3 uses an undocumented two-phase write protocol where:
1. Custom mode data is pre-staged on the device through an unknown mechanism
2. A simple 12-byte command activates/commits the staged data

Without discovering the data staging mechanism, full write support cannot be implemented. The device IS receiving and storing the data, but not through the documented SysEx protocol.

## Next Steps

1. **Deep JavaScript Analysis**: Reverse engineer the minified web editor code
2. **USB Protocol Analysis**: Use Wireshark with USBPcap to capture raw USB traffic
3. **Firmware Analysis**: Extract and analyze device firmware for hidden commands
4. **Contact Novation**: Request official protocol documentation

---

*Document generated from reverse engineering sessions conducted 2024*
*Test hardware: Launch Control XL3 with firmware v1.0.10.84*