# Implementation Workplan: Issue #40 - Mode Name Truncation Bug Fix

**Issue:** #40
**Branch:** `fix/mode-name-18-chars`
**Date Created:** 2025-10-17
**Status:** Ready for Implementation
**Priority:** HIGH

---

## Problem Statement

### Current Behavior
The Launch Control XL3 library suffers from a critical mode name truncation bug that affects all users attempting to use custom mode names:

- **"TESTMOD" (7 chars)** → Truncated to **"M" (1 char)**
- **"17CharacterMode1" (16 chars)** → Truncated to **"Mode1" (5 chars)**
- **"EXACTLY18CHARSLONG" (18 chars)** → Truncated to **"C" (1 char)**
- **"18CharModeName123" (18 chars)** → Truncated to **"C" (1 char)**
- **"ShortName" (9 chars)** → Truncated to **"M" (1 char)**

### Expected Behavior
Mode names up to 18 characters should persist correctly when written to the device and read back unchanged.

### Impact
- **User Experience:** Users cannot reliably set custom mode names
- **Data Loss:** Custom mode names are corrupted during write/read cycles
- **Workaround:** None - bug affects all name lengths

---

## Analysis Summary

### Investigation Completed
Comprehensive investigation documented at:
- **Main findings:** `docs/1.20/issues/40/investigation/COMPREHENSIVE-FINDINGS.md`
- **MIDI analysis:** `docs/1.20/issues/40/investigation/analysis/midi-capture-analysis.md`
- **Code analysis:** `docs/1.20/issues/40/investigation/analysis/web-editor-analysis.md`

### Root Cause: TWO BUGS Identified

#### Bug 1: Parser Pattern Mismatch (CRITICAL)
**Location:** `modules/launch-control-xl3/src/core/SysExParser.ts` lines 370-382

**Problem:** Parser looks for non-existent `0x06 0x20` pattern
```typescript
// Current (WRONG):
if (data[i] === 0x06 && data[i + 1] === 0x20) {
  const lengthByte = data[i + 2];
  nameLength = lengthByte ?? 0;
  nameStart = i + 3;  // Wrong offset!
  break;
}
```

**Evidence:** MIDI capture shows device uses `0x20 [length] [name]` (NO `0x06` prefix)
- WRITE: `20 07 54 45 53 54 4D 4F 44` = `0x20 [7] "TESTMOD"`
- READ:  `20 07 54 45 53 54 4D 4F 44` = `0x20 [7] "TESTMOD"`

**Result:** Parser fails to match, falls back to broken heuristic parsing causing truncation

#### Bug 2: Encoder Length Cap (HIGH)
**Location:** `modules/launch-control-xl3/src/core/SysExParser.ts` line 1120

**Problem:** Encoder hardcodes 16-character limit instead of 18
```typescript
// Current (WRONG):
const nameBytes = Array.from(name.substring(0, 16)).map(c => c.charCodeAt(0));
```

**Evidence:** MIDI capture shows "EXACTLY18CHARSLONG" truncated to 16 bytes:
```
20 10 "EXACTLY18CHARSLO"  ← Length says 0x10 (16), missing last 2 chars
```

**Result:** Names longer than 16 characters are truncated before transmission

### Why Both Bugs Exist
1. **Format 2 pattern** (`0x06 0x20`) was based on incorrect specification
2. **16-character cap** contradicts PROTOCOL.md which states 18-character max
3. **Parser fallback** (Format 3) produces unpredictable truncation

---

## Implementation Plan

### Priority 1: Fix Parser Pattern (CRITICAL)

#### File: `modules/launch-control-xl3/src/core/SysExParser.ts`
#### Function: `parseName()`
#### Lines: 370-382

**BEFORE:**
```typescript
// Format 2: 0x06 0x20 [length] [name bytes] - read response format
if (data[i] === 0x06 && data[i + 1] === 0x20) {
  const lengthByte = data[i + 2];
  // Check for factory pattern: 06 20 1F (indicates factory data)
  if (lengthByte === 0x1F) {
    // This is factory data, use slot-based fallback name
    return undefined; // Let caller use default slot name
  }
  // Use the length byte to know exactly how many characters to read
  nameLength = lengthByte ?? 0;
  nameStart = i + 3;
  break;
}
```

