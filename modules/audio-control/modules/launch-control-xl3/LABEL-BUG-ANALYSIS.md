# Label Bug Analysis: Why Unit Tests Missed It

**Date:** 2025-09-30
**Issue:** DeviceManager.writeCustomMode() not passing labels to SysEx builder
**Root Cause:** Test coverage gap - incomplete validation

---

## The Bug

### What Happened

**File:** `src/device/DeviceManager.ts:786-791`

```typescript
// BEFORE (buggy):
const modeData = {
  slot,
  name: mode.name,
  controls: mode.controls,
  colors: mode.colors,
  // labels: mode.labels,  ← MISSING!
};

// AFTER (fixed):
const modeData = {
  slot,
  name: mode.name,
  controls: mode.controls,
  colors: mode.colors,
  labels: mode.labels,  ← NOW INCLUDED
};
```

### The Label Pipeline

1. ✅ User creates controls with `name` property
2. ✅ `CustomModeManager.convertToDeviceFormat()` extracts labels → `labels` Map
3. ✅ `CustomModeManager.writeMode()` calls `DeviceManager.writeCustomMode()` with labels
4. ❌ **BUG**: `DeviceManager.writeCustomMode()` didn't pass labels to SysEx builder

---

## Why Tests Didn't Catch It

### Problem 1: Mocked DeviceManager

**Test:** `test/unit/CustomModeManager.test.ts:249-304`

```typescript
it('should write mode to device successfully', async () => {
  writeCustomModeSpy.mockResolvedValue(undefined);  // ← DeviceManager is mocked

  const testMode: CustomMode = {
    name: 'Save Test',
    controls: {
      SEND_A2: {
        type: 'knob',
        channel: 8,
        cc: 75,
        // NO 'name' property! ← Labels never created
      },
    },
  };

  await customModeManager.writeMode(7, testMode);

  expect(writeCustomModeSpy).toHaveBeenCalledWith(7, expect.objectContaining({
    slot: 7,
    name: 'Save Test',
    controls: expect.arrayContaining([...]),
    colors: expect.arrayContaining([...]),
    // NO 'labels' validation! ← Missing assertion
  }));
});
```

**Issues:**
1. ❌ Test controls have no `name` property → labels Map never created
2. ❌ Assertion uses `expect.objectContaining()` → only checks specified fields
3. ❌ No assertion for `labels` field → bug invisible to test

### Problem 2: Unit Test Isolation

**CustomModeManager tests mock DeviceManager** → Never test what DeviceManager actually does

```typescript
// In test setup:
mockDeviceManager = {
  readCustomMode: readCustomModeSpy,   // Mock
  writeCustomMode: writeCustomModeSpy, // Mock - doesn't run real code!
  on: vi.fn(),
};
```

**Result:** Tests verify CustomModeManager calls the mock, but **don't verify DeviceManager's behavior**.

### Problem 3: No Control Names in Test Data

**All test modes lack control names:**

```typescript
// Line 258-265: Test mode WITHOUT names
controls: {
  SEND_A2: {
    type: 'knob',
    channel: 8,
    cc: 75,
    min: 5,
    max: 120,
    behaviour: 'absolute',
    // NO 'name' field ← Never exercises label extraction
  },
}
```

**Grep confirms**: No tests include `ctrl.name` or `control.name`

```bash
$ grep "ctrl.name\|control.name" test/unit/CustomModeManager.test.ts
# No results
```

---

## Root Causes

### 1. Incomplete Test Assertions

**What was tested:**
```typescript
expect.objectContaining({
  slot: 7,
  name: 'Save Test',
  controls: [...],
  colors: [...],
})
```

**What should have been tested:**
```typescript
expect.objectContaining({
  slot: 7,
  name: 'Save Test',
  controls: [...],
  colors: [...],
  labels: expect.any(Map),  // ← MISSING
})
```

`expect.objectContaining()` only validates **presence** of specified fields, not **absence** of expected fields.

### 2. Test Data Doesn't Match Reality

**Real-world usage:**
- Controls have `name` properties for user-friendly labels
- Labels are extracted and sent to device

**Test data:**
- Controls have NO `name` properties
- Label code path never executed

### 3. Missing Integration Tests

**Unit tests in isolation:**
- CustomModeManager tests → mock DeviceManager
- DeviceManager tests → (none found for writeCustomMode label handling)

**Result:** Integration gap between components not caught.

---

## How It Should Have Been Caught

### Fix 1: Complete Test Assertions

```typescript
it('should write mode with labels to device', async () => {
  writeCustomModeSpy.mockResolvedValue(undefined);

  const testMode: CustomMode = {
    name: 'Label Test',
    controls: {
      SEND_A1: {
        type: 'knob',
        channel: 0,
        cc: 13,
        name: 'Volume',  // ← Include name
        behaviour: 'absolute',
      },
    },
  };

  await customModeManager.writeMode(0, testMode);

  const deviceMode = writeCustomModeSpy.mock.calls[0][1];

  // Verify labels are included
  expect(deviceMode.labels).toBeDefined();
  expect(deviceMode.labels).toBeInstanceOf(Map);
  expect(deviceMode.labels.get(0x10)).toBe('Volume');
});
```

### Fix 2: Test Real Label Extraction

