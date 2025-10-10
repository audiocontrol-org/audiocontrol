# BUG-001: Custom Mode Writes Always Target Slot 0

**Status**: Open
**Severity**: High
**Component**: @oletizi/launch-control-xl3 library
**Version**: 1.20.0
**Date Reported**: 2025-10-09
**Reporter**: Claude Code Analysis

## Summary
Custom mode write operations always write to slot 0 regardless of the slot parameter passed to `writeCustomMode()`. This makes it impossible to write custom modes to any slot other than the first slot.

## Environment
- **Library**: `@oletizi/launch-control-xl3` v1.20.0
- **Affected Code**: `src/core/SysExParser.ts` line 1000-1034
- **Build System**: Vite building from `src/` directory
- **Device**: Novation Launch Control XL3

## Expected Behavior
When calling `device.writeCustomMode(slot, mode)`:
- Slot 0 → mode appears in physical slot 1
- Slot 3 → mode appears in physical slot 4
- Slot 7 → mode appears in physical slot 8
- etc.

## Actual Behavior
When calling `device.writeCustomMode(slot, mode)` with ANY slot value:
- **All writes go to slot 0** (physical slot 1)
- User-selected slot is ignored
- Subsequent writes overwrite the same slot

## Root Cause Analysis

### The Bug
In `src/core/SysExParser.ts`, the `buildCustomModeWriteRequest()` method **hardcodes** the slot byte to `0x00`:

```typescript
// Line 1000-1034 in src/core/SysExParser.ts
static buildCustomModeWriteRequest(page: number, modeData: CustomModeMessage): number[] {
  // ... validation code ...

  return [
    0xF0,             // SysEx start
    0x00, 0x20, 0x29, // Manufacturer ID (Novation)
    0x02,             // Device ID (Launch Control XL 3)
    0x15,             // Command (Custom mode)
    0x05,             // Sub-command
    0x00,             // Reserved
    0x45,             // Write operation with data
    page,             // Page number (0 or 3 for write operations)
    0x00,             // ❌ BUG: Flag byte hardcoded to 0x00 - should be slot!
    ...encodedData,   // Encoded custom mode data
    0xF7              // SysEx end
  ];
}
```

**The hardcoded `0x00` at byte position 10 should be `modeData.slot`.**

### Evidence Chain

1. **UI Layer (Verified ✅)**: Editor.tsx correctly passes `activeSlotIndex` to device
   ```typescript
   // Line 218 in Editor.tsx
   await device.saveCustomMode(activeSlotIndex, lcxl3Mode);
   // Console logs confirm: activeSlotIndex = 3 (number type)
   ```

2. **Device Layer (Verified ✅)**: DeviceManager receives and validates slot
   ```typescript
   // Line 785 in DeviceManager.ts
   async writeCustomMode(slot: number, mode: CustomMode): Promise<void> {
     const modeData = { slot, name, controls, colors, labels };
     const validatedModeData = this.validateCustomModeData(modeData);
     // validatedModeData.slot = 3 ✅
   ```

3. **SysEx Layer (BUG ❌)**: buildCustomModeWriteRequest ignores `modeData.slot`
   ```typescript
   // Lines 856, 867 in DeviceManager.ts
   const page0Data = { ...validatedModeData, controls: page0Controls };
   const page0Message = SysExParser.buildCustomModeWriteRequest(0, page0Data);
   // page0Data.slot = 3 ✅
   // BUT buildCustomModeWriteRequest hardcodes 0x00 instead! ❌
   ```

### Protocol Comparison

**READ Request** (working correctly):
```
F0 00 20 29 02 15 05 00 40 [PAGE] [SLOT] F7
                                    ^^^^
```

**WRITE Request** (bug):
```
F0 00 20 29 02 15 05 00 45 [page] 0x00 [data] F7
                                   ^^^^
                                   Should be [slot]!
```

### Additional Evidence

There appears to be a **working implementation** in `package/src/core/SysExParser.ts`:

```typescript
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
    slot,             // ✅ CORRECT: Uses slot parameter directly!
    ...encodedData,
    0xF7              // SysEx end
  ];
}
```

**However, Vite builds from `src/` (vite.config.ts line 16), not `package/src/`, so the broken code gets published.**

## Reproduction Steps

1. Connect to Launch Control XL3 device
2. Open web editor at http://localhost:5173
3. Select slot 3 from the slot selector
4. Modify a mode
5. Click "Send to Device"
6. **Observe**: Mode appears in physical slot 1, not slot 4
7. Select slot 7, send again
8. **Observe**: Mode again appears in slot 1 (overwrites previous)

## Debugging Steps Taken

1. ✅ Verified UI passes correct `activeSlotIndex` (console logs show `activeSlotIndex: 3`)
2. ✅ Verified DeviceManager receives correct slot (modeData.slot = 3)
3. ✅ Verified slot is included in page0Data spread to buildCustomModeWriteRequest
4. ❌ **Found**: buildCustomModeWriteRequest hardcodes `0x00` instead of using `modeData.slot`

## Suggested Fix

### Option 1: Use modeData.slot (Minimal Change)

