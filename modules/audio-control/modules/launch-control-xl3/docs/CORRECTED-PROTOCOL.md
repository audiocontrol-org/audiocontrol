# Launch Control XL3 CORRECTED SysEx Protocol

## Critical Correction

The web editor DOES send full SysEx data messages! The confusion arose from monitoring the wrong MIDI port.

## Correct Protocol

### Write Operation (0x45)
**TO Device (LCXL3 1 MIDI In):**
```
F0 00 20 29 02 15 05 00 45 [slot] [full custom mode data] F7
```
- Byte 8: 0x45 - Write command with data
- Byte 9: Slot number (0x00-0x0E)
- Bytes 10+: Complete custom mode data (300+ bytes)

**FROM Device (LCXL3 1 MIDI Out):**
```
F0 00 20 29 02 15 05 00 15 [slot] 07 F7
```
- Byte 8: 0x15 - Write acknowledgment
- Byte 9: Slot number
- Byte 10: 0x07 - Success status (was seeing 0x06 in some cases)

### Read Operation (0x40)
**TO Device:**
```
F0 00 20 29 02 15 05 00 40 [slot] 00 F7
```

**FROM Device:**
```
F0 00 20 29 02 15 05 00 10 [slot] [data] F7
```

## Key Findings

1. **Our SysExParser was using the correct 0x45 byte!**
2. **The issue was monitoring the wrong port** - we were only watching output FROM device
3. **The 12-byte messages are acknowledgments, not commands**
4. **Both read and write use different command/response bytes:**
   - Write: 0x45 (command) → 0x15 (ack)
   - Read: 0x40 (command) → 0x10 (response)

## Data Structure Differences

Looking at the actual captured data, there are subtle differences from our implementation:

### Web Editor Format
```
49 10 02 05 00 01 40 00 0D 7F 00  (control definition)
^^                ^^
0x49 not 0x48     0x40 not 0x48
```

### Our Format
```
48 10 02 05 00 01 48 00 0D 7F     (no trailing 0x00)
^^                ^^
0x48              0x48
```

## The Real Problem

The issue isn't the 0x45 byte - it's the data structure! The web editor uses:
- 0x49 markers for controls (not 0x48)
- 0x40/0x50 for certain fields
- Extra 0x00 padding bytes
- Different structure for the data payload

## Next Steps

1. Update SysExParser to use correct data format:
   - Use 0x49 for control markers during write
   - Add proper padding bytes
   - Fix the internal data structure

2. Monitor the correct MIDI port (MIDI In for messages TO device)

3. Test with corrected data format

This explains why our writes weren't working - we had the right protocol (0x45) but wrong data format!