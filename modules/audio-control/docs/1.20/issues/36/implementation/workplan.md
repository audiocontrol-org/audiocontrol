# Issue #36: Device Firmware Slot Rejection - Diagnostic Workplan

**Issue**: Launch Control XL3: Device firmware rejects writes to inactive slots (status 0x9)
**Status**: Investigation Phase
**Created**: 2025-10-12
**Branch**: `issues/36-slot-rejection`
**Severity**: High - Core functionality blocked

---

## Problem Statement

### Summary

The Novation Launch Control XL3 device firmware **rejects write operations to slots that are not currently active** on the physical device, returning status code `0x9` (device rejection). This prevents programmatic multi-slot management from working, blocking core functionality in the xl3-web application.

### Impact

**Functionality Blocked**:
- Users cannot copy modes between slots programmatically
- Multi-slot management from web UI is non-functional
- Limits device to effectively one user-programmable slot at a time
- Defeats purpose of 15-slot architecture for remote management

**Data Integrity**: Safe - Device rejects invalid operations cleanly (no corruption risk)

### Environment

- **Device**: Novation Launch Control XL3 (Serial: LX280935400469)
- **Firmware**: v1.0.10.84
- **Library**: @oletizi/launch-control-xl3 v1.20.2
- **Web App**: xl3-web v0.1.0
- **Related Issue**: oletizi/xl3-web#4

---

## Analysis & Evidence

### Code Review Findings

#### 1. Acknowledgement Handling (DeviceManager.ts)

**Location**: `src/device/DeviceManager.ts:70, 441-451`

```typescript
// Line 70: Acknowledgement tracking
private pendingAcknowledgements = new Map<number, {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

// Line 441-451: Acknowledgement handler
case 'write_acknowledgement':
  const ack = parsed as any;
  const pending = this.pendingAcknowledgements.get(ack.page);
  if (pending) {
    clearTimeout(pending.timeout);
    this.pendingAcknowledgements.delete(ack.page);
    if (ack.status === 0x06) {
      pending.resolve();  // Success
    } else {
      pending.reject(new Error(`Write failed for page ${ack.page}: status 0x${ack.status.toString(16)}`));
    }
  }
  break;
```

**Observations**:
- Handles write acknowledgements correctly
- Distinguishes between success (0x06) and rejection (0x09)
- **Missing**: No handling for slot selection acknowledgements
- Only tracks page-level operations, not slot-level state

#### 2. Template Selection Implementation (DeviceManager.ts)

**Location**: `src/device/DeviceManager.ts:520-535`

```typescript
/**
 * Select a template slot (0-15)
 */
async selectTemplate(slot: number): Promise<void> {
  if (slot < 0 || slot > 15) {
    throw new Error('Template slot must be 0-15');
  }

  // Send template change message
  const message = SysExParser.buildTemplateChange(slot);
  await this.sendSysEx(message);

  this.currentMode = {
    type: 'template',
    slot,
  };

  this.emit('device:modeChanged', this.currentMode);
}
```

**Observations**:
- **Template selection command EXISTS** (command 0x77)
- Format: `F0 00 20 29 02 11 77 [slot] F7`
- **CRITICAL**: Method exists but is **NEVER called before writes**
- Only called during device initialization (selectTemplate(0))
- No acknowledgement wait implemented

#### 3. Write Implementation (DeviceManager.ts)

**Location**: `src/device/DeviceManager.ts:591-606`

```typescript
/**
 * Write custom mode to device
 */
async writeCustomMode(slot: number, mode: CustomMode): Promise<void> {
  if (slot < 0 || slot > 15) {
    throw new Error('Custom mode slot must be 0-15');
  }

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
```

**Observations**:
- Goes **directly to write** without slot pre-selection
- Includes slot parameter in SysEx message (correct per protocol)
- **Missing**: No call to `selectTemplate(slot)` before write
- **Missing**: No acknowledgement wait for slot selection

#### 4. SysEx Parser (SysExParser.ts)

**Location**: `src/core/SysExParser.ts:520-533, 674-686`

```typescript
// Template change builder
static buildTemplateChange(templateNumber: number): number[] {
  if (templateNumber < 0 || templateNumber > 15) {
    throw new Error('Template number must be 0-15');
  }

  return [
    0xF0, // SysEx start
    ...MANUFACTURER_ID,
    0x11, // Device ID (Launch Control XL)
    SysExMessageType.TEMPLATE_CHANGE, // 0x77
    templateNumber,
    0xF7, // SysEx end
  ];
}

// Write request builder
static buildCustomModeWriteRequest(slot: number, modeData: CustomModeMessage): number[] {
  // ... validation ...

  return [
    0xF0,             // SysEx start
    0x00, 0x20, 0x29, // Manufacturer ID (Novation)
    0x02,             // Device ID (Launch Control XL 3)
    0x15,             // Command (Custom mode)
    0x05,             // Sub-command
    0x00,             // Reserved
    0x45,             // Write operation
    slot,             // Slot number (0-14)
    ...encodedData,   // Encoded custom mode data
    0xF7              // SysEx end
  ];
}
```

