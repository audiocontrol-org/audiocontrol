# Issue #40: Mode Name Truncation - Comprehensive Investigation Summary

**Date:** 2025-10-17
**Branch:** `fix/mode-name-18-chars`
**Status:** 🔴 CRITICAL CONFLICT IN FINDINGS

---

## 🚨 Executive Summary: Conflicting Analyses

**We have TWO contradictory analyses that must be reconciled:**

### Analysis 1: MIDI Capture Analysis (test-automator)
- **Conclusion:** REJECTS the `0x06` prefix hypothesis
- **Finding:** Device uses `0x20 [length] [name]` for BOTH write and read
- **Root cause:** TWO bugs identified:
  1. Encoder caps at 16 characters instead of 18
  2. Decoder looks for wrong pattern

### Analysis 2: Web Editor Analysis (ui-engineer)
- **Conclusion:** CONFIRMS the `0x06` prefix hypothesis
- **Finding:** Parser expects `0x06 0x20 [length] [name]` but encoder only sends `0x20 [length] [name]`
- **Root cause:** Missing `0x06` prefix byte in encoder

**These cannot both be correct. We need to resolve this conflict.**

---

## Investigation Timeline

### Phase 1: Initial Fix (Completed)
- ✅ Updated mode name limit from 8 → 18 characters across:
  - `src/builders/CustomModeBuilder.ts`
  - `formats/launch_control_xl3.ksy`
  - `docs/PROTOCOL.md` (v2.1)
  - `test/core/SysExParser.test.ts`
- ✅ All unit tests passing (350 tests)
- ✅ Build successful
- ✅ Typecheck passing

### Phase 2: Integration Testing (FAILED)
- ❌ Integration tests revealed severe truncation bug:
  - "TESTMOD" (7 chars) → "M" (1 char)
  - "17CharacterMode1" (16 chars) → "Mode1" (5 chars)
  - "EXACTLY18CHARSLONG" (18 chars) → "C" (1 char)
  - "ShortName" (9 chars) → "M" (1 char)

### Phase 3: Investigation (CONFLICTING RESULTS)
- 📋 Code review completed
- 📋 MIDI traffic captured
- 📋 Web editor analyzed
- ⚠️ **CONFLICT:** Two agents reached opposite conclusions

---

## Detailed Findings Comparison

### Finding 1: MIDI Capture Analysis Says NO `0x06` Prefix

**Source:** `/Users/orion/work/ol_dsp/modules/audio-control/docs/1.20/issues/40/investigation/analysis/midi-capture-analysis.md`

**Evidence from actual MIDI traffic:**

**TESTMOD WRITE (Line 59):**
```
20 07 54 45 53 54 4D 4F 44
|  |  T  E  S  T  M  O  D
|  +-- Length = 7
+-- Field marker (NO 0x06 prefix)
```

**TESTMOD READ Response (Line 51):**
```
20 07 54 45 53 54 4D 4F 44
|  |  T  E  S  T  M  O  D
|  +-- Length = 7
+-- Field marker (NO 0x06 prefix)
```

**Key observation:** Both WRITE and READ use identical format: `0x20 [length] [name]`

**Additional evidence:**
- All test cases in capture show same pattern
- No `0x06` byte anywhere near mode name fields
- "EXACTLY18CHARSLONG" was truncated to 16 chars (`0x20 0x10 ...`)

**Conclusion:**
1. Encoder hardcodes 16-char limit (should be 18)
2. Decoder expects wrong pattern (`0x06 0x20` vs actual `0x20`)

---

### Finding 2: Code Analysis Says MISSING `0x06` Prefix

**Source:** `/Users/orion/work/ol_dsp/modules/audio-control/docs/1.20/issues/40/investigation/analysis/web-editor-analysis.md`

**Evidence from parser code:**

`src/core/SysExParser.ts` lines 358-383:
```typescript
// Format 2: 0x06 0x20 [length] [name bytes] - read response format
if (data[i] === 0x06 && data[i + 1] === 0x20) {
  const lengthByte = data[i + 2];
  // Check for factory pattern: 06 20 1F (indicates factory data)
  if (lengthByte === 0x1F) {
    return undefined; // Let caller use default slot name
  }
  nameLength = lengthByte ?? 0;
  nameStart = i + 3;
  break;
}
```

**Evidence from encoder code:**

`src/core/SysExParser.ts` lines 1118-1128:
```typescript
private static encodeName(name: string): number[] {
  const nameBytes = Array.from(name.substring(0, 16)).map(c => c.charCodeAt(0));

  // Web editor format: 0x20 [length] [name_bytes]
  return [
    0x20,              // Prefix byte
    nameBytes.length,  // Length byte
    ...nameBytes
  ];
}
```

