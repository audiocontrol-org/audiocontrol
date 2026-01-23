# Roland S-330 DT1 Write Persistence Investigation

## Summary

DT1 (Data Set 1) commands are being sent correctly with raw bytes (not nibblized), but writes to function parameters are **not persisting** to the hardware.

## Test Results

### Test File: `s330-dt1-persistence-test.ts`

**Test Case:** Write Part A patch index to value 1 (address `00 01 00 32`)

**DT1 Message Sent:**
```
F0 41 00 1E 12 00 01 00 32 01 4C F7
```

**Message Breakdown:**
- `F0` - SysEx start
- `41` - Roland manufacturer ID
- `00` - Device ID (0, displays as 1 on hardware)
- `1E` - S-330 model ID
- `12` - DT1 command
- `00 01 00 32` - Address (function params, Part A patch)
- `01` - Data (patch index 1)
- `4C` - Checksum (correct)
- `F7` - SysEx end

**Results:**
- ❌ No ACK/NAK response from S-330
- ❌ Read-back shows original value (0), not written value (1)
- ✅ RQD read commands work correctly
- ✅ DT1 message format is correct per Roland documentation

## Root Cause Analysis

### Most Likely: S-330 Not in MULTI Mode

The S-330 has multiple operating modes:
- **MULTI mode** - 8-part multitimbral operation
- **PATCH mode** - Single patch playing
- **TONE mode** - Single tone playing

**Function parameters** (addresses `00 01 00 xx`) are MULTI mode parameters. The S-330 likely:
1. Ignores DT1 writes to function parameters when not in MULTI mode
2. Does not send ACK/NAK when ignoring commands
3. Continues to respond to RQD reads with current values

### Evidence Supporting This Theory

1. **Silent Rejection:** No ACK or NAK response suggests the S-330 is filtering out the commands before processing
2. **Address-Specific:** The addresses we're writing to (`00 01 00 22`, `00 01 00 32`, `00 01 00 56`) are all MULTI mode function parameters
3. **Consistent Behavior:** All three parameter types (channel, patch, level) fail in exactly the same way
4. **Documentation Pattern:** Roland devices typically restrict parameter writes based on current mode

## Recommendations

### 1. Verify S-330 Mode Setting

**Manual Test:**
1. Put S-330 into MULTI mode (consult hardware manual)
2. Run `s330-dt1-persistence-test.ts` again
3. Check if writes now persist

### 2. Implement Mode Detection

Add ability to:
- Query current S-330 mode
- Detect when S-330 is not in MULTI mode
- Warn user before attempting function parameter writes

### 3. Add Mode Switching (Future)

If MIDI Implementation supports it:
- Send command to switch S-330 to MULTI mode
- Perform parameter writes
- Optionally switch back to original mode

### 4. Alternative: System Exclusive Mode

Some Roland devices support a "System Exclusive mode" that:
- Accepts all parameter changes regardless of current mode
- May require special activation sequence
- Should be documented in MIDI Implementation

## Testing Matrix

| Test | Address | Parameter | Mode Required | Status |
|------|---------|-----------|---------------|--------|
| Part A Patch | `00 01 00 32` | Multi Patch | MULTI | ❌ Fails |
| Part A Channel | `00 01 00 22` | Multi RX-CH | MULTI | ❌ Fails |
| Part A Level | `00 01 00 56` | Multi Level | MULTI | ❌ Fails |

All tests show identical behavior:
- DT1 sent correctly
- No ACK/NAK response
- Value unchanged on read-back

## Next Steps

1. **Check S-330 front panel** - Verify current mode setting
2. **Switch to MULTI mode** - Use hardware buttons to change mode
3. **Re-run test** - Execute `s330-dt1-persistence-test.ts`
4. **Document mode requirement** - Update code comments and documentation
5. **Add mode check** - Implement warning if not in MULTI mode

## Code Quality Notes

### What's Working

✅ **RQD Protocol** - Reading data works perfectly
- Address-based requests with correct nibble alignment
- DAT packet handling and de-nibblization
- Checksum validation

✅ **DT1 Message Format** - Writing uses correct format
- Raw bytes (NOT nibblized) per documentation
- Correct checksum calculation
- Proper address encoding

### What Needs Investigation

⚠️ **Mode Dependency** - Function parameter writes require MULTI mode
⚠️ **No Response Protocol** - S-330 silently ignores invalid DT1 writes
⚠️ **User Guidance** - Need to inform users about mode requirements

## Reference

- **Test File:** `/Users/orion/work/ol_dsp/modules/audio-tools/modules/sampler-midi/test/integration/s330-dt1-persistence-test.ts`
- **Client Implementation:** `/Users/orion/work/ol_dsp/modules/audio-tools/modules/s330-editor/src/core/midi/S330Client.ts`
- **Roland MIDI Implementation:** Official S-330 MIDI Implementation Chart (referenced in code comments)