**Observations**:
- Both commands correctly implemented
- Template change uses device ID 0x11, command 0x77
- Write uses device ID 0x02, command 0x45
- **No parsing for template change acknowledgements**

#### 5. Protocol Documentation (PROTOCOL.md)

**Location**: `docs/PROTOCOL.md:60-89, 487-500`

**Current Documentation States**:
> "Slot Selection (via SysEx slot byte parameter)
> Simply include the target slot number (0-14) in the SysEx read request"

**Critical Gap**:
- Documentation assumes slot byte is sufficient
- **Does NOT mention template selection requirement**
- No reference to 0x77 command for writes
- Deprecated DAW port protocol (but template selection different)

### Issue Evidence from xl3-web

**Automated Test Results** (from issue description):

```javascript
[LOG] === SEND DIAGNOSTIC ===
[LOG] 1. activeSlotIndex: 3                              ✅ CORRECT
[LOG] 2. activeSlotIndex type: number                    ✅ CORRECT
[LOG] 3. mode.name: Cutoffj                             ✅ CORRECT
[LOG] 6. converted mode name: Cutoffj                    ✅ CORRECT
[LOG] 7. converted controls count: 48                    ✅ CORRECT

[ERROR] Send error: Error: Write failed for page 0: status 0x9
    at DeviceManager.handleSysExMessage
```

**Software Stack Verification**:
- ✅ Web App - Correctly passes slot parameter
- ✅ Library API - Device.saveCustomMode(slot, mode) receives correct slot
- ✅ SysEx Builder - buildCustomModeWriteRequest(slot, page, data) uses variable slot
- ✅ Message Transmission - SysEx message sent successfully to device
- ❌ Device Firmware - Rejects write with status 0x9

### Device Behavior Analysis

**Observed Pattern**:
- Writing to **currently active slot**: ✅ Success (status 0x06)
- Writing to **slot 0**: ✅ Success (default/fallback slot)
- Writing to **inactive slot**: ❌ Rejection (status 0x09)

**Hypothesis**:
The firmware only accepts writes to:
1. The currently active slot on the physical device, OR
2. Slot 0 (special default slot)

This explains why:
- BUG-001 (hardcoded slot 0) "worked" initially
- BUG-001 fix passed verification (only tested slot 0 writes)
- Cross-slot operations fail (device rejects inactive slot writes)

---

## Root Cause Hypothesis

### Primary Hypothesis: Missing Slot Pre-Selection

**Theory**: The device requires a **2-phase write protocol**:

```
Phase 1: Select Target Slot
  Command: F0 00 20 29 02 11 77 [slot] F7
  Purpose: Activate the target slot on device

Phase 2: Write to Selected Slot
  Command: F0 00 20 29 02 15 05 00 45 [page] [slot] [data] F7
  Purpose: Write mode data to now-active slot
```

**Current Implementation**: Only executes Phase 2

**Evidence Supporting This Hypothesis**:
1. Template selection command exists but unused before writes
2. Device accepts writes to "active" slot (whatever is currently selected)
3. Slot 0 works because it's default/always active
4. Web editor likely sends 0x77 before 0x45 (needs verification)

### Alternative Hypotheses (Lower Confidence)

**Hypothesis B: Timing Issue**
- Device needs time to process slot parameter
- Rapid write after slot change causes rejection
- **Likelihood**: Low - status 0x09 is explicit rejection, not timeout

**Hypothesis C: Firmware Bug**
- Device firmware incorrectly validates slot parameter
- SysEx slot byte should work but doesn't
- **Likelihood**: Low - too many users would report this

**Hypothesis D: Undocumented Protocol Requirement**
- Additional handshake step required
- Missing secret command or parameter
- **Likelihood**: Medium - but template selection is most obvious candidate

---

## Investigation Plan

### Phase 1: MIDI Traffic Capture (Priority: CRITICAL)

**Duration**: 2-3 hours
**Goal**: Capture how Novation's web editor handles cross-slot writes

**Tools**:
- CoreMIDI spy tool: `modules/coremidi/midi-snoop`
- Playwright browser automation for web editor control
- Existing utility: `utils/test-daw-port-monitor.ts`

**Procedure**:

1. **Setup MIDI Monitoring**:
   ```bash
   cd modules/coremidi/midi-snoop
   make run
   ```
   Monitor both:
   - LCXL3 1 MIDI In/Out (SysEx port)
   - LCXL3 1 DAW In/Out (control port)

