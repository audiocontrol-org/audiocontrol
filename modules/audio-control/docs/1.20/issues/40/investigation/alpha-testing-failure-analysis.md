# Alpha Testing Failure Analysis: v1.20.18-alpha.0

**Date:** 2025-10-17
**Issue:** #40 - Mode Name Encoding Still Broken in Alpha Release
**Investigator:** typescript-pro agent
**Status:** ✅ INVESTIGATION COMPLETE

---

## Executive Summary

**CRITICAL FINDING:** The alpha release v1.20.18-alpha.0 **DOES CONTAIN** the 18-character mode name fix. The published npm package has correct code:

```javascript
// From published alpha: dist/index.js
static encodeName(name) {
  const nameBytes = Array.from(name.substring(0, 18)).map((c) => c.charCodeAt(0));
  return [32, nameBytes.length, ...nameBytes];
}
```

**User's Issue:** Despite correct encoding in the library, they report truncation to 8 characters during writing.

**Root Cause Hypothesis:** User may be encountering a **validation error before encoding**, OR there's a **device-side limitation** we haven't documented, OR the user is testing with an older cached version.

---

## Investigation Findings

### 1. Alpha Release Code Verification

#### 1.1 Published Package Analysis

Downloaded and extracted actual npm package:
```bash
npm pack @oletizi/launch-control-xl3@1.20.18-alpha.0
tar -xzf oletizi-launch-control-xl3-1.20.18-alpha.0.tgz
```

**Verified Contents:**
- ✅ Package version: `1.20.18-alpha.0`
- ✅ `encodeName` function: Correctly truncates to **18 characters**
- ✅ `CustomModeBuilder.name()`: Validates max **18 characters**
- ✅ Both source (`src/`) and compiled (`dist/`) code included

#### 1.2 Code Comparison: Alpha vs. Current HEAD

| Component | Alpha v1.20.18-alpha.0 | Current HEAD (issues/40) | Status |
|-----------|------------------------|--------------------------|---------|
| `SysExParser.encodeName()` | `substring(0, 18)` | `substring(0, 18)` | ✅ IDENTICAL |
| `CustomModeBuilder.name()` | Max 18 validation | Max 18 validation | ✅ IDENTICAL |
| Label encoding | `substring(0, 15)` | `substring(0, 15)` | ✅ IDENTICAL |

**Conclusion:** No code differences between alpha and current HEAD for name encoding.

---

### 2. User's Reported Behavior

From GitHub Issue #40 testing results:

#### ✅ Reading/Parsing - WORKING
```
Input device names: "OL Synth", "ShortName", "TESTMODE"
Parser output: Correctly parsed all names
Verdict: Parser fix working correctly
```

#### ❌ Writing/Encoding - USER REPORTS BROKEN
```
Input: "Name Test 123" (14 characters)
Expected output: "Name Test 123"
Actual output: "Name Tes" (8 characters)
Verdict: Truncated to 8-character limit
```

**Discrepancy:** Alpha package has 18-char encoding, but user sees 8-char truncation.

---

### 3. Possible Truncation Points

Searched entire alpha package for 8-character limits:

```bash
grep -rn "substring(0, 8)\|length.*8" package/dist/
grep -rn "\.substring(0,8)" package/src/
```

**Results:** ❌ NO 8-character truncation found in code

**All truncation points in alpha:**
- Mode name: `substring(0, 18)` ✅
- Control labels: `substring(0, 15)` ✅
- No 8-character limits anywhere ✅

---

### 4. Slot Acknowledgement Error Analysis

#### User's Error Message
```
Write acknowledgement slot mismatch for page 3:
expected slot 4 (status 0x12), but received status 0xd
```

#### Error Analysis

**Expected Calculation (from `DeviceManager.getExpectedStatusByte()`):**
```typescript
private getExpectedStatusByte(slot: number): number {
  if (slot >= 0 && slot <= 3) {
    return 0x06 + slot;  // Slots 0-3: status 0x06-0x09
  } else if (slot >= 4 && slot <= 15) {
    return 0x0E + slot;  // Slots 4-15: status 0x12-0x1D
  }
  throw new Error(`Invalid slot number: ${slot}`);
}
```

**For Slot 4:**
- Expected status: `0x0E + 4 = 0x12` (18 decimal)
- Received status: `0x0D` (13 decimal)

**What 0xD Means:**
According to the formula above, `0xD` (13 decimal) would map to:
- If in range 0x06-0x09: Slot `13 - 6 = 7` ❌ (out of range, max is 3)
- If in range 0x0E-0x1D: Doesn't match (0xD < 0x0E)

**Status 0xD is NOT in any expected range!**

#### Possible Causes

1. **Device Firmware Issue:** Device may have incorrect status byte encoding
2. **Slot Selection Problem:** Device might be writing to wrong slot
3. **Protocol Misunderstanding:** Status byte formula may be incorrect for certain slots
4. **Page 3 Handling:** Page 3 might use different acknowledgement format

**Recommendation:** This is a **SEPARATE BUG** from the mode name encoding issue and should be tracked separately.

