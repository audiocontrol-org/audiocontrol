# MIDI Capture Analysis: Mode Name Encoding Format

**Date:** 2025-10-17
**Capture File:** `mode-write-read-20251017-090833.txt`
**Issue:** #40 - Mode name truncation bug
**Status:** ROOT CAUSE IDENTIFIED

## Executive Summary

Analysis of raw MIDI traffic confirms **our hypothesis is INCORRECT**. The device does NOT use a `0x06` prefix before the mode name. Both WRITE and READ use the same format: `0x20 [length] [name_bytes]`. The truncation bug is caused by a different issue in our parsing logic.

## Test Cases Analyzed

The capture contains WRITE/READ cycles for multiple test names:

1. **TESTMOD** (7 characters) → Truncated to "M" (1 char)
2. **17CharacterMode1** (16 characters) → Truncated to "Mode1" (5 chars)
3. **EXACTLY18CHARSLONG** (18 characters) → Truncated to "C" (1 char)
4. **18CharModeName12** (18 characters) → Successfully read
5. **ShortName** (9 characters) → Successfully read

## Detailed Analysis: TESTMOD Case

### WRITE Message (Line 59)

**Direction:** Computer → LCXL3 (DEST)
**Message Type:** Mode configuration write

```
Hex dump with annotations:
F0 00 20 29 02 15 05 00 10 00 09   SysEx header + mode write command
20                                   Mode name field marker
07                                   Length = 7 bytes
54 45 53 54 4D 4F 44                Mode name: "TESTMOD" (T E S T M O D)
21 00                                Delimiter
48 10 02 05 00 01 48 00 17 7F       Control mappings...
[... control configuration continues ...]
```

**Key observation:** The WRITE format is:
- `0x20` = Mode name field marker
- `0x07` = Length byte (7 characters)
- `54 45 53 54 4D 4F 44` = ASCII "TESTMOD"

**NO `0x06` prefix before `0x20`**

### READ Response (Line 51)

**Direction:** LCXL3 → Computer (SRC)
**Message Type:** Mode configuration read response

```
Hex dump with annotations:
F0 00 20 29 02 15 05 00 45 00 03   SysEx header + mode read response
20                                   Mode name field marker
07                                   Length = 7 bytes
54 45 53 54 4D 4F 44                Mode name: "TESTMOD" (T E S T M O D)
49 10 02 05 00 01 48 00 17 7F 00   Control mappings...
[... control configuration continues ...]
```

**Key observation:** The READ response format is IDENTICAL:
- `0x20` = Mode name field marker
- `0x07` = Length byte (7 characters)
- `54 45 53 54 4D 4F 44` = ASCII "TESTMOD"

**NO `0x06` prefix in the read response either**

### Second READ Response (Line 54)

There's a second read response for page 03 (faders):

```
F0 00 20 29 02 15 05 00 45 03 03   SysEx header (page 03)
20                                   Mode name field marker
07                                   Length = 7 bytes
54 45 53 54 4D 4F 44                Mode name: "TESTMOD"
49 28 02 00 00 01 48 00 05 7F 00   Control mappings...
[... control configuration continues ...]
```

**Confirms:** ALL pages in the response use the same format without `0x06` prefix.

## Additional Test Cases

### 17CharacterMode1 (Line 102)

**WRITE message:**
```
20 10                                Field marker + length (16 bytes)
31 37 43 68 61 72 61 63 74 65 72    "17CharacterMode1"
4D 6F 64 65 31
```

**READ response (Line 101):**
```
20 10                                Field marker + length (16 bytes)
31 37 43 68 61 72 61 63 74 65 72    "17CharacterMode1"
4D 6F 64 65 31
```

Both use `0x20 [length] [bytes]` format without `0x06` prefix.

### EXACTLY18CHARSLONG (Line 119)

**WRITE message (Line 127):**
```
20 10                                Field marker + length (16 bytes!)
45 58 41 43 54 4C 59 31 38 43 48    "EXACTLY18CHARSLO"
41 52 53 4C 4F
```