**AFTER:**
```typescript
// Format 2: 0x20 [length] [name bytes] - actual device format
if (data[i] === 0x20) {
  const lengthByte = data[i + 1];
  // Check for factory pattern: 0x20 0x1F (indicates factory data)
  if (lengthByte === 0x1F) {
    // This is factory data, use slot-based fallback name
    return undefined; // Let caller use default slot name
  }
  // Use the length byte to know exactly how many characters to read
  nameLength = lengthByte ?? 0;
  nameStart = i + 2;  // FIXED: Adjusted offset (was i + 3)
  break;
}
```

**Changes:**
1. Remove `data[i] === 0x06 &&` condition
2. Update comment to reflect actual device format
3. Adjust `nameStart` offset from `i + 3` to `i + 2`
4. Update factory mode check comment to use `0x20 0x1F` pattern

**Rationale:** Device uses `0x20 [length] [name]` format confirmed by MIDI capture

---

### Priority 2: Fix Encoder Length Cap (HIGH)

#### File: `modules/launch-control-xl3/src/core/SysExParser.ts`
#### Function: `encodeName()`
#### Line: 1120

**BEFORE:**
```typescript
/**
 * Encode a name string with the correct Launch Control XL3 prefix
 * Phase 2 implementation: Uses 0x01 0x20 0x10 0x2A prefix as per web editor analysis
 *
 * @param name - Name string to encode (max 16 chars based on web editor "New Custom Mode")
 * @returns Encoded name bytes with prefix
 */
private static encodeName(name: string): number[] {
  // Truncate to 16 characters and convert to bytes
  const nameBytes = Array.from(name.substring(0, 16)).map(c => c.charCodeAt(0));

  // Web editor format: 0x20 [length] [name_bytes]
  return [
    0x20,              // Prefix byte
    nameBytes.length,  // Length byte
    ...nameBytes
  ];
}
```

**AFTER:**
```typescript
/**
 * Encode a name string with the correct Launch Control XL3 prefix
 * Uses 0x20 [length] [name_bytes] format as confirmed by MIDI capture analysis
 *
 * @param name - Name string to encode (max 18 chars per PROTOCOL.md v2.1)
 * @returns Encoded name bytes with prefix
 */
private static encodeName(name: string): number[] {
  // Truncate to 18 characters and convert to bytes (FIXED: was 16)
  const nameBytes = Array.from(name.substring(0, 18)).map(c => c.charCodeAt(0));

  // Device format: 0x20 [length] [name_bytes] (confirmed by MIDI capture)
  return [
    0x20,              // Prefix byte
    nameBytes.length,  // Length byte (0-18)
    ...nameBytes
  ];
}
```

**Changes:**
1. Change `substring(0, 16)` to `substring(0, 18)`
2. Update JSDoc comment: "max 16 chars" → "max 18 chars per PROTOCOL.md v2.1"
3. Update comment: "Web editor format" → "Device format (confirmed by MIDI capture)"
4. Add note to length byte comment: "(0-18)"

**Rationale:** PROTOCOL.md v2.1 documents 18-character maximum, MIDI capture confirms device accepts 18

---

### Priority 3: Update Unit Tests

#### File: `modules/launch-control-xl3/test/core/SysExParser.test.ts`

**Updates Required:**

1. **Add test for parser pattern fix:**
```typescript
it('should parse mode names with 0x20 pattern (not 0x06 0x20)', () => {
  // Test that parser correctly handles device format: 0x20 [length] [name]
  const modeData = new Uint8Array([
    0x20, 0x07,  // Mode name marker + length
    0x54, 0x45, 0x53, 0x54, 0x4D, 0x4F, 0x44,  // "TESTMOD"
    0x49, 0x10, 0x02  // Start of controls...
  ]);

  const parsed = SysExParser['parseName'](Array.from(modeData));
  expect(parsed).toBe('TESTMOD');
});
```