2. **Test Sequence in Web Editor**:

   **Test A: Write to Active Slot** (baseline)
   - Select slot 1 on device
   - Modify mode in web editor
   - Click "Send to Device"
   - **Capture**: All MIDI messages
   - **Expected**: Success, no 0x77 command needed

   **Test B: Cross-Slot Write** (primary test)
   - Select slot 1 on device (physically)
   - In web editor, load slot 3
   - Modify mode
   - Click "Send to Device" (should target slot 3)
   - **Capture**: All MIDI messages
   - **Expected**: 0x77 command before 0x45 write

   **Test C: Sequential Slot Writes**
   - Write to slot 1
   - Immediately write to slot 2
   - Immediately write to slot 3
   - **Capture**: Message timing and sequencing

3. **Analysis Checklist**:
   - [ ] Identify 0x77 (template change) commands
   - [ ] Check timing between 0x77 and 0x45
   - [ ] Identify acknowledgement format for 0x77
   - [ ] Verify device sends response to 0x77
   - [ ] Document complete message sequence

**Deliverable**:
- MIDI capture log showing complete message sequence
- Timing analysis (ms between commands)
- Identification of acknowledgement format

**Success Criteria**:
- Confirm 0x77 sent before cross-slot writes
- Document acknowledgement format
- Understand timing requirements

---

### Phase 2: Template Selection Protocol Validation (Priority: HIGH)

**Duration**: 1-2 hours
**Goal**: Verify template selection command behavior with real device

**Test Utilities** (create if needed):
```typescript
// utils/test-slot-selection.ts
// Test programmatic slot selection

async function testSlotSelection() {
  const device = await connectDevice();

  // Test 1: Select slot 3
  await device.selectTemplate(3);
  await sleep(100); // Wait for device

  // Test 2: Write to slot 3 (should succeed)
  const testMode = createTestMode();
  await device.writeCustomMode(3, testMode);

  // Test 3: Write to slot 5 WITHOUT selection (should fail)
  try {
    await device.writeCustomMode(5, testMode);
    console.error('UNEXPECTED: Write succeeded without slot selection');
  } catch (error) {
    console.log('EXPECTED: Write failed with status 0x9');
  }
}
```

**Test Sequence**:

1. **Baseline Test**: Write to active slot
   - Physically select slot 1
   - Write to slot 1 programmatically
   - **Expected**: Success (status 0x06)

2. **Slot Selection Test**: Template change then write
   - Physically on slot 1
   - Send: `F0 00 20 29 02 11 77 03 F7` (select slot 3)
   - Wait for device response/acknowledgement
   - Write to slot 3
   - **Expected**: Success (status 0x06)

3. **No Selection Test**: Direct write to inactive slot
   - Physically on slot 1
   - Write directly to slot 3 (no 0x77 first)
   - **Expected**: Failure (status 0x09)

4. **Timing Test**: Various delays between selection and write
   - Try delays: 0ms, 50ms, 100ms, 200ms, 500ms
   - Identify minimum safe delay

**Deliverable**:
- Empirical confirmation that 0x77 enables writes
- Documented acknowledgement format for template changes
- Minimum timing requirement

**Success Criteria**:
- Phase 2 test succeeds (0x77 + write = success)
- Phase 3 test fails (no 0x77 + write = 0x09)
- Timing requirement identified

---

### Phase 3: Acknowledgement Protocol Analysis (Priority: MEDIUM)

**Duration**: 1 hour
**Goal**: Understand device response to template selection

**Current Knowledge**:
- Write acknowledgements: `F0 00 20 29 02 15 05 00 15 [page] [status] F7`
- Template changes may have different format
- Web editor waits ~24-27ms for write ACKs

**Investigation**:

1. **Identify Template Change Response Format**:
   - Send: `F0 00 20 29 02 11 77 03 F7`
   - Capture: Device response message
   - Parse: Identify status/confirmation bytes

2. **Compare with Template Change SysEx** (line 387-394 in DeviceManager.ts):
   ```typescript
   case 'template_change':
     const templateChange = this.validateTemplateChangeResponse(parsed);
     this.currentMode = { type: 'template', slot: templateChange.templateNumber };
     this.emit('device:modeChanged', this.currentMode);
     break;
   ```
   - Check if device sends template_change response
   - May be receiving it but not waiting for it

3. **Timing Analysis**:
   - Measure response time from 0x77 send to ACK receive
   - Compare with write ACK timing (24-27ms)
   - Determine if explicit wait needed or event-based

**Deliverable**:
- Template change acknowledgement specification
- Parser implementation for template change ACK
- Timing requirements documented

**Success Criteria**:
- Can parse template change responses
- Know when to proceed with write
- Have timeout values for error handling

---

## Implementation Plan

### Phase 4: Slot Selection Wrapper Implementation (Priority: HIGH)

**Duration**: 2-3 hours
**Goal**: Add programmatic slot selection before writes

**Approach**: Modify existing write flow to include slot pre-selection

#### Changes Required

**File**: `src/device/DeviceManager.ts`

**Location**: `writeCustomMode()` method (line 591)

**Implementation**:

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
