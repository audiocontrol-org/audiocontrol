# Import E2E Test Validation Analysis

## Problem Summary

Import e2e tests fail with validation error:
```
String must contain at most 12 character(s)
Path: ["name"]
```

The test fixture uses "E2E Test Tone" (13 characters) but the schema enforces max 12 characters.

## Root Cause Analysis

### Schema Validation Rules

Found in `/modules/sampler-library/src/schemas/tone-schema.ts` and `/modules/sampler-library/src/schemas/patch-schema.ts`:

**Tone names:**
- Schema constraint: `z.string().min(1).max(12)` (line 121 of tone-schema.ts)
- Device constraint: S-330 and S-550 support max 8 characters for tone names (per s-series-params.ts:631)
- However, the library schema enforces 12 characters (for both tones AND patches)

**Patch names:**
- Schema constraint: `z.string().min(1).max(12)` (line 95 of patch-schema.ts)
- Device constraint: S-330 and S-550 support max 12 characters for patch names (per s-series-params.ts:187)

### Error Context

From error-context.md:
- File: `/modules/roland-sxx0-editor/test-results/device-library-import-Impo-43245-tone-from-library-to-device-chromium/error-context.md`
- Validation failed on tone import with name "E2E Test Tone" (13 characters)
- The library successfully loaded the tone (visible as "e2e-test-tone" in the OPFS library tree)
- Validation error occurs when trying to import to device

## Test Fixture Issues Found

### File: `modules/roland-sxx0-editor/e2e/device-library-import.spec.ts`

#### Issue 1: BASIC_TONE_YAML - Tone Name Too Long
- **Location:** Line 47
- **Current value:** `"E2E Test Tone"` 
- **Character count:** 13 characters ❌
- **Max allowed:** 12 characters
- **Actual device limit:** 8 characters (S-330 constraint)
- **Recommendation:** Shorten to ≤12 characters for schema validation

#### Issue 2: Tone Name in Key Group - Inconsistent
- **Location:** Line 106 in BASIC_PATCH_YAML
- **Current value:** `"E2E Test Tone"` (13 characters) ❌
- **This field is a display name** within keyGroups, not the tone reference
- **Tone reference:** `"e2e-test-tone"` (line 107) ✓ Valid
- **Recommendation:** Should match the imported tone name (needs shortening)

#### Issue 3: BASIC_PATCH_YAML - Patch Name Valid
- **Location:** Line 103
- **Current value:** `"E2E Patch"` (9 characters) ✓
- **Max allowed:** 12 characters
- **Status:** VALID

#### Issue 4: File Names vs. YAML Names
- **Tone file:** `e2e-test-tone.yaml` (file system name)
- **YAML content:** `name: E2E Test Tone` (exceeds 12 chars)
- **Issue:** File names use kebab-case and don't need to match YAML name length

## Character Limit Summary

| Type | Actual Device Limit | Schema Limit | Test Value | Status |
|------|-------------------|--------------|-----------|--------|
| Tone name | 8 chars | 12 chars | "E2E Test Tone" (13) | ❌ FAILS |
| Patch name | 12 chars | 12 chars | "E2E Patch" (9) | ✓ PASS |
| Key group name | N/A | No limit | "E2E Test Tone" (13) | ⚠️ UNUSED |

## Recommended Fixes

### 1. Shorten Tone Name (PRIMARY FIX)
**File:** `modules/roland-sxx0-editor/e2e/device-library-import.spec.ts`

**Change line 47:**
```typescript
// FROM:
name: E2E Test Tone

// TO (11 characters - respects 12-char schema limit AND 8-char device limit with truncation):
name: E2E Tone
```

**Change line 106:**
```typescript
// FROM:
name: E2E Test Tone

// TO:
name: E2E Tone
```

### 2. Verify Other Test Files

Checked files:
- `modules/roland-sxx0-editor/e2e/library-tones.spec.ts`: All tone names ≤12 chars ✓
  - "Basic Sine" (10 chars)
  - "Full Tone" (9 chars)
  - "Minimal Tone" (12 chars)
  - "Valid Tone" (10 chars)

- `modules/roland-sxx0-editor/e2e/library-patches.spec.ts`: All patch names ≤12 chars ✓
  - "Basic Patch" (11 chars)
  - "Multi Tone Patch" (15 chars) ⚠️ WARNING - **ALSO TOO LONG**
  - "Minimal Patch" (13 chars) ⚠️ WARNING - **ALSO TOO LONG**
  - "Full Patch" (10 chars)
  - "Sine Wave" (9 chars)

### 3. Additional Issues in library-patches.spec.ts

**Line 23: "Multi Tone Patch" - 15 characters ❌**
```typescript
// FROM:
name: "Multi Tone Patch"

// TO (12 characters):
name: "Multi Tone" (or "Multi Patch")
```

**Line 35: "Minimal Patch" - 13 characters ❌**
```typescript
// FROM:
name: "Minimal Patch"

// TO (12 characters):
name: "Min Patch"
```

## Implementation Notes

1. **Schema vs Device Constraints:**
   - The library schema uses 12-character max for both tones and patches
   - The actual S-330/S-550 device limits are:
     - Tones: 8 characters
     - Patches: 12 characters
   - The library schema is more permissive than the device, which is appropriate

2. **OPFS File Names:**
   - OPFS file names (e.g., `e2e-test-tone.yaml`) do NOT need to match YAML content names
   - File names use kebab-case convention
   - YAML `name` field is what gets validated against schema

3. **Import Validation:**
   - The error occurs during import, when the tone YAML is validated against the schema
   - Validation happens BEFORE the data is sent to the device
   - This explains why validation fails at 13 characters even though devices accept 8-char tones

## Files Requiring Changes

1. `/modules/roland-sxx0-editor/e2e/device-library-import.spec.ts`
   - Line 47: Change `"E2E Test Tone"` → `"E2E Tone"`
   - Line 106: Change `"E2E Test Tone"` → `"E2E Tone"`

2. `/modules/roland-sxx0-editor/e2e/library-patches.spec.ts`
   - Line 23: Change `"Multi Tone Patch"` → `"Multi Tone"` or shorter equivalent
   - Line 35: Change `"Minimal Patch"` → `"Min Patch"` or shorter equivalent

## Testing Strategy After Fix

1. Run device-library-import.spec.ts to verify tone import succeeds
2. Run library-patches.spec.ts to verify all patch validation passes
3. Verify OPFS library shows correct display names
4. Test import to actual device if available

## References

- Tone schema: `/modules/sampler-library/src/schemas/tone-schema.ts` (line 121)
- Patch schema: `/modules/sampler-library/src/schemas/patch-schema.ts` (line 95)
- Device limits: `/modules/sampler-devices/src/devices/roland-s-series/s-series-params.ts` (line 187, 631)
- Error context: `/modules/roland-sxx0-editor/test-results/device-library-import-Impo-43245-tone-from-library-to-device-chromium/error-context.md`
