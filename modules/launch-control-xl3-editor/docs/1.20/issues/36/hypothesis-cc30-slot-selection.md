# Hypothesis: Slot Selection via MIDI CC 30 on DAW Port (Channel 7)

**Issue**: #36 - Device rejects writes to inactive slots with status 0x09
**Date**: 2025-10-16
**Status**: TESTED - HYPOTHESIS INVALIDATED
**Discovery Source**: [Official Novation Documentation](https://userguides.novationmusic.com/hc/en-gb/articles/27840466607890-Launch-Control-XL-3-feature-Controls)

## Background

While investigating Issue #36 (device rejecting writes to inactive slots with status byte 0x09), we discovered official Novation documentation describing a "Surface mode select" control via MIDI CC 30 on the DAW port. This appeared to offer a method for programmatically selecting custom mode slots before writing to them.

**Why we're testing this hypothesis:**
- v1.20.10's approach (using command 0x77 with device ID 0x02) failed
- Official documentation describes CC 30 for "Surface mode select"
- Our current understanding may be incomplete
- Need to test documented control protocol

**Official documentation reference:**
The Novation feature controls guide documents CC 30 (0x1E) on channel 7 as "Surface mode select" with values mapping to custom mode slots 0-15.

## Previous Understanding

From `modules/launch-control-xl3/docs/PROTOCOL.md` (lines 878-881):

> Discovery (2025-10-01): The SysEx message includes a slot parameter.
> Using the slot number directly (0-14) works correctly.
> Slot 15 (0x0F) is reserved and cannot be read or written.
> DAW port protocol is NOT required for slot selection.

### What we believed:
- Slot byte in SysEx write command directly selects target slot
- DAW port not needed for slot selection
- Command 0x77 (template change) might enable writes

### Why Issue #36 occurred:
- v1.20.10 tried using command 0x77 with device ID 0x02
- Writes still rejected with status 0x09
- User testing confirmed failure across multiple slots

## New Hypothesis: CC 30 on DAW Port

Based on official Novation documentation, slot selection may require a two-step process:
1. Send CC 30 on DAW port to select target slot
2. Send SysEx write command on MIDI port to write data

### Protocol Details

**MIDI Message Type**: Control Change (CC), NOT SysEx
**CC Number**: 0x1E (30 decimal) - "Surface mode select"
**MIDI Port**: `LCXL3 1 DAW In` (NOT `LCXL3 1 MIDI In`)
**Channel**: Channel 7 (status byte 0xB6)
**Feature Marker**: (#) - Always enabled in DAW mode

### Value Mapping

| Slot | Display Name | CC Value (Hex) | CC Value (Dec) |
|------|--------------|----------------|----------------|
| 0    | Custom Mode 0 | 0x06          | 6              |
| 1    | Custom Mode 1 | 0x07          | 7              |
| 2    | Custom Mode 2 | 0x08          | 8              |
| 3    | Custom Mode 3 | 0x09          | 9              |
| 4    | Custom Mode 4 | 0x0A          | 10             |
| 5    | Custom Mode 5 | 0x0B          | 11             |
| 6    | Custom Mode 6 | 0x0C          | 12             |
| 7    | Custom Mode 7 | 0x0D          | 13             |
| 8    | Custom Mode 8 | 0x12          | 18             |
| 9    | Custom Mode 9 | 0x13          | 19             |
| 10   | Custom Mode 10| 0x14          | 20             |
| 11   | Custom Mode 11| 0x15          | 21             |
| 12   | Custom Mode 12| 0x16          | 22             |
| 13   | Custom Mode 13| 0x17          | 23             |
| 14   | Custom Mode 14| 0x18          | 24             |
| 15   | Custom Mode 15| 0x1D          | 29             |

### Message Format

To select slot 1:
```
B6 1E 07

Breakdown:
- 0xB6 = Control Change, channel 7
- 0x1E = CC number 30 (Surface mode select)
- 0x07 = Value 7 (Custom Mode 1 / Slot 1)
```

### Feature Control Enable

May be required in standalone mode:
```
9F 0B 7F

Breakdown:
- 0x9F = Note On, channel 16
- 0x0B = Note number 11
- 0x7F = Velocity 127
```

## Dual-Port Architecture

The Launch Control XL3 has two MIDI port pairs with different purposes:

### MIDI Port Pair
- **Purpose**: Data operations
- **MIDI Out** (`LCXL3 1 MIDI Out`): Receive data FROM device
- **MIDI In** (`LCXL3 1 MIDI In`): Send SysEx data TO device
- **Used for**: Read/write custom mode data

### DAW Port Pair
- **Purpose**: Control operations
- **DAW Out** (`LCXL3 1 DAW Out`): Receive control responses FROM device
- **DAW In** (`LCXL3 1 DAW In`): Send control messages TO device
- **Used for**: Slot selection (CC 30), feature controls

### Hypothesized Message Flow

```
Select slot 1, then write to it:

1. To DAW In:   B6 1E 07             (CC 30, select slot 1)
2. Wait 200ms                        (Allow device to change state)
3. To MIDI In:  F0 00 20 29 02 15... (SysEx write to slot 1)
4. From MIDI Out: Response with status
```

## Testing Methodology

### Test Environment
- Device: Launch Control XL3
- Software: launch-control-xl3 module (v1.20.x development)
- Test script: `modules/audio-control/tmp/test-cc30-slot-selection.ts`

### Test Cases

#### Test 1: Feature Control Enable
**Purpose**: Verify feature control message can be sent to DAW port

```typescript
// Send feature control enable (Note On, channel 16, note 11, velocity 127)
await dawOutput.send([0x9F, 0x0B, 0x7F]);
await sleep(200);
```

**Expected**: Message sent successfully
**Success criteria**: No transmission errors

#### Test 2: Slot Selection via CC 30
**Purpose**: Verify CC 30 messages can be sent to DAW port for multiple slots

```typescript
// Test slots 0, 1, 3, 5
for (const slot of [0, 1, 3, 5]) {
  const ccValue = slotToCCValue(slot);
  await dawOutput.send([0xB6, 0x1E, ccValue]);
  await sleep(200);
}
```

**Expected**: All CC messages sent successfully
**Success criteria**: No transmission errors for any slot

#### Test 3: Write After CC Selection
**Purpose**: Test if writes succeed after sending CC 30 slot selection

```typescript
// For each slot:
// 1. Send CC 30 to select slot
// 2. Wait 200ms
// 3. Attempt SysEx write to that slot
// 4. Check response status byte

await dawOutput.send([0xB6, 0x1E, ccValue]);
await sleep(200);
const response = await writeCustomMode(slot, testData);
```

**Expected**: Status byte 0x04 (success) for all writes
**Success criteria**: All writes accepted by device

#### Test 4: Write Without CC Selection (Control)
**Purpose**: Verify writes still fail without CC 30 (baseline)

```typescript
// Attempt write without sending CC 30 first
const response = await writeCustomMode(slot, testData);
```

**Expected**: Status byte 0x09 (rejection)
**Success criteria**: Write rejected (confirms CC 30 is necessary)

### Timing Considerations
- 200ms delay after each control message
- Allows device state changes to complete
- Based on observed SysEx response times

## Test Results

**Test Execution**: 2025-10-16

### Test 1: Feature Control Enable
- Status: **PASS**
- Message sent successfully to DAW In port
- Message: `0x9F 0x0B 0x7F`
- No transmission errors

### Test 2: Slot Selection via CC 30
- Status: **PASS**
- CC messages sent successfully to DAW In port
- Tested slots: 0, 1, 3, 5
- All messages transmitted without error
- CC values used: 0x06, 0x07, 0x09, 0x0B

### Test 3: Write After CC Selection
- Status: **FAIL**
- Result: **All writes rejected with status 0x09**
- Success rate: 0/4 (0%)
- Slots tested: 0, 1, 3, 5
- All returned status byte 0x09 (rejection)
- Same failure as without CC 30

### Test 4: Write Without CC Selection (Control)
- Status: **PASS** (confirmed expected failure)
- Write rejected with status 0x09 as expected
- Baseline behavior unchanged

## Validation Result

**HYPOTHESIS NOT VALIDATED**

The CC 30 slot selection method does NOT solve the write rejection issue (Issue #36). All writes continue to be rejected with status byte 0x09, regardless of whether CC 30 messages are sent beforehand.

## Analysis

### Why This Hypothesis Failed

1. **CC 30 received but ineffective for writes**: Device accepted the control messages but still rejected SysEx writes
2. **Possible explanations**:
   - CC 30 controls **visual display** slot, not **write target** slot
   - Additional state required beyond CC 30 (mode changes, handshakes)
   - Slot must be **physically selected on device** before writes accepted
   - Timing/sequencing issue (longer delays needed?)
   - Feature controls not properly enabled (different enable sequence?)
   - Write target selection uses different mechanism

### What We Learned

#### Confirmed Working:
1. **Dual-port architecture functional**
   - Can send control messages on DAW port
   - Can send data messages on MIDI port
   - Device responds to both port types independently

2. **Official documentation accessible**
   - CC 30 is documented as "Surface mode select"
   - Values map to custom modes 0-15
   - Channel 7 confirmed for control messages

3. **CC 30 implementation correct**
   - Messages properly formatted
   - Correct port selection (DAW In)
   - Appropriate timing delays

#### Still Unknown:
1. **What determines write target slot?**
   - Not the SysEx slot byte alone
   - Not CC 30 surface mode select
   - Physical device state involved?

2. **Does CC 30 affect device state?**
   - Visual display change?
   - Internal mode change?
   - No observable effect on write acceptance

3. **Are there undocumented prerequisites?**
   - Mode changes required?
   - Handshake sequences?
   - State transitions?

### Critical Observations

1. **Status 0x09 remains consistent**
   - Same rejection code with or without CC 30
   - Suggests write rejection logic unchanged
   - Device may not recognize CC 30 as write enabler

2. **Device accepts control messages**
   - No errors sending to DAW port
   - Device processes messages (no timeout)
   - But messages don't affect write acceptance

3. **Current slot write likely succeeds**
   - Hypothesis: Only physically displayed slot accepts writes
   - Would explain why some writes work (current slot)
   - Need to test with manual slot selection

## Next Steps

### Immediate Testing

#### Test 5: Physical Slot Selection (Priority 1)
**Purpose**: Determine if physical slot selection enables writes

```typescript
// Manual test procedure:
// 1. Physically select slot 3 on device (press device, left, right buttons)
// 2. Run write command targeting slot 3 WITHOUT CC 30
// 3. Check if write succeeds (status 0x04)
```

**If successful**: Confirms slot must be physically selected before write
**If fails**: Rules out physical selection theory

#### Test 6: Read Operations on Inactive Slots (Priority 2)
**Purpose**: Check if reads work on non-displayed slots

```typescript
// For each slot 0-14:
// 1. Do NOT select slot physically or via CC 30
// 2. Send read command for that slot
// 3. Check if read succeeds

const response = await readCustomMode(slot);
```

**Expected**: If reads succeed but writes fail, confirms read/write asymmetry
**Implication**: Different acceptance rules for read vs write operations

### Analysis Tasks

#### Task 1: Review Backup Utility Code
**Purpose**: Examine working read/write implementation

- Check if backup only writes to currently selected slot
- Look for undocumented setup sequences
- Identify any special handling for slot changes
- Document any patterns not in PROTOCOL.md

#### Task 2: Slot 0 (Factory Default) Behavior
**Purpose**: Test if slot 0 has special write privileges

```typescript
// Test write to slot 0 without any selection
// Hypothesis: Factory default slot might always be writable
```

### Alternative Hypotheses

#### Hypothesis A: Physical Selection Required
- **Theory**: Device firmware requires physical slot selection before accepting writes
- **Test**: Manual slot selection + write (Test 5)
- **Implication**: Programmatic slot changes not supported by firmware

#### Hypothesis B: Write Enables Only Current Slot
- **Theory**: SysEx slot byte must match currently displayed slot
- **Test**: Physical selection + matching slot byte
- **Implication**: Cannot write to inactive slots programmatically

#### Hypothesis C: Undocumented Command Sequence
- **Theory**: Additional SysEx commands required before slot write
- **Test**: Analyze successful backup utility message sequences
- **Implication**: Need to discover and document full protocol

#### Hypothesis D: Firmware Limitation
- **Theory**: Firmware version may not support programmatic slot writes
- **Test**: Check firmware version, compare with documentation
- **Implication**: Feature may be hardware-revision specific

### Documentation Updates Needed

Once resolution found:

1. **Update PROTOCOL.md** with validated slot selection method
2. **Document CC 30 behavior** (display vs write target)
3. **Add dual-port architecture** details to PROTOCOL.md
4. **Create troubleshooting guide** for slot write rejections
5. **Update API documentation** with correct slot write procedure

## References

### External Documentation
- [Official Novation Feature Controls](https://userguides.novationmusic.com/hc/en-gb/articles/27840466607890-Launch-Control-XL-3-feature-Controls)
- [Launch Control XL3 User Guide](https://fael-downloads-prod.focusrite.com/customer/prod/s3fs-public/downloads/Launch%20Control%20XL%203%20-%20User%20Guide%20v1.0.pdf)

### Internal Documentation
- [Workplan: Issue #36](./implementation/workplan.md)
- [Current PROTOCOL.md](../../modules/launch-control-xl3/docs/PROTOCOL.md)
- [SysExParser.ts](../../modules/launch-control-xl3/src/core/SysExParser.ts#L878-L881)

### Test Artifacts
- Test script: `modules/audio-control/tmp/test-cc30-slot-selection.ts`
- Test execution date: 2025-10-16
- Test results: All writes rejected (0/4 success rate)

## Related Issues

- **Issue #36**: Device rejects writes to inactive slots with status 0x09 (UNRESOLVED)
- **v1.20.10**: Failed fix attempt using command 0x77 with device ID 0x02
- **v1.20.3**: Current release with documented slot write limitations

## Conclusion

The CC 30 slot selection hypothesis was **invalidated through testing**. While the device accepts CC 30 control messages on the DAW port, these messages do not enable writes to inactive custom mode slots. All write attempts continue to be rejected with status byte 0x09.

**Key finding**: CC 30 likely controls the **visual display** of custom modes, not the **write target** for SysEx operations. These appear to be separate device states.

**Issue #36 remains unresolved** and requires further investigation through physical slot selection testing and analysis of working backup utility code.

---

**Document Status**: Complete - Hypothesis tested and invalidated
**Next Action**: Execute Test 5 (Physical Slot Selection) to test alternative hypothesis
**Owner**: Documentation Engineer
**Last Updated**: 2025-10-16
