# MIDI Capture Analysis - Mode Name Truncation (Issue #40)

This directory contains raw MIDI captures from the mode name truncation investigation.

## Purpose

Capture and analyze the exact byte sequences sent to and received from the Launch Control XL3 device during mode write/read operations to identify where and how mode names are being truncated.

## Test Configuration

- **Test Mode Name:** `TESTMODE` (8 characters)
- **Target Slot:** 0 (default)
- **Expected Behavior:** Mode name should round-trip correctly (written as "TESTMODE", read back as "TESTMODE")
- **Observed Behavior:** Mode name is truncated on read (written as "TESTMODE", read back as shorter string)

## Capture Methodology

The `capture-mode-name-midi.ts` utility uses monkey-patching to intercept MIDI traffic:

1. **Write Phase:**
   - Utility writes a test mode with name "TESTMODE" to slot 0
   - Captures outgoing SysEx bytes for both pages (page 0 and page 3)
   - Saves as `send-write-page0.hex` and `send-write-page3.hex`

2. **Read Phase:**
   - Utility reads mode back from slot 0
   - Captures incoming SysEx bytes for both pages (page 0 and page 1)
   - Saves as `receive-read-response-page0.hex` and `receive-read-response-page1.hex`

3. **Analysis:**
   - Compares write vs. read name byte sequences
   - Identifies truncation point
   - Checks for marker byte interference
   - Verifies name length encoding

## How to Run Capture

```bash
cd /Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3

# Run capture utility (default slot 0)
tsx utils/capture-mode-name-midi.ts

# Or specify a different slot
tsx utils/capture-mode-name-midi.ts 3
```

## Expected Output Files

After running the capture utility, this directory will contain:

- `send-write-page0.hex` - Write request for page 0 (encoders)
- `send-write-page3.hex` - Write request for page 3 (faders/buttons)
- `receive-write-ack-page0.hex` - Write acknowledgement for page 0
- `receive-write-ack-page3.hex` - Write acknowledgement for page 3
- `send-read-request-page0.hex` - Read request for page 0
- `send-read-request-page1.hex` - Read request for page 1
- `receive-read-response-page0.hex` - Read response for page 0
- `receive-read-response-page1.hex` - Read response for page 1
- `capture-summary.md` - Automated analysis summary

## Hex Dump Format

Each `.hex` file contains:
- **Header:** Metadata (timestamp, slot, mode name, message length)
- **Hex Dump:** Byte-by-byte hex representation with ASCII view
- **Annotations:** Inline annotations marking important byte positions (name markers, length bytes, name characters)

Example format:
```
0000  f0 00 20 29 02 15 05 00  45 00 00 20 08 54 45 53 | .. )....E.. .TES
      ^ SysEx start (0xF0)
                              ^ Name marker (0x20)
                                 ^ Name length (8 bytes)
                                    ^ Name char 1: 'T' (0x54)
0010  54 4d 4f 44 45 49 ...                             | TMODEI...
      ^ Name char 2: 'E' (0x45)
         ^ Name char 3: 'S' (0x53)
```

## Analysis Focus Areas

### 1. Write Format (Sent to Device)

Look for name encoding in write requests:
- **Pattern:** `0x20 [length] [name_bytes]`
- **Expected Length Byte:** `0x08` (8 characters for "TESTMODE")
- **Expected Name Bytes:** `54 45 53 54 4d 4f 44 45` (ASCII "TESTMODE")

### 2. Read Format (Received from Device)

Look for name encoding in read responses:
- **Pattern:** `0x06 0x20 [length or 0x1F] [name_bytes]`
- **Factory Pattern:** `0x06 0x20 0x1F` indicates no custom name (factory default)
- **Custom Name:** `0x06 0x20 [length]` followed by name bytes

### 3. Truncation Detection

Compare name bytes between write and read:
- Are all 8 characters present in the write request?
- How many characters are present in the read response?
- Does the read response length byte match the actual name bytes?
- Are any name bytes corrupted or replaced by marker bytes?

### 4. Marker Byte Interference

Check if mode name parsing stops at marker bytes:
- Control markers: `0x48`, `0x49`, `0x40`
- Label marker: `0x69`
- Color marker: `0x60`
- SysEx terminator: `0xF7`

**Hypothesis:** Parser may be stopping at marker bytes that happen to match ASCII characters in the mode name.

Example: "TESTMODE" contains 'T' (0x54), 'E' (0x45), etc. If any of these bytes match marker bytes, the parser might truncate.

## Key Findings

_This section will be populated after running captures and analysis._

## Next Steps

1. Run capture utility: `tsx utils/capture-mode-name-midi.ts`
2. Examine hex dumps for name byte sequences
3. Compare write vs. read name encoding
4. Identify exact truncation point
5. Check for marker byte collisions
6. Update parser in `SysExParser.ts` if needed

## Related Files

- Capture Utility: `/Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3/utils/capture-mode-name-midi.ts`
- Parser Implementation: `/Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3/src/core/SysExParser.ts`
- Protocol Documentation: `/Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3/docs/PROTOCOL.md`
- Issue Workplan: `/Users/orion/work/ol_dsp/modules/audio-control/docs/1.20/issues/40/implementation/workplan.md`

## Automation

The capture utility automatically:
- Instruments MIDI traffic via monkey-patching
- Captures all relevant SysEx messages
- Annotates name byte sequences
- Generates summary analysis
- Saves organized hex dumps

No manual MIDI sniffing required!