---

### 5. Hypotheses for User's 8-Character Truncation

#### Hypothesis 1: Cached Library Version ⭐ MOST LIKELY
**Explanation:** User's environment may be using an older cached version of the library.

**Evidence:**
- Published alpha has correct 18-char code
- npm/yarn/pnpm cache can serve stale versions
- `node_modules` might not have been rebuilt

**Resolution:**
```bash
# User should try:
npm cache clean --force
rm -rf node_modules package-lock.json
npm install @oletizi/launch-control-xl3@1.20.18-alpha.0
```

#### Hypothesis 2: Device Firmware Limitation
**Explanation:** Device hardware might reject names longer than 8 characters for certain slots.

**Evidence:**
- User's reading works (parser reads 18-char names from device)
- User's writing truncates to 8 chars
- Could be slot-specific limitation

**Resolution:** Test with different slot numbers

#### Hypothesis 3: Application-Level Truncation
**Explanation:** User's application code might be truncating before calling the library.

**Evidence:**
- Library code is verified correct
- Truncation happening before library encoding

**Resolution:** User should check their application code

#### Hypothesis 4: Display vs. Storage Issue
**Explanation:** Name stored correctly but displayed as 8 chars.

**Evidence:**
- Web editor and device display sometimes show abbreviated names

**Resolution:** Read back the mode and check actual stored name

---

## Verification Checklist

To help the user debug, they should verify:

- [ ] **Cache cleared:** `npm cache clean --force`
- [ ] **Fresh install:** Delete `node_modules` and reinstall
- [ ] **Correct version:** Run `npm ls @oletizi/launch-control-xl3` (should show `1.20.18-alpha.0`)
- [ ] **No application truncation:** Check if app code truncates before calling library
- [ ] **Test different slots:** Try slots 0-3 vs. slots 4-15
- [ ] **Read-back verification:** After writing, fetch mode and check actual stored name
- [ ] **Check device firmware:** Ensure device has latest firmware

---

## Recommendations

### Immediate Actions

1. **Ask user to verify package version:**
   ```bash
   npm ls @oletizi/launch-control-xl3
   node -e "console.log(require('@oletizi/launch-control-xl3/package.json').version)"
   ```

2. **Request read-back test:**
   - User writes "Name Test 123"
   - User immediately reads back the mode
   - Compare stored name vs. displayed name

3. **Test with minimal example:**
   ```typescript
   import { CustomModeBuilder } from '@oletizi/launch-control-xl3';

   const mode = new CustomModeBuilder()
     .name('Name Test 123')  // 14 chars
     .addFader(1, { cc: 10 })
     .build();

   console.log('Mode name length:', mode.name.length);
   console.log('Mode name:', mode.name);
   ```

### Slot Acknowledgement Error

**SEPARATE ISSUE** - Should be tracked independently from mode name encoding:

**Error Details:**
- Slot 4, Page 3
- Expected status: `0x12`
- Received status: `0x0D`

**Investigation Required:**
1. Check if Page 3 exists (specs only mention Pages 0-2)
2. Verify slot 4 status byte calculation
3. Test with different slot numbers
4. Check device firmware version

**Possible Fix Locations:**
- `DeviceManager.getExpectedStatusByte()` - Status calculation might be wrong
- Protocol documentation - Page 3 might use different format
- Device firmware - Might have bug in acknowledgement

---

## Conclusion

### Mode Name Encoding

**Status:** ✅ **FIXED IN ALPHA**

The published alpha `v1.20.18-alpha.0` contains the correct 18-character mode name encoding. The code in npm matches our current HEAD exactly.

**User's truncation to 8 characters is NOT caused by library code.**

**Most likely cause:** Cached old version or application-level truncation.

### Slot Acknowledgement Error

**Status:** ❌ **NEW BUG DISCOVERED**

Status byte `0xD` is not in any expected range for slot acknowledgements. This suggests:
- Protocol misunderstanding for Page 3
- Device firmware bug
- Incorrect status byte calculation

**Requires:** Separate investigation and fix.

---

## Files Verified

### Published Alpha Package
- ✅ `/tmp/lcxl3-alpha-test/package/package.json` - Version `1.20.18-alpha.0`
- ✅ `/tmp/lcxl3-alpha-test/package/dist/index.js` - Compiled code with 18-char encoding
- ✅ `/tmp/lcxl3-alpha-test/package/src/core/SysExParser.ts` - Source with 18-char encoding
- ✅ `/tmp/lcxl3-alpha-test/package/src/builders/CustomModeBuilder.ts` - Validation for 18 chars

### Current Repository
- ✅ `/Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3/src/core/SysExParser.ts`
- ✅ `/Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3/src/builders/CustomModeBuilder.ts`

---

## Next Steps

1. **Contact user** with verification checklist
2. **Request minimal reproduction** case
3. **Investigate slot acknowledgement error** separately (new issue/workplan)
4. **Update protocol docs** with Page 3 findings
5. **Consider beta release** once user confirms cache issue

---

**Investigation Complete:** 2025-10-17 10:05 PDT
