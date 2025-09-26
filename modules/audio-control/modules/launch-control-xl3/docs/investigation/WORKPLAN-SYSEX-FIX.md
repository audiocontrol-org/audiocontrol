# Launch Control XL 3 - SysEx Implementation Fix Plan

## ✅ Investigation Complete

Successfully uploaded CHANNEV custom mode to device using exact web editor protocol.

### Key Discoveries

1. **Direct Binary Format**: NO Midimunge encoding - use direct binary values
2. **Control Markers Differ**: Write uses 0x49, Read returns 0x48
3. **Control ID Offset**: Add 0x28 to control IDs when writing
4. **Label/Color Data Required**: Device rejects messages without this section
5. **Exact Format Required**: Even small deviations cause rejection

## 📋 Implementation Tasks

### 1. Clean Up Test Files
- [ ] Remove one-off test scripts from root directory
- [ ] Move valuable test scripts to `tests/integration/` or `examples/`
- [ ] Delete temporary test files that are no longer needed

Files to clean up:
- `send-exact-web-message.ts`
- `send-complete-channev.ts`
- `send-channev-to-slot-1.ts`
- `test-simple-mode.ts`
- `read-and-parse-channev.ts`
- Other test-*.ts files in root

### 2. Update SysExParser Implementation

#### Fix encodeCustomModeData() method:
- [ ] Remove Midimunge encoding
- [ ] Use 0x49 control marker for write
- [ ] Add 0x28 offset to control IDs
- [ ] Include mandatory label/color sections
- [ ] Use correct 11-byte control structure

#### Fix parseCustomModeData() method:
- [ ] Handle 0x48 control marker for read
- [ ] Parse 10-byte control structure
- [ ] Correctly extract mode name with terminator
- [ ] Handle label/color data sections

#### Update builder methods:
- [ ] Fix buildCustomModeWriteRequest() with correct format
- [ ] Verify buildCustomModeReadRequest() uses correct protocol

### 3. Create Proper Test Suite

#### Integration tests:
- [ ] Test reading factory custom modes
- [ ] Test writing simple custom mode
- [ ] Test writing complex multi-control mode
- [ ] Test acknowledgment handling
- [ ] Test error cases

#### Unit tests:
- [ ] Test control encoding with offset
- [ ] Test label/color data encoding
- [ ] Test parsing of various response formats
- [ ] Test mode name handling

### 4. Update Documentation

- [x] Update PROTOCOL-CORRECTED.md with discoveries
- [ ] Create examples/ directory with working examples
- [ ] Document label/color data format
- [ ] Add troubleshooting guide

### 5. Implement High-Level API

Create user-friendly interface:
```typescript
const customMode = new CustomModeBuilder()
  .name("MYMODE")
  .addFader(1, { cc: 10, channel: 1 })
  .addEncoder(1, 1, { cc: 13, channel: 1 })
  .addLabel(1, "Volume")
  .addColor(1, Color.RED)
  .build();

await lcxl3.writeCustomMode(0, customMode);
```

### 6. Archive Investigation Files

Move to `docs/investigation/`:
- MIDI capture files (.syx)
- Protocol analysis notes
- Working message examples

## 🎯 Success Criteria

- [ ] Can programmatically create custom modes
- [ ] Can read and parse existing custom modes
- [ ] All tests pass
- [ ] Clean repository structure
- [ ] Complete documentation

## 📝 Notes

The device is very particular about message format. Even with correct protocol, missing label/color data causes the device to acknowledge but not store the controls. The working implementation must include all required sections exactly as the web editor does.


__END__ (the following is for historical purposes, only)

The device isn't even acknowledging our write! This suggests our message format is still fundamentally wrong. Let me check if there's an issue with the slot 1 vs slot 2.
Also, I notice the web editor's message is much longer - it includes label data after the controls. This might be required.

Looking at the successful 419-byte message from the web editor, after the control definitions there's label/color data. The device might reject messages that are too
short or missing required sections.

Let me create a summary of what we've discovered:

Summary of CHANNEV Custom Mode Issue

The Launch Control XL 3 successfully acknowledges our custom mode write operations (returns 12-byte ACK), but when reading back, we only get the mode name without any
controls stored.

Key Discoveries:

1. Protocol Format Confirmed:
   - Write uses 0x49 control markers
   - Read returns 0x48 control markers
   - Control IDs use 0x28 offset when writing (fader 0x00 becomes 0x28)
   - Direct binary format, not Midimunge encoding
2. Current Issue:
   - Device acknowledges write (12-byte response: F0 00 20 29 02 15 05 00 15 00 06 F7)
   - But reading back only shows mode name, no controls
   - Only 85 bytes returned instead of expected ~450 bytes
3. Working Reference:
   - Web editor sends 419-byte messages that work
   - Includes control definitions + label/color data
   - Our messages are much shorter (373 bytes for full CHANNEV)
4. Parser Confusion:
   - Parser incorrectly identifies 'H' (0x48) in "CHANNEV" name as control marker
   - This causes it to misinterpret the mode name as control data

Next Steps:

The core issue appears to be that the device expects additional data beyond just the control definitions. The web editor's working messages include label and color data
that we're not sending. The device may require a minimum message size or specific data structure to accept the custom mode properly.

The parser also needs fixing to properly handle mode names that contain bytes that could be confused with control markers (like 0x48 'H' in "CHANNEV").


__END__ (Everything below is historical)
🔍 Analysis Complete - Implementation Issues Identified

Based on the MIDI communication log you provided and my analysis, I've identified the key differences between my implementation and the working web editor:

❌ Critical Issues Found:

1. Wrong Data Format: I was using Midimunge encoding, but Launch Control XL 3 uses a direct binary format
2. Wrong Control Marker: I used 0x48, but the correct marker is 0x49
3. Incorrect Control Structure: The actual format is 11 bytes per control: 0x49 [ID] 0x02 [TYPE] [CH] 0x01 0x40 [MIN] [CC] [MAX] 0x00
4. Wrong Mode Name Encoding: Direct ASCII bytes, not Midimunge encoded
5. Incorrect Control Types: Hardware position determines the control type (0x05, 0x09, 0x0D)
   ✅ Fixes Implemented:

- Updated encodeCustomModeData() to use correct Launch Control XL 3 format
- Fixed control marker from 0x48 to 0x49
- Implemented proper 11-byte control structure
- Added direct ASCII mode name encoding
- Updated parsing logic to handle the correct format

⚠️ Current Status:

The write operation is acknowledged by the device (12-byte response), but the read-back shows only 1 control instead of 32, and the name isn't parsed correctly. This
suggests either:

1. The encoding is still not perfectly matching the web editor format
2. The parsing logic needs further refinement
3. Some nuanced protocol details are still missing

The good news: Your MIDI capture provided the exact format needed. The web editor successfully sends 466-byte messages that result in properly stored custom modes. My
implementation is now much closer to the correct format, but needs final refinement to match the exact byte-for-byte structure.

The Launch Control XL 3 is definitely receiving and acknowledging the data, so we're very close to a working solution! 🎯

__END__ (Everything below this line is historical, not active)

📋 Summary

🔧 THE SOLUTION: input.ignoreTypes(false, false, false)

By default, node-midi ignores SysEx messages. The crucial fix was to disable message filtering by calling ignoreTypes(false, false, false) which means:
- Don't ignore SysEx messages
- Don't ignore timing messages
- Don't ignore active sensing messages

✅ Confirmed Working:
- Read operation returns 434-byte custom mode data
- Mode name parsing: "Digitakt mixer!"
- Control detection: 24 controls found
- Your MIDI capture protocol is 100% correct

📋 Next Steps:
1. Apply this ignoreTypes fix to all our MIDI implementations
2. Update the core NodeMidiBackend class
3. Implement complete custom mode read/write functionality
4. Test write operations with the corrected setup

The mystery is solved - your protocol analysis was spot-on, and the device communication works perfectly once SysEx filtering is disabled!

