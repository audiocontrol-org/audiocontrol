# Workplan: Fix SysEx Protocol Implementation

## Executive Summary

Analysis of the captured MIDI conversation between the Novation web editor and Launch Control XL3 reveals critical
differences in our library's SysEx implementation. While we use the correct command bytes (0x45 for write, 0x40 for
read), the data encoding format differs significantly from the web editor's implementation.

## Current Status

### What's Working

- ✅ Command byte 0x45 for writes is correct
- ✅ Command byte 0x40 for reads is correct
- ✅ Basic SysEx structure is correct
- ✅ Device handshake and connection work
- ✅ Device acknowledges our write commands

### What's Broken

- ❌ Written data cannot be read back correctly
- ❌ Slot 0 returns corrupted data
- ❌ Other slots timeout on read after write
- ❌ Data encoding format doesn't match web editor

## Detailed Protocol Differences

### 1. Name Encoding Structure

#### Web Editor (Known Good)

```
0x01 0x20 0x10 0x2A "New Custom Mode"
```

- Prefix: `0x01 0x20`
- Length/Type: `0x10 0x2A`
- Followed by ASCII text

#### Our Library (Current)

```
0x00 0x20 0x08 "ROUND_TRIP_TEST"
```

- Prefix: `0x00 0x20`
- Length: `0x08`
- Different structure

### 2. Control ID Mapping

#### Web Editor Control IDs

```
Encoders 1-8:   0x10-0x17  (top row)
Encoders 9-16:  0x18-0x1F  (middle row)
Encoders 17-24: 0x20-0x27  (bottom row)
Faders 1-8:     0x28-0x2F
Buttons 1-8:    0x30-0x37  (first row)
Buttons 9-16:   0x38-0x3F  (second row)
```

#### Our Library Control IDs

```
Faders 1-8:     0x28-0x2F  (matches!)
Encoders 1-8:   0x38-0x3F  (wrong - these are buttons in web editor)
Encoders 9-16:  0x40-0x47  (wrong)
Encoders 17-24: 0x48-0x4F  (wrong)
Buttons 1-16:   0x50-0x5F  (wrong)
```

### 3. Control Type Bytes

The web editor uses different type bytes depending on the slot:

#### Slot 0 (First write)

```
Encoders top:    0x05
Encoders middle: 0x09
Encoders bottom: 0x0D
Buttons:         0x19
```

#### Slot 3 (Second write)

```
Faders:          0x00
Buttons row 1:   0x19
Buttons row 2:   0x25
```

### 4. CC Number Assignments

#### Web Editor

```
Encoders start at CC 13 (0x0D)
Faders start at CC 5 (0x05)
Buttons start at CC 37 (0x25)
```

#### Our Library

```
Different CC numbering scheme
Starting from CC 0 for some controls
```

### 5. Data Field Differences

#### Web Editor Control Definition

```
49 [ID] 02 [TYPE] 00 01 40 00 [CC] 7F 00
        ^^        ^^^^^^^
     Always 02   Always 00 01 40
```

#### Our Library

```
49 [ID] 02 [TYPE] 00 01 40 00 [CC] 7F 00
```

Structure matches but IDs and types are wrong.

## Root Cause Analysis

The primary issue is that our library uses:

1. **Wrong control ID assignments** - We're mixing up encoder/button IDs
2. **Incorrect name encoding prefix** - Using 0x00 instead of 0x01
3. **Wrong control type mapping** - Not matching web editor's type system

## Implementation Plan

### Phase 1: Fix Control ID Mapping (Priority: HIGH)

**File:** `src/core/SysExParser.ts`

1. Update `getControlId()` method to use correct ID mapping:
   ```typescript
   // Correct mapping based on web editor
   const controlIdMap = {
     // Top row encoders (1-8)
     encoder_0_7:   0x10-0x17,
     // Middle row encoders (9-16)
     encoder_8_15:  0x18-0x1F,
     // Bottom row encoders (17-24)
     encoder_16_23: 0x20-0x27,
     // Faders (1-8)
     fader_0_7:     0x28-0x2F,
     // Buttons row 1 (1-8)
     button_0_7:    0x30-0x37,
     // Buttons row 2 (9-16)
     button_8_15:   0x38-0x3F
   };
   ```

2. Fix control ordering to match hardware layout