2. **Update 18-character encoding test (already exists, verify it passes):**
```typescript
it('should limit mode name to 18 characters maximum', () => {
  const modeData: any = {
    type: 'custom_mode_response',
    manufacturerId: [0x00, 0x20, 0x29],
    slot: 0,
    name: 'EXACTLYEIGHTEENCHA', // Exactly 18 characters
    controls: [],
    colors: [],
    data: []
  };
  const message = SysExParser.buildCustomModeWriteRequest(0, 0, modeData);
  // Verify 18 characters are encoded
  const nameBytes = message.slice(14, 32); // Adjust offsets as needed
  const decodedName = String.fromCharCode(...nameBytes);
  expect(decodedName).toBe('EXACTLYEIGHTEENCHA');
});
```

3. **Add factory mode test with new pattern:**
```typescript
it('should recognize factory mode with 0x20 0x1F pattern', () => {
  const factoryData = new Uint8Array([
    0x20, 0x1F,  // Factory mode indicator
    0x49, 0x10, 0x02  // Controls...
  ]);

  const parsed = SysExParser['parseName'](Array.from(factoryData));
  expect(parsed).toBeUndefined();  // Should return undefined for factory modes
});
```

---

## Documentation Updates (MANDATORY)

### File 1: `modules/launch-control-xl3/docs/PROTOCOL.md`

**Section to Update:** Mode Name Field Format

**BEFORE (existing v2.1 content):**
```markdown
The mode name field uses a length-prefixed format with the following structure:
- Maximum length: 18 characters (0-18)
```

**AFTER (add detailed format specification):**
```markdown
### Mode Name Field Format

The mode name field uses a length-prefixed format confirmed by MIDI capture analysis.

**Format (both WRITE and READ):**
```
0x20 [length] [name_bytes]
```

**Structure:**
- **Byte 0:** Field marker (`0x20`)
- **Byte 1:** Length byte (`0x00` - `0x12` for 0-18 characters)
- **Bytes 2+:** ASCII characters (if length > 0)

**Special Cases:**
- **Factory mode:** `0x20 0x1F` (length byte = `0x1F` indicates immutable factory content)
- **Empty name:** `0x20 0x00` (length = 0, no name bytes)

**Examples:**
```
"TESTMOD" (7 chars):    20 07 54 45 53 54 4D 4F 44
"EXACTLY18CHARSLONG":   20 12 45 58 41 43 54 4C 59 31 38 43 48 41 52 53 4C 4F 4E 47
Factory mode:           20 1F
```

**Important Notes:**
- **Maximum length:** 18 characters (0x12 = 18 decimal)
- **No `0x06` prefix:** Earlier documentation incorrectly suggested `0x06 0x20` pattern
- **Symmetric format:** Write and read use identical encoding
- **Discovered via:** MIDI traffic capture analysis (2025-10-17, Issue #40)

**Version History Update:**
```markdown
## Version 2.1.1 (2025-10-17)