```typescript
it('should extract labels from control names', async () => {
  writeCustomModeSpy.mockResolvedValue(undefined);

  const testMode: CustomMode = {
    name: 'Named Controls',
    controls: {
      SEND_A1: { type: 'knob', channel: 0, cc: 13, name: 'Reverb', behaviour: 'absolute' },
      SEND_A2: { type: 'knob', channel: 0, cc: 14, name: 'Delay', behaviour: 'absolute' },
      FADER1: { type: 'fader', channel: 0, cc: 77, name: 'Master', behaviour: 'absolute' },
    },
  };

  await customModeManager.writeMode(0, testMode);

  const deviceMode = writeCustomModeSpy.mock.calls[0][1];

  expect(deviceMode.labels.size).toBe(3);
  expect(deviceMode.labels.get(0x10)).toBe('Reverb');
  expect(deviceMode.labels.get(0x11)).toBe('Delay');
  expect(deviceMode.labels.get(0x28)).toBe('Master');
});
```

### Fix 3: Integration Test

```typescript
describe('DeviceManager Integration', () => {
  it('should pass labels through complete write pipeline', async () => {
    const realDeviceManager = new DeviceManager({ /* real config */ });
    const customModeManager = new CustomModeManager({
      deviceManager: realDeviceManager  // Real, not mocked
    });

    // Spy on SysEx builder
    const buildSpy = vi.spyOn(sysExParser, 'buildCustomModeWriteRequest');

    const modeWithLabels: CustomMode = {
      name: 'Test',
      controls: {
        SEND_A1: { type: 'knob', channel: 0, cc: 13, name: 'Volume' },
      },
    };

    await customModeManager.writeMode(0, modeWithLabels);

    // Verify SysEx builder received labels
    expect(buildSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: expect.any(Map),
      })
    );
  });
});
```

---

## Lessons Learned

### 1. Mock Isolation Hides Integration Bugs

**Problem:** Mocking DeviceManager means CustomModeManager tests never validate what DeviceManager does.

**Solution:** Add integration tests that use real (or partial real) implementations.

### 2. Partial Assertions Miss Omissions

**Problem:** `expect.objectContaining()` only checks **presence** of specified fields.

**Solution:** Add explicit assertions for all expected fields, especially newly added ones.

### 3. Test Data Must Match Reality

**Problem:** Test controls had no `name` properties, so label code never executed.

**Solution:** Test data should mirror real-world usage patterns.

### 4. Critical Paths Need Explicit Tests

**Problem:** Label extraction is a critical feature but had no dedicated test.

**Solution:** Add specific tests for new functionality like label handling.

---

## Prevention Strategy

### Required Test Checklist for New Features

When adding a feature (like labels):

- [ ] **Unit test** for feature logic (label extraction in CustomModeManager)
- [ ] **Unit test** for data passing (labels in convertToDeviceFormat)
- [ ] **Integration test** for end-to-end flow (labels reach SysEx builder)
- [ ] **Test data** includes feature (controls with `name` property)
- [ ] **Assertions** validate feature presence (labels Map exists and populated)
- [ ] **Negative test** for feature absence (controls without names)

### Code Review Checklist

- [ ] New fields added to data structures? → Assert presence in tests
- [ ] Mock used in tests? → Add integration test with real implementation
- [ ] Data transformation (convertToDeviceFormat)? → Test input and output
- [ ] Multi-step pipeline? → Test each step and end-to-end

---

## Recommended Fixes

### Immediate: Add Label Tests

**File:** `test/unit/CustomModeManager.test.ts`

Add after line 304:

```typescript
it('should extract and pass labels to device', async () => {
  writeCustomModeSpy.mockResolvedValue(undefined);

  const testMode: CustomMode = {
    name: 'Label Test',
    controls: {
      SEND_A1: {
        type: 'knob',
        channel: 0,
        cc: 13,
        name: 'Volume',
        behaviour: 'absolute',
      },
      FADER1: {
        type: 'fader',
        channel: 0,
        cc: 77,
        name: 'Master',
        behaviour: 'absolute',
      },
    },
    leds: new Map(),
    metadata: { createdAt: new Date(), modifiedAt: new Date() },
  };

  await customModeManager.writeMode(0, testMode);

  const deviceMode = writeCustomModeSpy.mock.calls[0][1];

  expect(deviceMode).toHaveProperty('labels');
  expect(deviceMode.labels).toBeInstanceOf(Map);
  expect(deviceMode.labels.size).toBe(2);
  expect(deviceMode.labels.get(0x10)).toBe('Volume');
  expect(deviceMode.labels.get(0x28)).toBe('Master');
});
```

### Long-term: Integration Tests

Create `test/integration/LabelPipeline.test.ts`:

```typescript
describe('Label Pipeline Integration', () => {
  it('should pass labels from CustomMode to SysEx', async () => {
    // Use real implementations, mock only MIDI I/O
    const mockMidiBackend = new MockMidiBackend();
    const deviceManager = new DeviceManager({ backend: mockMidiBackend });
    const customModeManager = new CustomModeManager({ deviceManager });

    const mode: CustomMode = {
      name: 'Test',
      controls: {
        SEND_A1: { type: 'knob', channel: 0, cc: 13, name: 'Reverb' },
      },
    };

    await customModeManager.writeMode(0, mode);

    // Verify SysEx message includes label data
    const sentMessages = mockMidiBackend.getSentMessages();
    expect(sentMessages.some(msg =>
      msg.includes('Reverb')
    )).toBe(true);
  });
});
```

---

## Summary

**Why tests missed it:**
1. DeviceManager was mocked → its behavior not tested
2. Test assertions incomplete → labels field not validated
3. Test data unrealistic → no control names to extract
4. No integration tests → pipeline gaps invisible

**The fix:**
- ✅ Added labels to modeData in DeviceManager.writeCustomMode()
- ⚠️ Still need tests for label handling

**Prevention:**
- Add explicit label tests
- Add integration tests for complete pipeline
- Use realistic test data with control names
- Assert presence of all expected fields