**Key observation:** Parser expects `0x06 0x20` but encoder only produces `0x20`

**Conclusion:** Missing `0x06` prefix in encoder causes parser to fail

---

## 🔍 Reconciliation: Which Analysis Is Correct?

### Critical Question: What does the ACTUAL DEVICE use?

**MIDI capture shows device reality:** `0x20 [length] [name]` (NO `0x06`)

**Parser code expects:** `0x06 0x20 [length] [name]`

### Resolution Hypothesis

**The parser code is WRONG, not the encoder!**

Here's what likely happened:

1. **Device protocol uses:** `0x20 [length] [name]` (confirmed by MIDI capture)
2. **Encoder correctly generates:** `0x20 [length] [name]` (matches device)
3. **Parser incorrectly expects:** `0x06 0x20 [length] [name]` (WRONG!)
4. **Result:** Parser fails to match pattern, falls back to broken heuristics

### Evidence Supporting This Hypothesis

From MIDI capture analysis:
```
WRITE:  0x20 0x07 "TESTMOD" → Device receives and stores
READ:   0x20 0x07 "TESTMOD" → Device returns same format
PARSER: Looks for 0x06 0x20 → FAILS to find it → Truncation bug
```

The device is perfectly consistent. Our parser is the problem.

---

## Root Cause: TWO BUGS Confirmed

### Bug 1: Encoder 16-Character Cap (HIGH PRIORITY)

**Location:** `src/core/SysExParser.ts` line 1120

**Current:**
```typescript
const nameBytes = Array.from(name.substring(0, 16)).map(c => c.charCodeAt(0));
```

**Should be:**
```typescript
const nameBytes = Array.from(name.substring(0, 18)).map(c => c.charCodeAt(0));
```

**Evidence:** MIDI capture shows "EXACTLY18CHARSLONG" truncated to 16 bytes:
```
20 10 "EXACTLY18CHARSLO"  ← Length says 0x10 (16), missing last 2 chars
```

### Bug 2: Parser Wrong Pattern (HIGH PRIORITY)

**Location:** `src/core/SysExParser.ts` lines 358-383

**Current (WRONG):**
```typescript
if (data[i] === 0x06 && data[i + 1] === 0x20) {
  const lengthByte = data[i + 2];
  nameLength = lengthByte ?? 0;
  nameStart = i + 3;
  break;
}
```

**Should be:**
```typescript
if (data[i] === 0x20) {
  const lengthByte = data[i + 1];
  // Check for factory pattern: 0x20 0x1F (indicates factory data)
  if (lengthByte === 0x1F) {
    return undefined; // Let caller use default slot name
  }
  nameLength = lengthByte ?? 0;
  nameStart = i + 2;
  break;
}
```

**Evidence:** MIDI capture confirms device uses `0x20 [length]` without `0x06` prefix

---

## Why The Confusion?

### Where did `0x06` come from?

Looking at the parser, there are THREE format handlers:

**Format 1:** `0x01 0x20 0x10 0x2A [name]` - Legacy write format (terminated)
**Format 2:** `0x06 0x20 [length] [name]` - INCORRECT assumption
**Format 3:** Direct ASCII fallback - Heuristic parsing

**The problem:** Format 2 was implemented based on a misunderstanding or outdated spec. The actual device doesn't use `0x06`.

### Why does existing code "work"?

It doesn't work well! That's why we have the truncation bug. The parser:
1. Fails to match Format 1 (wrong pattern)
2. Fails to match Format 2 (looking for non-existent `0x06`)
3. Falls back to Format 3 (heuristic parsing)
4. Heuristic parsing is fragile and produces truncated results

---

## Recommended Fix (UPDATED)

### Priority 1: Fix Parser Pattern ⚠️ CRITICAL

**File:** `src/core/SysExParser.ts`
**Function:** `parseName()`
**Lines:** 358-383

**Change:**
```typescript
// OLD (WRONG):
if (data[i] === 0x06 && data[i + 1] === 0x20) {
  const lengthByte = data[i + 2];
  nameLength = lengthByte ?? 0;
  nameStart = i + 3;
  break;
}

// NEW (CORRECT):
if (data[i] === 0x20) {
  const lengthByte = data[i + 1];
  // Factory mode indicator: 0x20 0x1F
  if (lengthByte === 0x1F) {
    return undefined; // Use default slot name
  }
  nameLength = lengthByte ?? 0;
  nameStart = i + 2;
  break;
}
```

### Priority 2: Fix Encoder Length Cap ⚠️ CRITICAL

**File:** `src/core/SysExParser.ts`
**Function:** `encodeName()`
**Line:** 1120