### Phase 2: Fix Name Encoding (Priority: HIGH)

**File:** `src/core/SysExParser.ts`

1. Update `encodeName()` method:
   ```typescript
   private encodeName(name: string): number[] {
     const nameBytes = Array.from(name).map(c => c.charCodeAt(0));
     return [
       0x01, 0x20,  // Correct prefix (was 0x00 0x20)
       0x10, 0x2A,  // Length/type identifier
       ...nameBytes
     ];
   }
   ```

### Phase 3: Fix Control Type Mapping (Priority: HIGH)

**File:** `src/core/SysExParser.ts`

1. Update control type assignment based on slot and position:
   ```typescript
   private getControlType(control: Control, slot: number): number {
     if (control.type === 'encoder') {
       if (control.index < 8) return 0x05;      // Top row
       if (control.index < 16) return 0x09;     // Middle row
       return 0x0D;                              // Bottom row
     }
     if (control.type === 'fader') return 0x00;
     if (control.type === 'button') {
       if (control.index < 8) return 0x19;      // First row
       return 0x25;                              // Second row
     }
   }
   ```

### Phase 4: Fix CC Number Defaults (Priority: MEDIUM)

**File:** `src/types.ts` and default configurations

1. Update default CC assignments to match web editor:
    - Encoders: Start at CC 13
    - Faders: Start at CC 5
    - Buttons: Start at CC 37

### Phase 5: Implement Dual-Slot Writing (Priority: LOW)

The web editor writes the same custom mode to multiple slots (0 and 3 in our capture). Consider if this is necessary for
proper operation.

## Testing Strategy

### Test 1: Exact Replication Test

1. Create a custom mode with exact same data as web editor
2. Write using our fixed implementation
3. Verify device acknowledgment matches (0x15 response)
4. Read back and verify data integrity

### Test 2: Round-Trip Verification

1. Write custom data to each slot
2. Read back immediately
3. Compare written vs read data
4. All 15 slots should work

### Test 3: Web Editor Compatibility

1. Write custom mode with our library
2. Open web editor and verify it can read our data
3. Modify in web editor
4. Read back with our library

## Success Criteria

- [ ] Round-trip write/read works for all slots
- [ ] No data corruption on slot 0
- [ ] No timeouts on read operations
- [ ] Web editor can read modes written by our library
- [ ] Our library can read modes written by web editor

## Implementation Order

1. **Immediate fixes** (can test quickly):
    - Fix control ID mapping
    - Fix name encoding prefix
    - Fix control type bytes

2. **Test and verify**:
    - Run round-trip test
    - Check for improvements

3. **Secondary fixes** (if needed):
    - Adjust CC defaults
    - Implement dual-slot writing

## Files to Modify

1. **src/core/SysExParser.ts**
    - `getControlId()` - Fix ID mapping
    - `encodeName()` - Fix name prefix
    - `encodeControl()` - Fix type bytes

2. **src/types.ts**
    - Update default CC assignments

3. **tests/SysExParser.test.ts**
    - Add tests for new encoding format
    - Verify against captured web editor data

## Risk Assessment

- **Low Risk**: These are data formatting changes only
- **No Protocol Changes**: Command bytes remain the same
- **Backward Compatibility**: May break existing custom modes (acceptable as they're already broken)

## Timeline

- Phase 1-3: 1 hour (critical fixes)
- Phase 4: 30 minutes (defaults)
- Testing: 1 hour
- Total: ~2.5 hours

## Appendix: Captured Reference Data

### Known Good Write (Web Editor to Slot 0)

```
F0 00 20 29 02 15 05 00 45 00 01 20 10 2A 4E 65
77 20 43 75 73 74 6F 6D 20 4D 6F 64 65 49 10 02
05 00 01 40 00 0D 7F 00 49 11 02 05 00 01 40 00
...
```

### Our Current Write (Needs Fixing)

```
F0 00 20 29 02 15 05 00 45 00 00 20 08 52 4F 55
4E 44 5F 54 52 49 28 02 00 00 01 40 00 00 7F 00
49 29 02 00 00 01 40 00 01 7F 00 49 2A 02 00 00
...
```

## Next Steps

2. Implement Phase 1-3 fixes
3. Test with device
4. Document results
5. Proceed with remaining phases if needed