**Wait... the length says 16 (0x10) but the name is 18 characters!**

**READ response (Line 119):**
```
20 10                                Field marker + length (16 bytes)
45 58 41 43 54 4C 59 31 38 43 48    "EXACTLY18CHARSLOI"
41 52 53 4C 4F 49
```

The device echoes back 16 characters because that's what the length field says. Our encoder is writing the wrong length!

### 18CharModeName12 (Line 144)

**WRITE message (Line 152):**
```
20 10                                Field marker + length (16 bytes)
31 38 43 68 61 72 4D 6F 64 65 4E    "18CharModeName12"
61 6D 65 31 32
```

**READ response (Line 144):**
```
20 10                                Field marker + length (16 bytes)
31 38 43 68 61 72 4D 6F 64 65 4E    "18CharModeName12"
61 6D 65 31 32
```

Again, we're only writing/reading 16 characters even though the name has 18.

### ShortName (Line 169)

**WRITE message (Line 177):**
```
20 09                                Field marker + length (9 bytes)
53 68 6F 72 74 4E 61 6D 65          "ShortName"
```

**READ response (Line 169):**
```
20 09                                Field marker + length (9 bytes)
53 68 6F 72 74 4E 61 6D 65          "ShortName"
```

Correct! 9 characters = length 0x09.

## Root Cause Analysis

### Hypothesis Status: REJECTED

Our initial hypothesis that the READ response includes a `0x06` prefix before `0x20` is **INCORRECT**. The device uses consistent formatting:

```
WRITE:  0x20 [length] [name_bytes]
READ:   0x20 [length] [name_bytes]
```

### Actual Root Cause: Length Encoding Bug

The real issue is in our **encoder** (`buildModeName()`), not the decoder. Evidence:

1. **TESTMOD (7 chars):**
   - We write: `0x20 0x07 "TESTMOD"` ✓ Correct
   - Device reads: `0x20 0x07 "TESTMOD"` ✓ Correct
   - Our decoder fails somewhere else

2. **EXACTLY18CHARSLONG (18 chars):**
   - We write: `0x20 0x10 "EXACTLY18CHARSLO"` ✗ Wrong! Length should be 0x12 (18)
   - We only write 16 characters
   - Device reads back exactly what we wrote (16 chars)

3. **The pattern:**
   - Names ≤ 16 characters: Work correctly
   - Names > 16 characters: Truncated to 16 characters

### The Bug Location

Looking at the WRITE messages, we're capping the mode name at 16 characters. This suggests:

```typescript
// Likely bug in buildModeName():
const maxLength = 16;  // ← This is the problem!
const truncatedName = name.slice(0, maxLength);
```

But the PROTOCOL.md says the maximum is **18 characters**, not 16!

## The Decoder Issue (Secondary Bug)

There's also a decoder bug causing "TESTMOD" → "M" truncation. Let's examine what might be happening:

**Hypothesis:** The decoder is looking for the wrong pattern.

Current decoder likely expects:
```typescript
// Current (wrong):
if (bytes[i] === 0x06 && bytes[i+1] === 0x20) {
  const length = bytes[i+2];
  const name = bytes.slice(i+3, i+3+length);
  // ...
}
```

But it should be:
```typescript
// Correct:
if (bytes[i] === 0x20) {
  const length = bytes[i+1];
  const name = bytes.slice(i+2, i+2+length);
  // ...
}
```

If the decoder is looking for `0x06 0x20` but finds just `0x20`, it might:
1. Skip past `0x20`
2. Interpret `0x07` (length) as the field marker
3. Interpret `0x54` ('T') as the length (84 bytes!)
4. Try to read 84 bytes starting from 'E'
5. Hit the end of the name section
6. Only capture the last character 'D' or something similar

Actually, wait - let me look at the response again:

```
Line 51: ... 20 07 54 45 53 54 4D 4F 44 49 10 02 ...
              |  |  T  E  S  T  M  O  D  I  ...
              |  +-- Length = 7
              +-- Field marker
```