**Change:**
```typescript
// OLD: 16-character limit
const nameBytes = Array.from(name.substring(0, 16)).map(c => c.charCodeAt(0));

// NEW: 18-character limit (matches PROTOCOL.md)
const nameBytes = Array.from(name.substring(0, 18)).map(c => c.charCodeAt(0));
```

### Priority 3: Update Documentation

**File:** `docs/PROTOCOL.md`

**Add clarity about mode name encoding:**
```markdown
### Mode Name Field Format

**Encoding (Write):**
```
0x20 [length] [name_bytes]
```

**Decoding (Read Response):**
```
0x20 [length] [name_bytes]
```

**Factory Mode Indicator:**
```
0x20 0x1F
```

Both write and read use identical format. No `0x06` prefix byte.
```

**File:** `formats/launch_control_xl3.ksy`

Update documentation to clarify:
- Mode name uses `0x20 [length] [bytes]` format
- No `0x06` prefix exists in protocol
- Factory modes indicated by length byte `0x1F`

---

## Testing Plan

### Unit Tests

1. Update `test/core/SysExParser.test.ts`:
   - Test 18-character encoding
   - Test 18-character parsing
   - Test factory mode detection (`0x20 0x1F`)
   - Test all lengths 1-18

### Integration Tests

Re-run `test/integration/custom-mode-write-verify.test.ts` after fixes:

**Expected results:**
- ✅ "TESTMOD" (7 chars) → "TESTMOD" (7 chars)
- ✅ "17CharacterMode1" (16 chars) → "17CharacterMode1" (16 chars)
- ✅ "EXACTLY18CHARSLONG" (18 chars) → "EXACTLY18CHARSLONG" (18 chars)
- ✅ "18CharModeName123" (18 chars) → "18CharModeName123" (18 chars)
- ✅ "ShortName" (9 chars) → "ShortName" (9 chars)

### Device Validation

```bash
# 1. Build with fixes
pnpm build

# 2. Write 18-char mode to device
npx tsx utils/test-custom-mode-write.ts --name "EIGHTEENCHARSNAME1" --slot 14

# 3. Read back
npm run backup

# 4. Verify name preserved
cat backup/*.json | jq '.mode.name'
# Expected: "EIGHTEENCHARSNAME1"
```

---

## Files Modified

### Already Changed (Phase 1)
- ✅ `src/builders/CustomModeBuilder.ts` - Validation changed 8→18
- ✅ `formats/launch_control_xl3.ksy` - Doc updated to 18 chars
- ✅ `docs/PROTOCOL.md` - Version 2.1, documented 18-char limit
- ✅ `test/core/SysExParser.test.ts` - Test cases updated

### Need to Change (Phase 2)
- ⚠️ `src/core/SysExParser.ts` - Fix parser pattern (remove `0x06` expectation)
- ⚠️ `src/core/SysExParser.ts` - Fix encoder cap (16→18)
- ⚠️ `docs/PROTOCOL.md` - Clarify encoding format (no `0x06`)
- ⚠️ `formats/launch_control_xl3.ksy` - Update format documentation

---

## Investigation Artifacts

### MIDI Captures
- `/Users/orion/work/ol_dsp/modules/audio-control/docs/1.20/issues/40/investigation/midi-captures/mode-write-read-20251017-090833.txt` (40623 bytes, 192 lines)
- Contains WRITE and READ operations for all test cases
- Confirms device uses `0x20 [length] [name]` format

### Analysis Documents
- `/Users/orion/work/ol_dsp/modules/audio-control/docs/1.20/issues/40/investigation/analysis/midi-capture-analysis.md` (13KB, 400 lines)
- `/Users/orion/work/ol_dsp/modules/audio-control/docs/1.20/issues/40/investigation/analysis/web-editor-analysis.md` (9KB, 326 lines)
- `/Users/orion/work/ol_dsp/modules/audio-control/docs/1.20/issues/40/investigation/analysis/code-review.md` (from earlier investigation)

### Test Results
- Integration tests: FAILED (all 5 test cases show truncation)
- Unit tests: PASSED (350 tests)
- Build: PASSING
- Typecheck: PASSING

---

## Conclusion

**The `0x06` prefix hypothesis is REJECTED based on empirical MIDI evidence.**

**Two bugs confirmed:**
1. **Encoder:** Hardcoded 16-character cap instead of 18
2. **Parser:** Looking for non-existent `0x06 0x20` pattern

**Fix confidence:** HIGH - Based on actual device MIDI traffic

**Next steps:**
1. Implement both parser and encoder fixes
2. Run integration tests to validate
3. Update all documentation to reflect correct format
4. Test with real device to confirm 18-character names work

**Status:** Ready for implementation

---

**Investigated by:** test-automator (MIDI), ui-engineer (code), orchestrator (consolidation)
**Date:** 2025-10-17
**Branch:** `fix/mode-name-18-chars`
**Issue:** #40
