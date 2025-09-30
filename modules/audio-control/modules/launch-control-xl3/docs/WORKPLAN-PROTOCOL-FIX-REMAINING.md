# Workplan: Remaining Protocol Fixes Required

## Executive Summary

**UPDATE (2025-09-29)**: Critical fixes have been implemented. The library now sends the full control structure (1500+
bytes instead of 30 bytes). All 48 controls are being sent with correct structure. Some slots still timeout on read-back
which may be a device-specific issue.

## Implementation Status

✅ **FIXED**: Control field name mismatch - now accepts both 'id' and 'controlId'
✅ **FIXED**: Removed incorrect 0x28 offset from all control IDs
✅ **FIXED**: Control type mapping based on position
✅ **FIXED**: Control structure now matches web editor format
✅ **VERIFIED**: Write messages are now 1500+ bytes with all 48 controls

## Critical Issues Found (2025-09-29)

### 🚨 Issue 1: Control Data Not Being Sent

**Problem**: The library sends ONLY the name (about 30 bytes), not the full control structure (should be ~800 bytes)

**Root Cause**: Control filtering bug in `SysExParser.encodeCustomModeData()`:

```typescript
// This filters out ALL controls because they have 'id' not 'controlId'!
const sortedControls = Object.values(modeData.controls)
  .filter(control => control.controlId !== undefined)  // <-- BUG: Wrong field name
```

**Evidence**:

- Test sends: `0xf0...0x45 0x01 0x01 0x20 0x10 0x2a [NAME] 0xf7` (only ~30 bytes)
- Should send: Full 342-800 byte message with all control definitions

**Fix Required**:

1. Change filter to use correct field name (`id` or make consistent)
2. OR add `controlId` mapping when converting from test format

---

### 🚨 Issue 2: Control ID Offset Bug

**Problem**: Code adds incorrect 0x28 offset to control IDs

**Location**: `SysExParser.encodeCustomModeData()` line ~587:

```typescript
rawData.push((control.controlId ?? 0) + 0x28); // WRONG! Should not add offset
```

**Fix Required**: Remove the `+ 0x28` offset. Control IDs should be used directly.

---

### 🚨 Issue 3: Control Type Mapping Still Incorrect

**Problem**: Control types are being mapped incorrectly from string to number

**Current Code**:

```typescript
const controlTypeNum = typeof controlType === 'string' ?
  (controlType === 'knob' ? 0x05 : controlType === 'fader' ? 0x00 : controlType === 'button' ? 0x09 : 0x00) :
  controlType;
```

**Should Be** (based on web editor capture):

- Encoders row 1 (0-7): type 0x05
- Encoders row 2 (8-15): type 0x09
- Encoders row 3 (16-23): type 0x0D
- Faders: type 0x00
- Buttons row 1: type 0x19
- Buttons row 2: type 0x25

---

### 🚨 Issue 4: Missing Control Structure Fields

**Problem**: Control structure incomplete - missing required fields

**Web Editor Format** (per control):

```
49 [ID] 02 [TYPE] 00 01 40 00 [CC] 7F 00
```

**Current Implementation**: Missing several fixed bytes and using wrong structure

---

## Implementation Tasks

### Task 1: Fix Control Field Name Mismatch (CRITICAL)

**File**: `src/core/SysExParser.ts`

**Change**:

```typescript
// FROM:
const sortedControls = Object.values(modeData.controls)
  .filter(control => control.controlId !== undefined)

// TO:
const sortedControls = Object.values(modeData.controls)
  .filter(control => control.id !== undefined || control.controlId !== undefined)
  .map(control => ({
    ...control,
    controlId: control.controlId ?? control.id ?? 0
  }))
```

### Task 2: Remove Control ID Offset (CRITICAL)

**File**: `src/core/SysExParser.ts`

**Change**:

```typescript
// FROM:
rawData.push((control.controlId ?? 0) + 0x28);

// TO:
rawData.push(control.controlId ?? 0);
```

### Task 3: Fix Control Type Assignment (HIGH)

**File**: `src/core/SysExParser.ts`

**Replace entire type mapping with**:

```typescript
private static
getControlType(control
:
any
):
number
{
  const index = control.index ?? 0;
  const type = control.type ?? control.controlType;

  if (type === 'encoder' || type === 'knob') {
    if (index < 8) return 0x05;      // Top row
    if (index < 16) return 0x09;     // Middle row
    return 0x0D;                      // Bottom row
  }
  if (type === 'fader') return 0x00;
  if (type === 'button') {
    if (index < 8) return 0x19;      // First row
    return 0x25;                      // Second row
  }
  return 0x00;
}
```

### Task 4: Complete Control Definition Structure (HIGH)

**File**: `src/core/SysExParser.ts`

**Update control encoding to match web editor**:

```typescript
// For each control, write exactly 11 bytes:
rawData.push(0x49);                          // Control marker
rawData.push(this.getControlId(control));    // Control ID (0x10-0x3F)
rawData.push(0x02);                          // Always 0x02
rawData.push(this.getControlType(control));  // Type based on position
rawData.push(0x00);                          // Always 0x00
rawData.push(0x01);                          // Always 0x01
rawData.push(0x40);                          // Always 0x40 (was 0x48)
rawData.push(0x00);                          // Always 0x00
rawData.push(control.cc ?? 0);               // CC number
rawData.push(0x7F);                          // Max value
rawData.push(0x00);                          // Reserved
```

### Task 5: Add Control Labels and Colors (MEDIUM)

**Add after control definitions**:

```typescript
// Add control labels (0x69 markers)
for (const control of sortedControls) {
  if (control.name) {
    rawData.push(0x69);
    rawData.push(this.getControlId(control));
    rawData.push(...Array.from(control.name).map(c => c.charCodeAt(0)));
  }
}

// Add LED colors (0x60 markers)
for (const control of sortedControls) {
  rawData.push(0x60);
  rawData.push(this.getControlId(control));
  rawData.push(control.color ?? 0x0C);  // Default to red
}
```

### Task 6: Fix Control ID Mapping (HIGH)

**Implement proper control ID assignment**:

```typescript
private static
getControlId(control
:
any
):
number
{
  const type = control.type ?? control.controlType;
  const index = control.index ?? 0;

  if (type === 'encoder' || type === 'knob') {
    // Encoders: 0x10-0x27 (24 total)
    return 0x10 + index;
  } else if (type === 'fader') {
    // Faders: 0x28-0x2F (8 total)
    return 0x28 + index;
  } else if (type === 'button') {
    // Buttons: 0x30-0x3F (16 total)
    return 0x30 + index;
  }

  return 0x10; // Default to first encoder
}
```

## Verification Tests

### Test 1: Message Length Verification

- After fixes, write message should be 300+ bytes minimum
- Should contain 48 control definitions (11 bytes each)

### Test 2: Control Data Presence

- Hex dump should show 0x49 markers for each control
- Should see incrementing control IDs from 0x10 to 0x3F

### Test 3: Round-Trip Success

- Slot 1 should no longer timeout
- Read-back data should contain control names and CC values

## Success Criteria

- [ ] Write messages are 300+ bytes (not 30)
- [ ] All 48 controls are included in write
- [ ] Control IDs use correct range (0x10-0x3F)
- [ ] Control types match position-based assignment
- [ ] Round-trip test passes for slot 1
- [ ] Control names preserved in round-trip
- [ ] CC values preserved in round-trip

## Priority Order

1. **Fix control field name** (Task 1) - Without this, NO controls are sent
2. **Remove ID offset** (Task 2) - IDs are completely wrong with offset
3. **Fix control structure** (Task 4) - Required for device to parse
4. **Fix type mapping** (Task 3) - Required for proper control behavior
5. **Fix ID mapping** (Task 6) - Required for correct control assignment
6. **Add labels/colors** (Task 5) - Nice to have but not critical

## Timeline

- Tasks 1-2: 15 minutes (critical field fixes)
- Tasks 3-4: 30 minutes (structure fixes)
- Tasks 5-6: 30 minutes (complete implementation)
- Testing: 30 minutes
- Total: ~2 hours

## Note on Previous Implementation Claims

The previous implementation by the agents focused on creating NEW files (enhanced parsers, timing optimizations) but did
NOT fix the core issues in the existing code paths that are actually being used by the tests. This workplan addresses
the ACTUAL bugs in the ACTUAL code path.