### Bug Fix
- **Corrected mode name encoding format** (Issue #40)
  - Removed incorrect `0x06` prefix from documentation
  - Confirmed actual format: `0x20 [length] [name_bytes]`
  - Evidence: MIDI capture analysis of device traffic
  - Factory mode pattern updated: `0x20 0x1F` (not `0x06 0x20 0x1F`)
```

---

### File 2: `modules/launch-control-xl3/formats/launch_control_xl3.ksy`

**Section to Update:** mode_name definition

**BEFORE:**
```yaml
mode_name:
  seq:
    - id: name_marker
      contents: [0x06, 0x20]
    - id: name_length
      type: u1
      doc: Length of mode name (0-18 characters)
    - id: name_bytes
      size: name_length
      type: str
      encoding: ASCII
      if: name_length > 0
  doc: |
    Note: The device supports mode names up to 18 characters.
    Earlier documentation incorrectly stated 8 characters as the maximum.
```

**AFTER:**
```yaml
mode_name:
  seq:
    - id: name_marker
      contents: [0x20]
      doc: Mode name field marker (NOT 0x06 0x20 as previously documented)
    - id: name_length
      type: u1
      doc: |
        Length of mode name (0-18 characters, 0x00-0x12).
        Special value 0x1F (31) indicates factory/immutable mode.
    - id: name_bytes
      size: name_length
      type: str
      encoding: ASCII
      if: name_length > 0 and name_length != 0x1F
  doc: |
    Mode name field format: 0x20 [length] [name_bytes]

    Confirmed by MIDI capture analysis (2025-10-17, Issue #40):
    - Device uses 0x20 prefix (NOT 0x06 0x20)
    - Maximum length: 18 characters (0x12 = 18 decimal)
    - Factory mode indicator: 0x20 0x1F (length = 0x1F)
    - Write and read use identical format

    Earlier versions incorrectly documented:
    - 0x06 0x20 prefix pattern (does not exist in protocol)
    - 8-character maximum (actual maximum is 18)
```

---

## Testing Plan

### Phase 1: Unit Testing

**File:** `modules/launch-control-xl3/test/core/SysExParser.test.ts`

**Tests to Verify:**
1. ✅ Parser correctly reads `0x20` pattern (not `0x06 0x20`)
2. ✅ Parser handles factory mode `0x20 0x1F` pattern
3. ✅ Encoder generates 18-character names (not 16)
4. ✅ All name lengths 1-18 encode/decode correctly
5. ✅ Empty name (`0x20 0x00`) handled correctly

**Command:**
```bash
cd modules/launch-control-xl3
pnpm test test/core/SysExParser.test.ts
```

**Expected Results:**
- All tests pass
- No regressions in existing tests

---

### Phase 2: Integration Testing

**File:** `modules/launch-control-xl3/test/integration/custom-mode-write-verify.test.ts`

**Test Cases:**
| Test Name | Length | Expected Result |
|-----------|--------|-----------------|
| TESTMOD | 7 chars | "TESTMOD" (not "M") |
| 17CharacterMode1 | 16 chars | "17CharacterMode1" (not "Mode1") |
| EXACTLY18CHARSLONG | 18 chars | "EXACTLY18CHARSLONG" (not "C") |
| 18CharModeName123 | 18 chars | "18CharModeName123" (not "C") |
| ShortName | 9 chars | "ShortName" (not "M") |

**Command:**
```bash
cd modules/launch-control-xl3
npx tsx test/integration/custom-mode-write-verify.test.ts
```

**Expected Results:**
- ✅ All 5 test cases pass
- ✅ Mode names preserved exactly as written
- ✅ No truncation or corruption

---

### Phase 3: Device Validation

**Procedure:**

1. **Build with fixes:**
```bash
cd modules/launch-control-xl3
pnpm build
```

2. **Write 18-character mode to device:**
```bash
# Create test mode with 18-char name
npx tsx utils/test-custom-mode-write.ts \
  --name "EIGHTEENCHARSNAME1" \
  --slot 14
```

3. **Read back from device:**
```bash
npm run backup
```

4. **Verify name preserved:**
```bash
cat backup/*.json | jq '.mode.name'
# Expected output: "EIGHTEENCHARSNAME1"
```

5. **Test edge cases:**
```bash
# Test 1 character
npx tsx utils/test-custom-mode-write.ts --name "A" --slot 14
npm run backup && cat backup/*.json | jq '.mode.name'
# Expected: "A"

# Test 8 characters (old limit)
npx tsx utils/test-custom-mode-write.ts --name "TESTMODE" --slot 14
npm run backup && cat backup/*.json | jq '.mode.name'
# Expected: "TESTMODE"

# Test 17 characters
npx tsx utils/test-custom-mode-write.ts --name "SEVENTEENCHARSNAM" --slot 14
npm run backup && cat backup/*.json | jq '.mode.name'
# Expected: "SEVENTEENCHARSNAM"

# Test 18 characters (new max)
npx tsx utils/test-custom-mode-write.ts --name "EIGHTEENCHARSNAME2" --slot 14
npm run backup && cat backup/*.json | jq '.mode.name'
# Expected: "EIGHTEENCHARSNAME2"
```

**Expected Results:**
- ✅ All name lengths (1-18) preserved correctly
- ✅ No truncation or corruption
- ✅ Backup utility works as expected

---

## Verification Checklist

Before marking this issue as complete, verify:

### Code Changes
- [ ] Parser pattern fix implemented (lines 370-382)
- [ ] Encoder length cap fix implemented (line 1120)
- [ ] Comments updated to reflect actual device format
- [ ] JSDoc updated with correct specifications

### Testing
- [ ] All unit tests pass (`pnpm test`)
- [ ] Integration tests pass (all 5 test cases)
- [ ] Device validation successful (1, 8, 17, 18 char names)
- [ ] No regressions in existing functionality

### Documentation
- [ ] PROTOCOL.md updated with correct format specification
- [ ] PROTOCOL.md version history entry added (v2.1.1)
- [ ] launch_control_xl3.ksy updated with correct pattern
- [ ] .ksy file includes discovery methodology note
- [ ] All documentation synchronized

### Build & Release
- [ ] TypeScript compilation succeeds (`pnpm build`)
- [ ] No build errors or warnings
- [ ] All files properly formatted
- [ ] Git commit references documentation changes

### Issue Tracking
- [ ] Issue #40 updated with fix details
- [ ] Test results attached to issue
- [ ] MIDI capture evidence referenced
- [ ] Branch ready for PR

---

## Timeline Estimate

### Implementation Time
- **Parser fix:** 15 minutes
- **Encoder fix:** 10 minutes
- **Unit test updates:** 20 minutes
- **Total implementation:** ~45 minutes

### Testing Time
- **Unit tests:** 5 minutes
- **Integration tests:** 10 minutes
- **Device validation:** 15 minutes
- **Total testing:** ~30 minutes

### Documentation Time
- **PROTOCOL.md update:** 15 minutes
- **launch_control_xl3.ksy update:** 10 minutes
- **Total documentation:** ~25 minutes

### Total Estimated Time
**1.5 - 2 hours** (including validation and verification)

---

## Dependencies

### Required Tools
- TypeScript compiler (`tsc`)
- pnpm package manager
- Node.js (v18+)
- Physical Launch Control XL3 device (for validation)

### Required Files
All files exist and are in working state:
- ✅ `modules/launch-control-xl3/src/core/SysExParser.ts`
- ✅ `modules/launch-control-xl3/docs/PROTOCOL.md`
- ✅ `modules/launch-control-xl3/formats/launch_control_xl3.ksy`
- ✅ `modules/launch-control-xl3/test/core/SysExParser.test.ts`
- ✅ `modules/launch-control-xl3/test/integration/custom-mode-write-verify.test.ts`

---

## Risk Assessment

### Low Risk
- Changes are localized to two functions
- Extensive MIDI capture evidence supports fix
- Existing tests provide regression safety
- Device validation confirms correct behavior

### Mitigation Strategies
- **Backup current working code** before changes
- **Run full test suite** after each change
- **Test with real device** before merging
- **Keep MIDI captures** for reference

---

## Success Criteria

This implementation is considered successful when:

1. ✅ **All unit tests pass** with no regressions
2. ✅ **All integration tests pass** (5/5 test cases)
3. ✅ **Device validation succeeds** for all edge cases (1, 8, 17, 18 chars)
4. ✅ **Documentation synchronized** (PROTOCOL.md, .ksy, code comments)
5. ✅ **Issue #40 resolved** with test evidence
6. ✅ **No breaking changes** to public API

---

## References

### Investigation Documents
- **Comprehensive findings:** `docs/1.20/issues/40/investigation/COMPREHENSIVE-FINDINGS.md`
- **MIDI capture analysis:** `docs/1.20/issues/40/investigation/analysis/midi-capture-analysis.md`
- **Code analysis:** `docs/1.20/issues/40/investigation/analysis/web-editor-analysis.md`
- **MIDI captures:** `docs/1.20/issues/40/investigation/midi-captures/`

### Evidence
- **MIDI capture file:** `mode-write-read-20251017-090833.txt` (40KB, 192 lines)
- **Test results:** Integration tests show consistent truncation pattern
- **Device behavior:** Confirmed via real hardware testing

### Related Issues
- **Issue #36:** Incorrect mode name length documentation (8 chars → 18 chars)
- **Issue #40:** Mode name truncation bug (this workplan)

---

**Prepared by:** AI Agent (orchestrator)
**Reviewed by:** [Pending]
**Approved by:** [Pending]
**Implementation Status:** Ready to Start