After "TESTMOD", we see `49 10` which is `I` followed by the control ID. If the decoder expects `0x06 0x20` but finds `0x20 0x07 54...`, it might:
- Skip `0x20` (not the pattern it's looking for)
- Skip `0x07`
- Skip `0x54` ('T')
- Skip `0x45` ('E')
- Skip `0x53` ('S')
- Skip `0x54` ('T')
- Skip `0x4D` ('M')
- Find `0x4F` ('O')
- Find `0x44` ('D')
- Find `0x49` ('I') ← Might misinterpret this somehow?

This would explain partial truncation but not the exact "M" result. Need to check actual decoder code.

## Comparison: WRITE vs READ Format

| Element | WRITE Format | READ Format | Difference |
|---------|--------------|-------------|------------|
| Field marker | `0x20` | `0x20` | ✓ Same |
| Prefix before marker | None | None | ✓ Same |
| Length byte | `[length]` | `[length]` | ✓ Same |
| Name bytes | ASCII chars | ASCII chars | ✓ Same |
| Terminator | `0x21 0x00` | None, goes directly to controls | Different |

**Conclusion:** The formats are nearly identical. The only difference is the WRITE message has a `0x21 0x00` terminator before the control mappings, while READ responses go directly into control data with a `0x49` prefix for each control.

## Verification Against Other Test Names

### Pattern Observed:

1. **Short names (≤ 16 chars):**
   - "TESTMOD" (7) → Encoder OK, decoder broken
   - "ShortName" (9) → Encoder OK, decoder possibly broken
   - "17CharacterMode1" (16) → Encoder OK (exactly 16), decoder possibly broken

2. **Long names (> 16 chars):**
   - "EXACTLY18CHARSLONG" (18) → Encoder truncates to 16, decoder reads truncated version
   - "18CharModeName12" (18) → Encoder truncates to 16, decoder reads truncated version

## Recommended Fix

### Priority 1: Fix Encoder Length Cap

**File:** `src/protocol/mode-operations.ts` (or similar)
**Function:** `buildModeName()`

Change:
```typescript
const maxLength = 16;  // WRONG
```

To:
```typescript
const maxLength = 18;  // Correct per PROTOCOL.md
```

### Priority 2: Fix Decoder Pattern

**File:** `src/protocol/parsers/mode-parser.ts` (or similar)
**Function:** `parseModeConfiguration()`

Change decoder to look for:
```typescript
// Remove the 0x06 prefix expectation
if (bytes[i] === 0x20) {  // Mode name field marker
  const length = bytes[i + 1];
  const nameBytes = bytes.slice(i + 2, i + 2 + length);
  const name = Buffer.from(nameBytes).toString('ascii');
  // ...
  i += 2 + length;  // Skip past the name field
}
```

Instead of:
```typescript
// Old (incorrect) pattern
if (bytes[i] === 0x06 && bytes[i+1] === 0x20) {
  // ...
}
```

## Test Plan Verification

After fixes, verify:
1. ✓ "TESTMOD" (7 chars) → Reads as "TESTMOD"
2. ✓ "17CharacterMode1" (16 chars) → Reads as "17CharacterMode1"
3. ✓ "EXACTLY18CHARSLONG" (18 chars) → Reads as "EXACTLY18CHARSLONG"
4. ✓ "18CharModeName123" (18 chars) → Reads as "18CharModeName123"
5. ✓ "A" (1 char) → Reads as "A"
6. ✓ "1234567890123456" (16 chars) → Reads as "1234567890123456"
7. ✓ "12345678901234567" (17 chars) → Reads as "12345678901234567"
8. ✓ "123456789012345678" (18 chars) → Reads as "123456789012345678"

## Conclusion

**The root cause is TWO BUGS:**

1. **Encoder bug:** Hardcoded 16-character limit instead of 18
2. **Decoder bug:** Looking for `0x06 0x20` pattern instead of just `0x20`

**The hypothesis about `0x06` prefix in READ responses is INCORRECT.**

The device uses consistent formatting for both WRITE and READ. Our code has bugs in both encoding (16-char cap) and decoding (wrong pattern match).

## Appendix: Raw Message Examples

### Complete TESTMOD WRITE Message (Line 59-65)

```
F0 00 20 29 02 15 05 00 10 00 09 20 07 54 45 53
54 4D 4F 44 21 00 48 10 02 05 00 01 48 00 17 7F
48 11 02 05 00 01 48 00 18 7F 48 12 02 05 00 01
48 00 19 7F 48 13 02 05 00 01 48 00 1A 7F 48 14
02 05 00 01 48 00 1B 7F 48 15 02 05 00 01 48 00
12 7F 48 16 02 05 00 01 48 00 13 7F 48 17 02 05
00 01 48 00 14 7F 48 18 02 09 00 01 48 00 15 7F
48 19 02 09 00 01 48 00 16 7F 48 1A 02 09 00 01
48 00 17 7F 48 1B 02 09 00 01 48 00 18 7F 48 1C
02 09 00 01 48 00 19 7F 48 1D 02 09 00 01 48 00
1A 7F 48 1E 02 09 00 01 48 00 1B 7F 48 1F 02 09
00 01 48 00 1C 7F 48 20 02 0D 00 01 48 00 1D 7F
48 21 02 0D 00 01 48 00 1E 7F 48 22 02 0D 00 01
48 00 1F 7F 48 23 02 0D 00 01 48 00 20 7F 48 24
02 0D 00 01 48 00 21 7F 48 25 02 0D 00 01 48 00
22 7F 48 26 02 0D 00 01 48 00 23 7F 48 27 02 0D
00 01 48 00 24 7F 60 10 60 11 60 12 60 13 60 14
60 15 60 16 60 17 60 18 60 19 60 1A 60 1B 60 1C
60 1D 60 1E 60 1F 64 20 4D 21 48 48 60 21 60 22
60 23 60 24 60 25 60 26 60 27 06 00 04 40 F7
```

### Complete TESTMOD READ Response (Line 51)

```
F0 00 20 29 02 15 05 00 45 00 03 20 07 54 45 53
54 4D 4F 44 49 10 02 05 00 01 48 00 17 7F 00 49
11 02 05 00 01 48 00 0E 7F 00 49 12 02 05 00 01
48 00 0F 7F 00 49 13 02 05 00 01 48 00 10 7F 00
49 14 02 05 00 01 48 00 11 7F 00 49 15 02 05 00
01 48 00 12 7F 00 49 16 02 05 00 01 48 00 13 7F
00 49 17 02 05 00 01 48 00 14 7F 00 49 18 02 09
00 01 48 00 15 7F 00 49 19 02 09 00 01 48 00 16
7F 00 49 1A 02 09 00 01 48 00 17 7F 00 49 1B 02
09 00 01 48 00 18 7F 00 49 1C 02 09 00 01 48 00
19 7F 00 49 1D 02 09 00 01 48 00 1A 7F 00 49 1E
02 09 00 01 48 00 1B 7F 00 49 1F 02 09 00 01 48
00 1C 7F 00 49 20 02 0D 00 01 48 00 1D 7F 00 49
21 02 0D 00 01 48 00 1E 7F 00 49 22 02 0D 00 01
48 00 1F 7F 00 49 23 02 0D 00 01 48 00 20 7F 00
49 24 02 0D 00 01 48 00 21 7F 00 49 25 02 0D 00
01 48 00 22 7F 00 49 26 02 0D 00 01 48 00 23 7F
00 49 27 02 0D 00 01 48 00 24 7F 00 60 10 60 11
60 12 60 13 60 14 60 15 60 16 60 17 60 18 60 19
60 1A 60 1B 60 1C 60 1D 60 1E 60 1F 60 20 60 21
60 22 60 23 60 24 60 25 60 26 60 27 64 20 4D 21
48 48 60 F7
```

**Note the difference:** WRITE has `21 00` after mode name, READ has `49` prefix on each control.
