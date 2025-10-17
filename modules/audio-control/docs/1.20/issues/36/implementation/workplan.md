# Issue #36 Fix Implementation Workplan

**Issue**: [#36 - Device firmware rejects writes to inactive slots with status 0x9](https://github.com/oletizi/ol_dsp/issues/36)
**Version**: 1.20.x
**Status**: Investigation Required
**Created**: 2025-10-15
**Last Updated**: 2025-10-15

---

## Executive Summary

**Problem**: Device firmware continues to reject writes to inactive slots with status 0x9 error, despite v1.20.10 claiming to fix this issue.

**Root Cause**: The v1.20.10 "fix" was based on incorrect assumptions and insufficient validation:
- Changed device ID from 0x11 to 0x02 in command 0x77 (template change)
- Integration test only validated READ operations, not WRITE operations
- No empirical MIDI capture to verify command 0x77 validity for Launch Control XL3
- Protocol documentation contradicts implementation approach

**User Impact**: Cannot reliably write custom mode configurations to the device, limiting library's core functionality.

**Required Action**: Comprehensive protocol investigation followed by empirically-validated fix implementation.

---

## Problem Statement

### User Test Results (v1.20.10)

From issue comments:

```
[LOG] [DeviceManager] Slot selection SysEx bytes for slot 3:
      0xF0 0x00 0x20 0x29 0x02 0x77 0x03 0xF7

[ERROR] Send error: Error: Write failed for page 0: status 0x9
```

**Finding**: Device still rejects writes with status 0x9 despite device ID being set to 0x02.

### Why v1.20.10 Fix Failed

**1. Insufficient Testing**

Integration test `test/integration/test-slot-selection.cjs` only validated READ operations:

```javascript
// Step 4: Read from slot 1 (testing fix)  ← WRONG: Should be WRITE
const readSlot1 = buildCustomModeReadRequest(1, 0);
output.sendMessage(readSlot1);

const slot1Response = await waitForMessage('Slot 1 response', (bytes) => {
  // Check for status 0x9 error
  if (bytes.length === 12 && bytes[8] === 0x15 && bytes[10] === 0x09) {
    receivedStatus9 = true;
    return true;
  }
  // Check for successful response
  return bytes[0] === 0xF0 && bytes[8] === 0x10;
}, TEST_TIMEOUT);
```

**Critical flaw**: Bug only affects WRITE operations. Reads always work regardless of slot selection, so test gave false positive.

**2. Unverified Protocol Assumptions**

Current implementation uses SysEx command 0x77 (TEMPLATE_CHANGE):

```typescript
// src/core/SysExParser.ts:841-854
static buildTemplateChange(templateNumber: number): number[] {
  return [
    0xF0, // SysEx start
    ...MANUFACTURER_ID,  // 0x00 0x20 0x29
    0x02, // Device ID (Launch Control XL 3)
    SysExMessageType.TEMPLATE_CHANGE,  // 0x77
    templateNumber,
    0xF7, // SysEx end
  ];
}
```

**Problems**:
- No MIDI capture exists to verify command 0x77 validity for XL3
- No evidence this command actually changes target slot for write operations
- Protocol docs say "slot selection uses SysEx slot byte directly" (contradicts implementation)

**3. Protocol Documentation Contradiction**

From `modules/launch-control-xl3/docs/PROTOCOL.md`:

```markdown
## Slot Selection Protocol (DEPRECATED - Phase 4)
**Status:** DEPRECATED as of 2025-10-01

**Discovery (2025-10-01):** The SysEx slot byte parameter works independently
for slot selection. Simply include the slot number (0-14) in the SysEx
read/write request. No DAW port communication required.
```

**Contradiction**: Docs claim slot byte in SysEx message controls target, but implementation sends separate 0x77 command.

**Evidence gap**: No MIDI capture or empirical test validates either approach for WRITE operations.

---

## Analysis

### Known Facts

1. **READ operations work** - Can read from any slot without error
2. **WRITE operations fail** - Status 0x9 when writing to inactive slots
3. **Active slot works** - Can write to currently selected slot (via hardware buttons)
4. **Command 0x77 exists** - Template change command from Launchpad protocol
5. **Device ID 0x02 confirmed** - Correct for Launch Control XL3

### Unknown Factors

1. **Is command 0x77 valid for XL3?**
   - May be Launchpad-specific
   - Never captured in actual device MIDI traffic
   - No manufacturer documentation confirms support

2. **What does physical slot button press send?**
   - No MIDI capture exists
   - Could reveal actual slot selection mechanism
   - May use different command or implicit selection

3. **Do write operations implicitly select slot?**
   - Hypothesis: slot byte in write SysEx may auto-select target
   - Would explain why reads work without pre-selection
   - Needs empirical testing

4. **Does timing/sequencing matter?**
   - May need delay after selection
   - May need acknowledgement handling
   - May require specific message ordering

### Hypotheses to Investigate

**Hypothesis 1: Implicit Slot Selection**
```
Theory: Write SysEx slot byte automatically selects target slot
Evidence needed: Test write with different slot bytes
Test: Write to slot 3 without pre-selection, slot byte = 3
Expected: Success (contradicts current understanding)
```

**Hypothesis 2: Command 0x77 Invalid**
```
Theory: Command 0x77 not supported by XL3 firmware
Evidence needed: MIDI capture of physical button press
Test: Press slot 3 button, capture MIDI traffic
Expected: Different command or no SysEx message
```

**Hypothesis 3: DAW Port Required**
```
Theory: Slot selection requires DAW port protocol (deprecated phase)
Evidence needed: Re-test DAW port approach
Test: Use DAW port slot selection, then write
Expected: Success (but defeats purpose of phase 4 simplification)
```

**Hypothesis 4: Web Editor Difference**
```
Theory: Web editor uses different protocol for writes
Evidence needed: Playwright capture of web editor write operation
Test: Automate web editor to write to inactive slot, capture MIDI
Expected: Different command sequence than our implementation
```

---

## Implementation Plan

### Phase 1: Investigation & Protocol Discovery

**Goal**: Empirically determine correct slot selection mechanism for write operations

#### Task 1.1: MIDI Capture of Physical Slot Selection
**Duration**: 1-2 hours
**Tools**: `midisnoop`, hardware device

**Steps**:
1. Start MIDI spy: `cd modules/coremidi/midi-snoop && make run`
2. Press slot button 3 on physical device
3. Capture and analyze MIDI messages
4. Document exact byte sequence
5. Compare with current implementation

**Success Criteria**:
- Captured exact MIDI traffic when pressing slot buttons
- Documented byte-level protocol
- Identified if command 0x77 is actually used

**Deliverables**:
- `modules/audio-control/tmp/slot-button-midi-capture-[date].txt` - Raw capture
- Update to `modules/launch-control-xl3/docs/PROTOCOL.md` with findings

#### Task 1.2: Test Implicit Slot Selection Hypothesis
**Duration**: 1 hour
**Tools**: `node-midi`, test utility

**Steps**:
1. Create test: Write to slot 3 without any pre-selection command
2. Use slot byte = 3 in write SysEx message
3. Observe if write succeeds or fails with status 0x9
4. Repeat for multiple slots

**Test Code**:
```javascript
// Test: Can slot byte in write SysEx auto-select target?
const writeSlot3 = buildCustomModeWriteRequest(3, 0, modeData);
output.sendMessage(writeSlot3); // NO pre-selection command

const response = await waitForResponse();
// Success = hypothesis confirmed
// Status 0x9 = hypothesis rejected
```

**Success Criteria**:
- Definitive answer: Does slot byte auto-select or not?
- Documented in protocol investigation notes

#### Task 1.3: Web Editor MIDI Traffic Capture
**Duration**: 2-3 hours
**Tools**: Playwright, MIDI spy

**Steps**:
1. Set up Playwright automation for Components web editor
2. Load custom mode in editor
3. Modify mode configuration
4. Write to device at specific slot
5. Capture all MIDI traffic during write operation
6. Analyze command sequence

**Success Criteria**:
- Captured web editor's exact write sequence
- Identified any pre-selection commands
- Documented differences from our implementation

**Deliverables**:
- `modules/audio-control/tmp/web-editor-write-capture-[date].txt`
- Comparison document: web editor vs our implementation

#### Task 1.4: Verify Command 0x77 Behavior
**Duration**: 1 hour
**Tools**: `node-midi`, test utility

**Steps**:
1. Send command 0x77 with device ID 0x02 for slot 3
2. Wait 500ms (allow device to process)
3. Attempt write with slot byte = 3
4. Check for status 0x9 error
5. Repeat with different timing delays

**Success Criteria**:
- Determined if command 0x77 has any effect
- Documented timing requirements if any

### Phase 2: Fix Implementation

**Goal**: Implement correct slot selection mechanism based on investigation findings

**Note**: Actual implementation depends on Phase 1 results. Three possible paths:

#### Path A: Implicit Selection (if Hypothesis 1 confirmed)

**Change**: Remove separate slot selection command entirely

**Files to modify**:
- `src/device/DeviceManager.ts` - Remove `selectSlot()` call before writes
- `src/core/SysExParser.ts` - Ensure write requests use correct slot byte
- `docs/PROTOCOL.md` - Update to document implicit selection

**Implementation**:
```typescript
// In CustomModeManager.writeCustomMode()
async writeCustomMode(slot: number, mode: CustomMode): Promise<void> {
  // OLD: await this.deviceManager.selectSlot(slot);

  // NEW: Slot selection is implicit via SysEx slot byte
  for (let page = 0; page < 3; page++) {
    const sysex = SysExParser.buildCustomModeWriteRequest(slot, page, pageData);
    await this.sendSysEx(sysex);
    await this.waitForAck();
  }
}
```

#### Path B: Different Command (if Hypothesis 2 confirmed)

**Change**: Replace command 0x77 with correct command from capture

**Files to modify**:
- `src/core/SysExParser.ts` - Update `buildTemplateChange()` with correct command
- `src/types/SysExMessageType.ts` - Add new command constant
- `docs/PROTOCOL.md` - Document discovered command

**Implementation**: Depends on captured byte sequence

#### Path C: Web Editor Protocol (if Hypothesis 4 reveals solution)

**Change**: Replicate web editor's exact command sequence

**Files to modify**:
- `src/device/DeviceManager.ts` - Implement web editor sequence
- `src/core/SysExParser.ts` - Add any new message builders
- `docs/PROTOCOL.md` - Document complete sequence

**Implementation**: Depends on web editor capture analysis

---

### Phase 3: Validation & Testing

**Goal**: Ensure fix works reliably with comprehensive test coverage

#### Task 3.1: Create Write Operation Test Suite
**Duration**: 2-3 hours
**Tools**: Vitest, node-midi

**Test Cases**:
1. Write to inactive slot (must succeed)
2. Write to active slot (must succeed)
3. Sequential writes to different slots
4. Write without selection (must fail if selection required)
5. Write with invalid slot number (must fail gracefully)
6. Multiple page writes (real-world scenario)

**File**: `test/integration/test-custom-mode-write.test.ts`

**Critical Test**:
```javascript
it('should write to inactive slot after selection', async () => {
  // Start with slot 0 active
  await selectSlot(0);

  // Write to slot 3 (inactive)
  const result = await writeCustomMode(3, testMode);

  // MUST NOT receive status 0x9
  expect(result.status).not.toBe(0x9);
  expect(result.success).toBe(true);

  // Verify write actually worked
  const readBack = await readCustomMode(3);
  expect(readBack.mode.name).toBe(testMode.name);
});
```

#### Task 3.2: Update Existing Integration Tests
**Duration**: 1 hour

**Files to modify**:
- `test/integration/test-slot-selection.cjs` - Add write operation tests
- Delete or rewrite READ-only tests that gave false positives

#### Task 3.3: Real Device Validation
**Duration**: 1 hour
**Tools**: Physical hardware, backup utility

**Validation Steps**:
1. Run full test suite against real device
2. Use backup utility to write to multiple slots
3. Verify each slot via web editor
4. Test edge cases (slot 0, slot 14, rapid switching)

**Success Criteria**:
- All tests pass with real hardware
- No status 0x9 errors in any scenario
- Writes verified via independent tool (web editor)

---

### Phase 4: Documentation Updates

**Goal**: Ensure all documentation accurately reflects fix

#### Task 4.1: Protocol Documentation
**Duration**: 1 hour

**File**: `modules/launch-control-xl3/docs/PROTOCOL.md`

**Updates Required**:
- Remove DEPRECATED marker if DAW port not needed
- Document actual slot selection mechanism
- Add version history entry for fix
- Include MIDI capture evidence
- Explain discovery methodology

**Version History Entry**:
```markdown
### 2025-10-15 - Slot Selection for Write Operations (Issue #36 Fix)

**Discovery**: [Describe actual finding from investigation]

**Protocol Change**: [Describe what changed]

**Evidence**: MIDI captures in `backup/captures/slot-selection-[date]/`

**Rationale**: [Explain why this approach works]

**Previous Approach**: Used command 0x77, which [explain why it failed]
```

#### Task 4.2: Architecture Documentation
**Duration**: 30 minutes

**File**: `modules/launch-control-xl3/docs/ARCHITECTURE.md`

**Updates**:
- Update data flow diagram if slot selection mechanism changed
- Document timing requirements if any
- Explain any new protocol phases

#### Task 4.3: Update Kaitai Struct Specification
**Duration**: 30 minutes

**File**: `modules/launch-control-xl3/formats/launch_control_xl3.ksy`

**Updates**:
- Add any newly discovered message types
- Update documentation comments
- Validate compilation: `kaitai-struct-compiler formats/launch_control_xl3.ksy`

#### Task 4.4: Workplan Post-Mortem
**Duration**: 30 minutes

**File**: This file - add "Post-Implementation Review" section

**Content**:
- What was the actual root cause?
- Why did v1.20.10 fix fail?
- Lessons learned about validation methodology
- Recommendations for future protocol changes

---

### Phase 5: Release Process

**Goal**: Ship validated fix to users

#### Task 5.1: Create Changeset
**Duration**: 15 minutes

```bash
pnpm changeset
# Select: @oletizi/launch-control-xl3 (patch)
# Message: "Fix slot selection for write operations (Issue #36)"
```

#### Task 5.2: Version and Publish
**Duration**: 30 minutes

```bash
# Version packages
pnpm changeset:version

# Build all packages
pnpm -r build

# Verify tests pass
pnpm test

# Publish
pnpm changeset:publish
```

#### Task 5.3: Update GitHub Issue
**Duration**: 15 minutes

**Comment**:
```markdown
## ✅ Fixed in v1.20.x

**Root Cause**: [Describe actual cause from investigation]

**Fix**: [Describe solution implemented]

**Validation**:
- ✅ Write operations to inactive slots succeed
- ✅ Integration tests cover write scenarios
- ✅ Tested against real hardware
- ✅ Verified via web editor cross-check

**Evidence**: See MIDI captures in repository backup directory

**Breaking Changes**: None

Closing as fixed.
```

#### Task 5.4: Create Release Notes
**Duration**: 15 minutes

**GitHub Release**:
```markdown
## v1.20.x - Issue #36 Fix

### 🐛 Bug Fixes

**Launch Control XL3: Slot Selection for Write Operations (#36)**

Fixed device firmware rejecting writes to inactive slots with status 0x9 error.

**What Changed**:
- [Describe actual changes based on implementation path]

**Impact**:
- Users can now reliably write custom mode configurations to any slot
- No more status 0x9 errors when writing to inactive slots

**Validation**:
- Comprehensive write operation test suite
- Real hardware validation
- MIDI protocol captures documented

**Previous Fix Attempt**:
v1.20.10 incorrectly attempted to fix this by changing device ID in command 0x77.
This failed because [explain reason based on investigation].

### Credits
Thanks to [user] for detailed testing and validation feedback.
```

---

## Timeline Estimate

### Optimistic (Investigation Path A - Implicit Selection)
- Phase 1: 4-5 hours
- Phase 2: 1-2 hours
- Phase 3: 3-4 hours
- Phase 4: 2-3 hours
- Phase 5: 1 hour
**Total**: 11-15 hours active work, ~2 days calendar time

### Pessimistic (Investigation Path C - Complex Protocol)
- Phase 1: 6-8 hours (web editor analysis complex)
- Phase 2: 3-4 hours (complex implementation)
- Phase 3: 4-5 hours (extensive testing)
- Phase 4: 3-4 hours (significant doc updates)
- Phase 5: 1 hour
**Total**: 17-22 hours active work, ~3-4 days calendar time

## Success Criteria

### Technical Validation
- [ ] Write to inactive slot succeeds without status 0x9 error
- [ ] All integration tests pass with real hardware
- [ ] MIDI captures document actual protocol behavior
- [ ] Implementation matches discovered protocol
- [ ] No regressions in read operations

### Documentation Quality
- [ ] Protocol docs updated with evidence and methodology
- [ ] Version history documents discovery process
- [ ] Architecture docs reflect any changes
- [ ] Kaitai struct specification synchronized
- [ ] All four key files synchronized (per MAINTENANCE.md)

### User Acceptance
- [ ] User testing confirms fix works
- [ ] No status 0x9 errors in user's workflow
- [ ] Fix validated in production use case
- [ ] User closes issue as resolved

### Process Improvements
- [ ] Integration tests validate actual bug scenario (writes, not reads)
- [ ] MIDI capture evidence exists for future reference
- [ ] Post-mortem documents why v1.20.10 failed
- [ ] Validation methodology improved to prevent false positives

---

## Risk Assessment

### High Risk Items

**Risk**: Investigation reveals no viable fix
- **Probability**: Low (device clearly supports slot writes via web editor)
- **Mitigation**: Web editor MIDI capture provides working solution
- **Fallback**: Implement exact web editor protocol sequence

**Risk**: Fix requires firmware-level changes
- **Probability**: Very Low (web editor works with current firmware)
- **Mitigation**: N/A - web editor proves software solution exists
- **Fallback**: Document limitation, request firmware update from Novation

**Risk**: Timing/race conditions cause intermittent failures
- **Probability**: Medium (real-time MIDI protocol)
- **Mitigation**: Comprehensive timing tests, add acknowledgement handling
- **Fallback**: Document timing requirements, add retry logic

### Medium Risk Items

**Risk**: Different firmware versions behave differently
- **Probability**: Medium (common in hardware devices)
- **Mitigation**: Test with multiple firmware versions if available
- **Fallback**: Document firmware version requirements

**Risk**: Solution breaks existing functionality
- **Probability**: Low (comprehensive test suite exists)
- **Mitigation**: Run full test suite before release
- **Fallback**: Revert and re-investigate

---

## Lessons Learned from v1.20.10 Failure

### What Went Wrong

1. **Insufficient Test Coverage**
   - Test validated READ operations only
   - Bug affects WRITE operations only
   - False positive gave incorrect confidence

2. **No Empirical Evidence**
   - Never captured MIDI traffic from actual slot button press
   - Assumed command 0x77 based on Launchpad protocol
   - No validation that command works for XL3

3. **Ignored Documentation Contradiction**
   - Protocol docs said "SysEx slot byte works directly"
   - Implementation used separate selection command
   - Never investigated which approach was correct

4. **Premature Release**
   - Released without user acceptance testing
   - Claimed fix worked without validation
   - Didn't test actual failure scenario

### Process Improvements

**MUST DO for all protocol changes**:
- [ ] Capture MIDI traffic from real device behavior
- [ ] Test the actual operation that fails (not proxy operations)
- [ ] Validate with user acceptance test before release
- [ ] Document evidence and methodology in protocol docs
- [ ] Never assume protocol behavior without empirical proof

**MUST NOT DO**:
- ❌ Test reads when bug affects writes
- ❌ Assume commands work without MIDI capture
- ❌ Ignore contradictions between docs and implementation
- ❌ Release without user validation
- ❌ Claim fix works based on passing test suite alone

---

## Approval & Sign-off

### Investigation Phase Complete
- [ ] MIDI captures documented in backup directory
- [ ] All hypotheses tested empirically
- [ ] Root cause identified with evidence
- [ ] Implementation path selected
- **Signed**: _________________ Date: _______

### Implementation Complete
- [ ] Fix implemented per investigation findings
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Code reviewed
- **Signed**: _________________ Date: _______

### User Acceptance
- [ ] User confirms fix resolves issue
- [ ] No status 0x9 errors in user workflow
- [ ] Production use case validated
- **Signed**: _________________ Date: _______

### Release Authorization
- [ ] All success criteria met
- [ ] Changelog and release notes prepared
- [ ] Version bumped appropriately
- **Signed**: _________________ Date: _______

---

## References

- **Issue**: https://github.com/oletizi/ol_dsp/issues/36
- **Failed Fix PR**: #37 (v1.20.10)
- **Protocol Docs**: `modules/launch-control-xl3/docs/PROTOCOL.md`
- **Test File**: `test/integration/test-slot-selection.cjs`
- **Parser**: `src/core/SysExParser.ts:841-854`

---

**Document Status**: Draft - Awaiting Phase 1 Investigation
**Next Action**: Begin Task 1.1 (MIDI Capture of Physical Slot Selection)
**Owner**: Development Team
**Reviewers**: [To be assigned]

```typescript
/**
 * Write custom mode to device
 *
 * UPDATED: Now includes slot pre-selection to ensure device accepts write
 */
async writeCustomMode(slot: number, mode: CustomMode): Promise<void> {
  if (slot < 0 || slot > 15) {
    throw new Error('Custom mode slot must be 0-15');
  }

  // NEW: Phase 1 - Select target slot
  console.log(`[DeviceManager] Selecting slot ${slot} before write`);
  await this.selectTemplate(slot);

  // NEW: Phase 1.5 - Wait for device to acknowledge slot selection
  // (Implementation depends on Phase 3 findings)
  await this.waitForSlotSelection(slot);

  // EXISTING: Phase 2 - Write to now-active slot
  const modeData = {
    slot,
    name: mode.name,
    controls: mode.controls,
    colors: mode.colors,
  };

  const validatedModeData = this.validateCustomModeData(modeData);
  const message = SysExParser.buildCustomModeWriteRequest(slot, validatedModeData);
  await this.sendSysEx(message);
}

/**
 * Wait for device to acknowledge slot selection
 *
 * NEW METHOD: Ensures device has switched slots before write
 */
private async waitForSlotSelection(slot: number): Promise<void> {
  // Implementation option A: Fixed delay (simple, may be fragile)
  await new Promise(resolve => setTimeout(resolve, 100)); // 100ms

  // Implementation option B: Wait for acknowledgement (robust, complex)
  // return new Promise((resolve, reject) => {
  //   const timeout = setTimeout(() => {
  //     reject(new Error(`Slot selection timeout for slot ${slot}`));
  //   }, 1000);
  //
  //   this.once('device:modeChanged', (mode) => {
  //     if (mode.slot === slot) {
  //       clearTimeout(timeout);
  //       resolve();
  //     }
  //   });
  // });
}
```

**Decision Point**: Fixed Delay vs. Acknowledgement Wait

**Option A: Fixed Delay** (RECOMMENDED for MVP)
- **Pros**: Simple, requires no protocol changes
- **Cons**: May be too slow (waste time) or too fast (race condition)
- **Implementation**: 100ms delay (conservative)

**Option B: Acknowledgement Wait** (IDEAL for production)
- **Pros**: Robust, optimal timing, error detection
- **Cons**: Requires Phase 3 completion, more complex
- **Implementation**: Event-based wait with timeout

**Recommendation**: Start with Option A (fixed delay) for initial testing, refine to Option B if needed.

#### Additional Changes

**File**: `src/device/DeviceManager.ts`
**Enhancement**: Update template change handler

```typescript
// EXISTING (line 387-394)
case 'template_change':
  const templateChange = this.validateTemplateChangeResponse(parsed);
  this.currentMode = {
    type: 'template',
    slot: templateChange.templateNumber,
  };
  this.emit('device:modeChanged', this.currentMode);
  break;

// ENHANCED: Add to setupMidiHandlers() to receive during initialization
this.midi.on('sysex', (message: MidiMessage) => {
  // Remove isInitializing check for template_change messages
  this.emit('sysex:received', message.data);
  this.handleSysExMessage([...message.data]);
});
```

**Rationale**: Template change responses should be handled even during writes, not just initialization.

### Testing During Implementation

**Unit Test** (create `test/DeviceManager.writeCustomMode.test.ts`):

```typescript
describe('DeviceManager.writeCustomMode', () => {
  it('should select template before writing', async () => {
    const mockBackend = new MockMidiBackend();
    const device = new DeviceManager({ midiBackend: mockBackend });
    await device.connect();

    const selectTemplateSpy = jest.spyOn(device, 'selectTemplate');

    await device.writeCustomMode(3, testMode);

    expect(selectTemplateSpy).toHaveBeenCalledWith(3);
    expect(selectTemplateSpy).toHaveBeenCalledBefore(/* write message sent */);
  });

  it('should handle slot selection failure gracefully', async () => {
    // ... test error handling ...
  });
});
```

**Integration Test** (real device required):

```typescript
// test/integration/cross-slot-write.test.ts
describe('Cross-slot write operations', () => {
  it('should write to inactive slot successfully', async () => {
    const device = await connectRealDevice();

    // Physically select slot 1
    // Programmatically write to slot 3
    await device.writeCustomMode(3, testMode);

    // Verify: Read back from slot 3
    const readBack = await device.readCustomMode(3);
    expect(readBack.name).toBe(testMode.name);
  });
});
```

---

## Testing Plan

### Phase 5: Comprehensive Testing (Priority: CRITICAL)

**Duration**: 2-3 hours
**Goal**: Validate implementation across all scenarios

### Test Suite

#### Test 1: Active Slot Write (Baseline)

**Purpose**: Verify no regression in existing functionality

```typescript
test('Write to currently active slot succeeds', async () => {
  // Setup: Device on slot 1
  await device.selectTemplate(1);

  // Execute: Write to slot 1
  await device.writeCustomMode(1, testMode);

  // Verify: Read back
  const result = await device.readCustomMode(1);
  expect(result.name).toBe(testMode.name);
});
```

**Expected**: Success (status 0x06), no change in behavior

---

#### Test 2: Cross-Slot Write (Primary Test)

**Purpose**: Validate core fix for issue #36

```typescript
test('Write to inactive slot succeeds', async () => {
  // Setup: Device on slot 1
  await device.selectTemplate(1);

  // Execute: Write to slot 3 (inactive)
  await device.writeCustomMode(3, testMode);

  // Verify: Device physically switched to slot 3
  expect(device.getStatus().currentMode?.slot).toBe(3);

  // Verify: Data written correctly
  const result = await device.readCustomMode(3);
  expect(result.name).toBe(testMode.name);
  expect(result.controls).toHaveLength(48);
});
```

**Expected**:
- ✅ Write succeeds (no 0x9 error)
- ✅ Device displays slot 3 as active
- ✅ Data correctly written to slot 3

---

#### Test 3: Sequential Multi-Slot Writes

**Purpose**: Validate rapid slot switching

```typescript
test('Sequential writes to different slots succeed', async () => {
  // Setup: Start on slot 0
  await device.selectTemplate(0);

  // Execute: Write to slots 1, 2, 3 in sequence
  await device.writeCustomMode(1, createMode('Mode1'));
  await device.writeCustomMode(2, createMode('Mode2'));
  await device.writeCustomMode(3, createMode('Mode3'));

  // Verify: All writes succeeded
  expect(await device.readCustomMode(1)).toMatchObject({ name: 'Mode1' });
  expect(await device.readCustomMode(2)).toMatchObject({ name: 'Mode2' });
  expect(await device.readCustomMode(3)).toMatchObject({ name: 'Mode3' });
});
```

**Expected**: All writes succeed, no timing issues

---

#### Test 4: Error Handling

**Purpose**: Validate graceful failure modes

```typescript
test('Slot selection failure provides clear error', async () => {
  // Simulate device disconnection or error
  mockBackend.simulateError('Slot selection timeout');

  await expect(
    device.writeCustomMode(5, testMode)
  ).rejects.toThrow('Slot selection timeout');
});

test('Write continues to fail for invalid slot numbers', async () => {
  await expect(
    device.writeCustomMode(16, testMode) // Invalid: max is 15
  ).rejects.toThrow('Custom mode slot must be 0-15');
});
```

**Expected**: Descriptive errors, no hangs or crashes

---

#### Test 5: xl3-web Integration Test

**Purpose**: Validate end-to-end web app functionality

**Location**: `xl3-web` repository

```typescript
// test/e2e/cross-slot-operations.spec.ts
test('Fetch from slot 1, Send to slot 3', async ({ page }) => {
  await page.goto('/');

  // Select slot 1
  await page.click('[data-testid="slot-selector"]');
  await page.click('text=Slot 1');

  // Fetch mode
  await page.click('[data-testid="fetch-button"]');
  await expect(page.locator('[data-testid="mode-name"]')).toBeVisible();

  // Change slot to 3
  await page.click('[data-testid="slot-selector"]');
  await page.click('text=Slot 3');

  // Send mode (cross-slot operation)
  await page.click('[data-testid="send-button"]');

  // Verify: Success toast
  await expect(page.locator('text=Mode sent successfully')).toBeVisible();

  // Verify: No error toast
  await expect(page.locator('text=status 0x9')).not.toBeVisible();
});
```

**Expected**: Web app operations complete successfully

---

### Performance Testing

**Goal**: Ensure acceptable latency for slot switching

```typescript
test('Slot selection completes within 500ms', async () => {
  const start = Date.now();
  await device.selectTemplate(5);
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(500);
});

test('Complete write operation (select + write) < 3 seconds', async () => {
  const start = Date.now();
  await device.writeCustomMode(5, testMode);
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(3000);
});
```

**Expected**:
- Slot selection: < 500ms
- Complete write: < 3 seconds

---

### Success Criteria

Implementation is complete and successful when:

1. ✅ **Functionality**: All tests pass
2. ✅ **No Regressions**: Active slot writes still work
3. ✅ **Core Fix**: Cross-slot writes succeed (no 0x9 errors)
4. ✅ **Performance**: Operations complete within acceptable timeframes
5. ✅ **Error Handling**: Clear error messages, no hangs
6. ✅ **xl3-web Integration**: Web app functionality restored
7. ✅ **Real Device**: Validated with physical hardware

---

## Documentation Updates

### Phase 6: Protocol Documentation (Priority: HIGH)

**Duration**: 1 hour
**Goal**: Update all documentation to reflect slot selection requirement

### Files to Update

#### 1. PROTOCOL.md

**Location**: `modules/audio-control/modules/launch-control-xl3/docs/PROTOCOL.md`

**Changes Required**:

**Section to Add** (after line 188):

```markdown
### Slot Selection for Writes

**CRITICAL REQUIREMENT**: Before writing to any slot, the device MUST be instructed to select that slot via template change command.

**Protocol Sequence**:
```
Step 1: Select Target Slot
  Message: F0 00 20 29 02 11 77 [slot] F7
  Command: 0x77 (Template Change)
  Purpose: Activate target slot on device

Step 2: Wait for Device Response
  Expected: Template change acknowledgement (format TBD)
  Timing: ~24-50ms response time

Step 3: Write to Selected Slot
  Message: F0 00 20 29 02 15 05 00 45 [page] [slot] [data] F7
  Command: 0x45 (Write)
  Purpose: Write mode data to now-active slot
```

**Why This is Required**:
- Device firmware only accepts writes to the currently active slot
- The slot parameter in the write message (0x45) is **not sufficient** alone
- Template change (0x77) activates the slot and enables write operations

**Example: Writing to Slot 3**:
```
1. Send: F0 00 20 29 02 11 77 03 F7  (select slot 3)
2. Wait: ~100ms for device to switch
3. Send: F0 00 20 29 02 15 05 00 45 00 03 [data] F7  (write page 0 to slot 3)
4. Wait: For acknowledgement (F0 00 20 29 02 15 05 00 15 00 06 F7)
5. Send: F0 00 20 29 02 15 05 00 45 03 03 [data] F7  (write page 1 to slot 3)
6. Wait: For acknowledgement
```

**Error Handling**:
- Writing without slot selection: Device returns status 0x09 (rejection)
- Writing to slot 0: May work without selection (default/fallback slot)
- Writing to slot 15: Reserved, immutable - always fails
```

**Version History Entry**:
```markdown
| 1.9 | 2025-10-12 | **Slot Selection Discovery:** Documented requirement for template change (0x77) before writes. Device rejects writes to inactive slots with status 0x09. Added complete write protocol sequence. Reference: GitHub issue #36 |
```

---

#### 2. ARCHITECTURE.md

**Location**: `modules/audio-control/modules/launch-control-xl3/docs/ARCHITECTURE.md`

**Section to Update**: "Write Flow" diagram

**Add**:
```markdown
### Custom Mode Write Flow (Updated 2025-10-12)

```
┌─────────────────┐
│  Application    │
│  Request Write  │
│  to Slot N      │
└────────┬────────┘
         │
         ↓
┌─────────────────────┐
│ DeviceManager       │
│ .writeCustomMode(N) │
└────────┬────────────┘
         │
         ├─→ Phase 1: Slot Selection
         │   ├─→ buildTemplateChange(N)
         │   ├─→ Send 0x77 command
         │   └─→ Wait for ACK/confirmation
         │
         ├─→ Phase 2: Write Page 0
         │   ├─→ buildCustomModeWriteRequest(N, page=0)
         │   ├─→ Send 0x45 command (page 0)
         │   └─→ Wait for ACK (status 0x06)
         │
         └─→ Phase 3: Write Page 1
             ├─→ buildCustomModeWriteRequest(N, page=1)
             ├─→ Send 0x45 command (page 1)
             └─→ Wait for ACK (status 0x06)
```

**Key Changes (Issue #36 Fix)**:
- Added Phase 1: Slot Selection via template change (0x77)
- Device must acknowledge slot switch before write
- Prevents status 0x09 rejection on inactive slots
```

---

#### 3. API.md

**Location**: `modules/audio-control/modules/launch-control-xl3/docs/API.md`

**Update**: `writeCustomMode()` documentation

```markdown
### writeCustomMode(slot, mode)

Write a custom mode to the device.

**IMPORTANT (v1.21.0+)**: This method now includes automatic slot selection. The device will physically switch to the target slot before writing. This may cause a brief visual indication on the device.

**Parameters**:
- `slot` (number): Target slot (0-14, slot 15 is reserved)
- `mode` (CustomMode): Mode configuration to write

**Behavior**:
1. Sends template change command to select target slot
2. Waits for device to acknowledge slot selection
3. Writes mode data to now-active slot
4. Returns after both pages written successfully

**Timing**: Approximately 0.5-2.0 seconds depending on mode complexity

**Throws**:
- `Error`: If slot out of range (0-15)
- `Error`: If slot selection times out
- `Error`: If write fails (status !== 0x06)

**Example**:
```typescript
// Write to slot 3 (device will switch to slot 3)
await device.writeCustomMode(3, myCustomMode);

// Device is now on slot 3 after write completes
```

**Historical Note**: Prior to v1.21.0, writes to inactive slots would fail with status 0x09. See GitHub issue #36.
```

---

#### 4. CHANGELOG.md

**Location**: `modules/audio-control/modules/launch-control-xl3/CHANGELOG.md`

**Add Entry**:

```markdown
## [1.21.0] - 2025-10-12

### Fixed
- **Issue #36**: Device now accepts writes to inactive slots by implementing automatic slot selection
  - Added template change (0x77) before write operations
  - Device switches to target slot before writing
  - Eliminates status 0x09 rejection errors
  - Enables cross-slot operations in xl3-web application

### Changed
- `DeviceManager.writeCustomMode()` now includes slot pre-selection
- Write operations may take slightly longer due to slot switching
- Device physically changes slots during programmatic writes (visible on hardware)

### Documentation
- Updated PROTOCOL.md with slot selection requirement
- Updated ARCHITECTURE.md with new write flow diagram
- Enhanced API.md with timing and behavior notes
```

---

#### 5. Module README

**Location**: `modules/audio-control/modules/launch-control-xl3/README.md`

**Add Note** (in "Known Limitations" or similar section):

```markdown
### Slot Selection Behavior

When writing to a slot programmatically, the device will **physically switch** to that slot. This is required by the device firmware and cannot be avoided.

**User Experience Note**: If writing to multiple slots in sequence, users will see the device's slot indicator change. This is normal behavior.

**Workaround**: If you need to write to multiple slots without visual switching, there is currently no way to do this with the device firmware. Each write requires slot activation.
```

---

## Timeline & Resource Allocation

### Estimated Duration

| Phase | Duration | Type | Dependencies |
|-------|----------|------|--------------|
| 1. MIDI Traffic Capture | 2-3h | Investigation | MIDI spy tool |
| 2. Template Validation | 1-2h | Investigation | Phase 1 |
| 3. Acknowledgement Analysis | 1h | Investigation | Phases 1-2 |
| 4. Implementation | 2-3h | Development | Phases 1-3 |
| 5. Testing | 2-3h | Validation | Phase 4 |
| 6. Documentation | 1h | Documentation | All phases |
| **Total** | **10-14h** | | |

### Parallel Execution Opportunities

**Can Run in Parallel**:
- Phase 1 and Phase 2 (different team members)
- Phase 5 test writing while Phase 4 coding continues

**Must Run Sequential**:
- Phases 1-2-3 (investigation builds on findings)
- Phase 4 requires Phases 1-3 complete
- Phase 5 requires Phase 4 complete
- Phase 6 requires Phase 5 complete

### Team Allocation Recommendation

| Role | Phases | Responsibilities |
|------|--------|------------------|
| **embedded-systems** | 1, 2, 3 | MIDI capture, protocol validation, device testing |
| **typescript-pro** | 4 | Implementation, code quality |
| **test-automator** | 5 | Test design, execution, validation |
| **documentation-engineer** | 6 | Protocol docs, API docs, changelog |
| **architect-reviewer** | All | Review plans, validate approach, final sign-off |

---

## Risk Assessment

### Technical Risks

#### Low Risk ✅

**Risk**: Implementation breaks existing functionality
**Mitigation**:
- Comprehensive test suite covers baseline scenarios
- Changes are additive (slot selection before write)
- No modification to existing protocol messages

**Risk**: Performance degradation
**Mitigation**:
- Slot selection adds ~100-300ms (acceptable)
- Total write time still < 3 seconds
- Performance tests validate timing

---

#### Medium Risk ⚠️

**Risk**: Timing/synchronization issues between selection and write
**Impact**: Intermittent failures, race conditions
**Mitigation**:
- Start with conservative fixed delay (100ms)
- Add explicit acknowledgement wait if needed
- Implement timeout error handling

**Risk**: Unknown acknowledgement format for template changes
**Impact**: Cannot reliably wait for slot selection
**Mitigation**:
- Phase 3 investigation identifies format
- Fallback to fixed delay if no ACK
- Use existing event system for template_change

**Risk**: Device state management complexity
**Impact**: Difficult to track current slot, synchronization issues
**Mitigation**:
- Use existing currentMode state tracking
- Listen to template_change events
- Add explicit state queries if needed

---

#### High Risk 🚨

**Risk**: Hypothesis is incorrect - slot selection doesn't solve the problem
**Impact**: Wasted investigation time, need alternative solution
**Mitigation**:
- Phase 1 MIDI capture validates hypothesis early
- Phase 2 empirical test confirms before full implementation
- Alternative hypotheses documented (see below)

---

### Alternative Approaches

If slot selection doesn't solve the problem:

**Plan B: Require Manual Slot Selection**
- Document that user must select slot on device before write
- Add UI warning/instruction in xl3-web
- **Pros**: Simple, no code changes
- **Cons**: Poor UX, defeats purpose of remote management

**Plan C: Contact Novation Support**
- Request official protocol documentation
- Report potential firmware issue
- Request firmware update to accept inactive slot writes
- **Pros**: Authoritative answer, potential permanent fix
- **Cons**: Long timeline, uncertain outcome

**Plan D: Read-Modify-Active-Slot Pattern**
- Read from target slot → memory
- User selects slot on device
- Write from memory to now-active slot
- **Pros**: Works within constraints
- **Cons**: Multi-step UX, error-prone

**Plan E: Defer to Future Firmware**
- Document limitation clearly
- Mark as "known issue"
- Wait for Novation to address in firmware update
- **Pros**: No immediate work required
- **Cons**: Indefinite timeline, functionality blocked

---

## Success Metrics

### Functional Metrics

1. ✅ **Core Fix**: Cross-slot writes succeed without 0x9 errors
2. ✅ **No Regression**: Active slot writes continue to work
3. ✅ **Web App Integration**: xl3-web operations functional
4. ✅ **Error Handling**: Clear error messages, graceful failures

### Performance Metrics

1. ✅ **Slot Selection**: < 500ms per slot switch
2. ✅ **Complete Write**: < 3 seconds (slot select + 2 pages)
3. ✅ **Sequential Writes**: 3 slots in < 10 seconds

### Quality Metrics

1. ✅ **Test Coverage**: All new code paths tested
2. ✅ **Documentation**: Complete protocol specification
3. ✅ **Real Device**: Validated with physical hardware
4. ✅ **Code Review**: Approved by architect-reviewer

### User Experience Metrics

1. ✅ **Transparency**: Users understand slot switching behavior
2. ✅ **Reliability**: 100% success rate in automated tests
3. ✅ **Performance**: Acceptable latency for typical workflows

---

## Open Questions

### Questions Requiring Investigation

1. **What is the exact acknowledgement format for template change (0x77)?**
   - Answered by: Phase 3
   - Impact: Determines if we can use acknowledgement wait vs fixed delay

2. **What is the minimum safe delay between slot selection and write?**
   - Answered by: Phase 2 timing tests
   - Impact: Determines write operation latency

3. **Does the device send any response to template change command?**
   - Answered by: Phase 1 MIDI capture
   - Impact: Determines acknowledgement wait feasibility

4. **Are there any side effects of programmatic slot switching?**
   - Answered by: Phase 2 real device testing
   - Impact: Determines user experience considerations

### Questions for Product/UX

1. **Is visible slot switching on device acceptable to users?**
   - Cannot be avoided with current firmware
   - Alternative: require manual slot selection (poor UX)

2. **Should we add progress indication for slot switching in xl3-web?**
   - Write now takes 2-3 seconds instead of 1-2 seconds
   - Users may wonder why operation is slower

3. **Should we batch multiple slot writes to minimize switching?**
   - Example: Queue all writes, group by slot, minimize switches
   - Trade-off: Complexity vs. performance

---

## Next Steps

### Immediate Actions (Phase 1)

**After workplan approval**:

1. ✅ Set up MIDI spy monitoring
   ```bash
   cd modules/coremidi/midi-snoop
   make run
   ```

2. ✅ Prepare web editor automation
   - Launch Playwright browser
   - Navigate to Components web editor
   - Connect to device

3. ✅ Execute Test A: Active slot write (baseline)
   - Capture message sequence
   - Verify no template change sent

4. ✅ Execute Test B: Cross-slot write (primary)
   - Capture complete message sequence
   - Look for 0x77 command
   - Document timing

5. ✅ Analyze captures
   - Identify slot selection protocol
   - Document acknowledgement format
   - Update hypothesis confidence

### Decision Points

**After Phase 1** (2-3 hours):
- **Go/No-Go**: Proceed to Phase 2 if hypothesis confirmed
- **Pivot**: If 0x77 not observed, re-evaluate alternative hypotheses

**After Phase 2** (3-5 hours):
- **Go/No-Go**: Proceed to implementation if validation succeeds
- **Escalate**: If tests fail, contact Novation support

**After Phase 4** (6-9 hours):
- **Deploy**: If all tests pass, prepare release
- **Iterate**: If issues found, refine implementation

---

## References

### Issue Tracking
- **GitHub Issue**: #36 - "Launch Control XL3: Device firmware rejects writes to inactive slots"
- **Related Issue**: oletizi/xl3-web#4
- **Current Branch**: `issues/36-slot-rejection`

### Code Locations
- **DeviceManager.ts**: Line 520 (selectTemplate), Line 591 (writeCustomMode)
- **SysExParser.ts**: Line 520 (buildTemplateChange), Line 674 (buildCustomModeWriteRequest)
- **PROTOCOL.md**: Line 60-89 (slot selection), Line 126-192 (write protocol)

### Test Fixtures
- **Backup Files**: `backup/slot-*.json` (existing device captures)
- **Test Utilities**: `utils/test-daw-port-monitor.ts`, `utils/test-fetch-custom-mode-node.ts`

### External Resources
- **Web Editor**: https://components.novationmusic.com/
- **Device Manual**: (not publicly available - protocol reverse-engineered)
- **CoreMIDI Spy**: `modules/coremidi/midi-snoop/`

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-12 | AI Diagnostic Team | Initial workplan creation |

---

## Approval

**Workplan Status**: Awaiting approval
**Created**: 2025-10-12
**Review Required**: Yes
**Estimated Effort**: 10-14 hours

**Ready to Proceed When**:
- [ ] Approach validated by architect-reviewer
- [ ] Timeline approved
- [ ] Resource allocation confirmed
- [ ] Physical device available for testing
- [ ] MIDI spy tool operational
