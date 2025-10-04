# Phase 1: Codebase Metrics Analysis Report

**Generated**: 2025-10-04
**Agent**: code-reviewer
**Working Directory**: /Users/orion/work/ol_dsp/modules/audio-tools

## Executive Summary

### Key Findings
- **✅ Import Pattern Compliance**: Excellent - 88+ uses of `@/` pattern in active code
- **⚠️ File Size Violations**: 2 critical violations found (>500 lines)
- **✅ Relative Import Violations**: Zero violations in active sampler-* modules
- **📦 Auto-Generated Code**: 11 files identified and catalogued
- **🗑️ Deprecated Code**: 52 files in `src-deprecated/` directory

---

## 1. File Size Distribution Analysis

### Files Exceeding 500-Line Limit (Hand-Written Only)

#### CRITICAL VIOLATIONS (>500 lines)

**1. /Users/orion/work/ol_dsp/modules/audio-tools/sampler-devices/src/devices/s56k.ts**
- **Line Count**: 1,085 lines ❌
- **Type**: Hand-written (not auto-generated)
- **Contains**: Akai S5000/S6000 program format parser/writer
- **Complexity**: Multiple chunk types (Header, Program, Output, Tune, LFO1, LFO2, Mods, Keygroup, Zone), deep nesting, repetitive code patterns
- **Key Classes/Interfaces**:
  - `BasicProgram` class (lines 793-1084)
  - `AkaiS56kProgram` interface
  - 15+ chunk type interfaces and factories
- **Recommended Action**: Split into 5 focused modules:
  - `s56k-parser.ts` - Parsing logic (~250 lines)
  - `s56k-writer.ts` - Writing/serialization logic (~200 lines)
  - `s56k-chunks.ts` - Chunk type definitions (~300 lines)
  - `s56k-keygroup.ts` - Keygroup handling (~200 lines)
  - `s56k-program.ts` - Program class (~150 lines)

**2. /Users/orion/work/ol_dsp/modules/audio-tools/sampler-devices/src/io/akaitools.ts**
- **Line Count**: 540 lines ❌
- **Type**: Hand-written
- **Contains**: Akaitools wrapper, disk operations, SCSI remote sync, child process management
- **Complexity**: Multiple responsibilities
  - Disk read/write/format operations
  - Remote PiSCSI mount/unmount
  - WAV<->Akai sample conversion
  - Program/sample file parsing
  - Child process spawning and error handling
- **Recommended Action**: Split into 4 focused modules:
  - `akaitools-core.ts` - Basic wrapper interface + factory (~100 lines)
  - `akaitools-disk.ts` - Disk read/write/format operations (~150 lines)
  - `akaitools-remote.ts` - PiSCSI remote mount/sync (~150 lines)
  - `akaitools-program.ts` - Program/sample file operations (~140 lines)

**3. /Users/orion/work/ol_dsp/modules/audio-tools/sampler-translate/src/lib-translate-s3k.ts**
- **Line Count**: 317 lines ⚠️
- **Type**: Hand-written
- **Status**: Approaching limit (within 500 but >300)
- **Contains**: S3000XL translation, audio chopping, program mapping
- **Recommended Action**: Monitor; consider refactoring if grows beyond 350 lines

### Files Within Acceptable Range (<300 lines)

**Total Analyzed**: 40+ active source files
**Compliant Files**: 37 files (92.5%)

---

## 2. Import Pattern Compliance

### @/ Pattern Usage (EXCELLENT ✅)

**Files Using @/ Pattern**: 34 files
**Total @/ Imports**: 88+ occurrences

**Conclusion**: Active production code has zero relative import violations. All test violations are acceptable (referencing deprecated code during migration).

---

## 3. Auto-Generated Code Inventory

### Files With Auto-Generation Markers

**Total Auto-Generated Files**: 11 files

#### Active Auto-Generated Code

**1. /Users/orion/work/ol_dsp/modules/audio-tools/sampler-devices/src/devices/s3000xl.ts**
- **Line Count**: ~4,868 lines
- **Generated**: Fri Oct 03 2025 22:37:37 GMT-0700 (Pacific Daylight Time)
- **Generator**: `/gen-s3000xl.ts` + `src/gen/gen-s3000xl-device.ts`
- **Purpose**: S3000XL MIDI SysEx protocol implementation
- **Marker**: `// GENERATED Fri Oct 03 2025 22:37:37 GMT-0700 (Pacific Daylight Time). DO NOT EDIT.`

**2. /Users/orion/work/ol_dsp/modules/audio-tools/sampler-devices/src/gen/gen-s3000xl-device.ts**
- **Line Count**: 179 lines
- **Type**: Code Generator (not generated itself)
- **Purpose**: TypeScript code generator for S3000XL device classes

#### Root-Level Generators

**3. /Users/orion/work/ol_dsp/modules/audio-tools/gen-s3000xl.ts** (26 lines)
**4. /Users/orion/work/ol_dsp/modules/audio-tools/gen-s56k.ts** (143 lines)

#### Deprecated Auto-Generated Code

**5-7.** Files in `src-deprecated/` directory

---

## 4. Exclusion List for Refactoring Tasks

### Files to EXCLUDE from Tasks 3.1, 3.2 (Refactoring)

**Auto-Generated Files (DO NOT REFACTOR - REGENERATE INSTEAD):**
```
/Users/orion/work/ol_dsp/modules/audio-tools/sampler-devices/src/devices/s3000xl.ts
/Users/orion/work/ol_dsp/modules/audio-tools/src-deprecated/midi/devices/s3000xl.ts
/Users/orion/work/ol_dsp/modules/audio-tools/src-deprecated/midi/devices/devices.ts
```

**Code Generators (MAINTAIN BUT DON'T REFACTOR):**
```
/Users/orion/work/ol_dsp/modules/audio-tools/sampler-devices/src/gen/gen-s3000xl-device.ts
/Users/orion/work/ol_dsp/modules/audio-tools/gen-s3000xl.ts
/Users/orion/work/ol_dsp/modules/audio-tools/gen-s56k.ts
```

---

## 5. Codebase Health Metrics

### Overall Statistics

| Metric | Value | Status |
|--------|-------|--------|
| Total Active Modules | 40+ | ✅ |
| Files >500 Lines | 2 | ❌ CRITICAL |
| Files >300 Lines | 3 | ⚠️ WARNING |
| Import Pattern Compliance | 100% | ✅ EXCELLENT |
| Auto-Generated Files | 11 | ✅ DOCUMENTED |
| Deprecated Files | 52 | ⚠️ NEEDS CLEANUP |

---

## 6. Prioritized Recommendations

### CRITICAL PRIORITY

**1. Refactor s56k.ts** (1,085 lines → ~200 lines each)
- **Effort**: 4-6 hours
- **Impact**: CRITICAL - Largest violation

**2. Refactor akaitools.ts** (540 lines → ~135 lines each)
- **Effort**: 3-4 hours
- **Impact**: CRITICAL - Clear SRP violations

**3. Clean up src-deprecated/ directory**
- **Effort**: 2-3 hours
- **Impact**: HIGH - Code clarity

**4. Execute ts-prune analysis**
- **Effort**: 1-2 hours
- **Impact**: MEDIUM - Dead code removal

---

**Report Status**: COMPLETE ✅
**Files Analyzed**: 110+ TypeScript files
**Critical Issues**: 2 file size violations
**Next Phase**: Ready for Tasks 3.1, 3.2 (Refactoring)