```typescript
// src/core/SysExParser.ts line 1000
static buildCustomModeWriteRequest(page: number, modeData: CustomModeMessage): number[] {
  if (page < 0 || page > 3) {
    throw new Error('Page must be 0-3');
  }

  // Validate the custom mode data
  this.validateCustomModeData(modeData);

  // ✅ FIX: Extract slot from modeData
  const slot = modeData.slot ?? 0;
  if (slot < 0 || slot > 14) {
    throw new Error('Custom mode slot must be 0-14 (slot 15 is reserved for immutable factory content)');
  }

  // Encode the custom mode data
  const encodedData = this.encodeCustomModeData(modeData);

  return [
    0xF0,             // SysEx start
    0x00, 0x20, 0x29, // Manufacturer ID (Novation)
    0x02,             // Device ID (Launch Control XL 3)
    0x15,             // Command (Custom mode)
    0x05,             // Sub-command
    0x00,             // Reserved
    0x45,             // Write operation with data
    page,             // Page number (0 or 3 for write operations)
    slot,             // ✅ FIX: Use slot from modeData instead of hardcoded 0x00
    ...encodedData,   // Encoded custom mode data
    0xF7              // SysEx end
  ];
}
```

### Option 2: Match package/src/ Implementation (Preferred)

Copy the working implementation from `package/src/core/SysExParser.ts` to `src/core/SysExParser.ts`, which takes `slot` as the first parameter:

```typescript
static buildCustomModeWriteRequest(slot: number, modeData: CustomModeMessage): number[] {
  if (slot < 0 || slot > 14) {
    throw new Error('Custom mode slot must be 0-14 (slot 15 is reserved for immutable factory content)');
  }

  // ... validation and encoding ...

  return [
    0xF0,             // SysEx start
    0x00, 0x20, 0x29, // Manufacturer ID (Novation)
    0x02,             // Device ID (Launch Control XL 3)
    0x15,             // Command (Custom mode)
    0x05,             // Sub-command
    0x00,             // Reserved
    0x45,             // Write operation
    slot,             // ✅ Slot parameter directly
    ...encodedData,
    0xF7              // SysEx end
  ];
}
```

Then update DeviceManager.ts calls:

```typescript
// Line 856
const page0Message = SysExParser.buildCustomModeWriteRequest(slot, page0Data);

// Line 867
const page3Message = SysExParser.buildCustomModeWriteRequest(slot, page3Data);
```

## Testing

After fixing, verify with:

```bash
# In library directory
cd /Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3

# Rebuild library
pnpm build

# Run integration test (requires JUCE MIDI server)
pnpm env:juce-server  # In one terminal
pnpm test:slot-copy   # In another terminal

# Expected output:
# ✅ Slot 0 successfully copied to slot 7
# ✅ Data integrity verified - all controls match!
```

Then in web app:

```bash
# In web app directory
cd /Users/orion/work/xl3-web

# Link local library (or wait for npm publish)
pnpm link ../ol_dsp/modules/audio-control/modules/launch-control-xl3

# Test manually:
# 1. Start dev server: pnpm dev
# 2. Select slot 3
# 3. Send mode
# 4. Verify it appears in physical slot 4
```

## Impact

- **Severity**: High - Core functionality broken
- **User Impact**: Users cannot use slots 1-14, limiting device to 1/15th capacity
- **Workaround**: None - feature is completely non-functional
- **Data Loss Risk**: Low - only overwrites slot 0, other slots remain intact

## Related Files

**Library** (`/Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3/`):
- `src/core/SysExParser.ts:1000-1034` - Contains the bug
- `src/device/DeviceManager.ts:856,867` - Calls the buggy method
- `package/src/core/SysExParser.ts` - Contains working implementation (NOT built)
- `vite.config.ts:16` - Build configuration (builds from `src/`)
- `utils/test-slot-copy.ts` - Integration test that should catch this

**Web App** (`/Users/orion/work/xl3-web/`):
- `src/pages/Editor.tsx:218` - Calls device.saveCustomMode
- `src/hooks/useLCXL3Device.ts` - Device hook
- `package.json:20` - Library dependency version

## Architecture Notes

The library has two source directories:
1. **`src/`** - Built by Vite and published to npm (contains bug)
2. **`package/src/`** - Older code with working implementation (NOT built)

This suggests:
- The bug was introduced when updating `src/` without porting the fix from `package/src/`
- OR `package/src/` contains a previous fix that was never merged to `src/`
- The two directories should be consolidated to prevent drift

## Resolution Plan

1. ✅ **Immediate**: Document bug (this file)
2. ⏳ **Next**: Fix `src/core/SysExParser.ts` (library team)
3. ⏳ **Then**: Rebuild and test library
4. ⏳ **Then**: Publish new version to npm
5. ⏳ **Finally**: Update web app dependency and verify

## Notes

- Bug discovered during investigation of slot selection feature
- Confirmed via debug logging that UI and DeviceManager layers work correctly
- Protocol comparison with READ requests confirms expected format
- Integration test `test-slot-copy.ts` exists but requires JUCE server to run

---

**Last Updated**: 2025-10-09
**Next Review**: After library fix is implemented
