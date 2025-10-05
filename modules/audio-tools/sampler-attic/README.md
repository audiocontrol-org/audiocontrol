# Sampler Attic - Deferred Code Storage

**Version:** 0.0.1
**Status:** 🔒 PRIVATE - NOT FOR DISTRIBUTION
**Created:** 2025-10-04
**Purpose:** Temporary storage for code pending refactoring or future determination

---

## Overview

This package stores code from `src-deprecated/` that has been deemed **uncertain** or requires **significant refactoring** before inclusion in the main packages. The code is preserved here for future reference and potential migration.

**⚠️ IMPORTANT:** This is a **private package** (`"private": true` in package.json) and will **NEVER be published to npm**. It serves solely as an archive for deferred code decisions.

**Total Archived Code:** 22 files, 1,259 lines

---

## What's Stored and Why

### 1. Web Interface Code (916 lines)

**Why Deferred:** Requires stack transition from Next.js to Vite-based framework

The web interface code was built with Next.js App Router but needs a complete refactor to:
1. Reduce dependencies (Next.js → Vite)
2. Improve developer experience (faster HMR, better tooling)
3. Enable framework flexibility (React vs Vue vs Svelte decision needed)
4. Modernize build tooling (ESM-first, better tree-shaking)

**Future Plan:** Create separate `sampler-web-ui` package with Vite stack

#### Next.js API Routes (493 lines)

**Location in Attic:** `src/web/nextjs/`

14 Next.js route handlers that provided a web-based interface for sampler operations:

**Configuration Routes** (3 files, 22 lines):
- `config/route.ts` - GET configuration
- `config/save/route.ts` - POST save configuration
- `config/server/route.ts` - GET server configuration

**Translator/Operations Routes** (11 files, 471 lines):
- `t/akaidisk/route.ts` - Read Akai disk images
- `t/audiodata/[...path]/route.ts` - Get audio sample data
- `t/cd/[...path]/route.ts` - Change directory navigation
- `t/chop/route.ts` - Chop/split audio samples
- `t/list/[...path]/route.ts` - List disk files/directories
- `t/meta/[...path]/route.ts` - Get file metadata
- `t/mkdir/[...path]/route.ts` - Create directories
- `t/progress/route.ts` - Track operation progress
- `t/rm/[...path]/route.ts` - Remove files/directories
- `t/syncremote/route.ts` - Sync with remote sampler
- `t/translate/route.ts` - Translate between sampler formats

**Original File Locations:**
```
src-deprecated/app/api/config/route.ts → src/web/nextjs/config/route.ts
src-deprecated/app/api/config/save/route.ts → src/web/nextjs/config/save/route.ts
src-deprecated/app/api/config/server/route.ts → src/web/nextjs/config/server/route.ts
src-deprecated/app/api/t/akaidisk/route.ts → src/web/nextjs/t/akaidisk/route.ts
src-deprecated/app/api/t/audiodata/[...path]/route.ts → src/web/nextjs/t/audiodata/[...path]/route.ts
src-deprecated/app/api/t/cd/[...path]/route.ts → src/web/nextjs/t/cd/[...path]/route.ts
src-deprecated/app/api/t/chop/route.ts → src/web/nextjs/t/chop/route.ts
src-deprecated/app/api/t/list/[...path]/route.ts → src/web/nextjs/t/list/[...path]/route.ts
src-deprecated/app/api/t/meta/[...path]/route.ts → src/web/nextjs/t/meta/[...path]/route.ts
src-deprecated/app/api/t/mkdir/[...path]/route.ts → src/web/nextjs/t/mkdir/[...path]/route.ts
src-deprecated/app/api/t/progress/route.ts → src/web/nextjs/t/progress/route.ts
src-deprecated/app/api/t/rm/[...path]/route.ts → src/web/nextjs/t/rm/[...path]/route.ts
src-deprecated/app/api/t/syncremote/route.ts → src/web/nextjs/t/syncremote/route.ts
src-deprecated/app/api/t/translate/route.ts → src/web/nextjs/t/translate/route.ts
```

#### Express Server (405 lines)

**Location in Attic:** `src/web/express/`

Alternative Express-based web server with orchestration logic.

**Files:**
- `server.ts` (159 lines) - Express app setup and routing
- `brain.ts` (193 lines) - Orchestration layer coordinating multiple services
- `api.ts` (10 lines) - API route definitions/types
- `lib-session.ts` (43 lines) - Session management utilities

**Status:** **UNCERTAIN** - May duplicate Next.js functionality

**Questions to Resolve:**
- Is this server actively used anywhere?
- Does it provide functionality not available in Next.js routes?
- Is it a legacy implementation that was superseded?

**Original File Locations:**
```
src-deprecated/ts/app/server.ts → src/web/express/server.ts
src-deprecated/ts/app/brain.ts → src/web/express/brain.ts
src-deprecated/ts/app/api.ts → src/web/express/api.ts
src-deprecated/lib/lib-session.ts → src/web/express/lib-session.ts
```

**Migration Strategy:** Investigate usage first, then either:
1. **If still used:** Migrate to dedicated server package
2. **If obsolete:** Delete from attic

#### UI Components/Styling (28 lines)

**Location in Attic:** `src/web/ui/`

Material-UI theme and Next.js middleware for web interface.

**Files:**
- `theme.ts` (10 lines) - Material-UI theme configuration
- `middleware.ts` (18 lines) - Next.js request interception middleware

**Original File Locations:**
```
src-deprecated/theme.ts → src/web/ui/theme.ts
src-deprecated/middleware.ts → src/web/ui/middleware.ts
```

---

### 2. MIDI Code (331 lines)

**Why Deferred:** Uncertain if Roland JV-1080 support is needed for project scope

**Location in Attic:** `src/midi/`

**File:** `roland-jv-1080.ts` (331 lines) - MIDI device implementation for Roland JV-1080 synthesizer

**Functionality:**
- Send/receive SysEx messages
- Request patch data from JV-1080
- Parse patch data structures
- MIDI communication with Roland devices

**Questions to Resolve:**
- Is JV-1080 support needed for the project?
- Are there users actively using this functionality?
- Should this be migrated to `sampler-midi` package?
- Or is it out of scope (project focuses on Akai samplers)?

**Original File Location:**
```
src-deprecated/midi/roland-jv-1080.ts → src/midi/roland-jv-1080.ts
```

**Migration Options:**
1. **If needed:** Migrate to `sampler-midi/src/devices/jv-1080.ts`
2. **If out of scope:** Delete from attic
3. **If uncertain:** Keep in attic pending user feedback

---

### 3. Uncertain Files (2 lines)

**Why Deferred:** Stub/minimal code with unclear purpose

**Location in Attic:** `src/uncertain/`

**File:** `map-app.ts` (2 lines) - Minimal stub file, possibly incomplete

**Original File Location:**
```
src-deprecated/app/mapper/map-app.ts → src/uncertain/map-app.ts
```

**Migration Strategy:** Review purpose, then either implement properly or delete

---

## Original File Locations

All files were migrated from `src-deprecated/` during Phase 2 cleanup (2025-10-04).

**Full migration mapping** is documented in:
- This README (above sections)
- `ATTIC-NOTES.md` (detailed refactoring notes)
- Git archive: `archive/src-deprecated-2025-10-04` branch

**Accessing Original Code:**
```bash
# View archived original code
git checkout archive/src-deprecated-2025-10-04

# Or use git show for specific files
git show archive-deprecated-2025-10-04:src-deprecated/path/to/file.ts
```

---

## Future Refactoring Plans

### Web Interface → Vite Stack

**Target:** Create `sampler-web-ui` package (new repository or monorepo package)

**Stack Recommendation:** Vite + React + tRPC

**Why:**
- Smaller bundle than Next.js
- Faster development with HMR
- End-to-end type safety with tRPC
- Team likely familiar with React
- Can add Electron later for desktop app

**Timeline:** Future phase (post-cleanup, pre-distribution)

**Migration Steps:**
1. Create `sampler-web-ui` package
2. Set up Vite + React + tRPC
3. Extract API logic from Next.js routes → tRPC procedures
4. Convert Express orchestration → service layer pattern
5. Port UI components (or redesign with Tailwind CSS)
6. Add comprehensive tests
7. Delete web code from attic

**Detailed migration guidance:** See `ATTIC-NOTES.md` sections:
- Web Code Migration Strategy
- Converting Next.js Routes to tRPC
- Express Server Analysis

### MIDI Code → sampler-midi Package

**Condition:** IF JV-1080 support is determined to be needed

**Migration Steps:**
1. Verify user need and project scope alignment
2. Copy `src/midi/roland-jv-1080.ts` → `sampler-midi/src/devices/jv-1080.ts`
3. Update imports to use `@/` pattern
4. Align with current `DeviceInterface` pattern
5. Add comprehensive tests (80%+ coverage)
6. Update `sampler-midi` package exports
7. Add CLI commands (optional)
8. Document device specifications
9. Delete from attic

**Detailed migration guidance:** See `ATTIC-NOTES.md` section: MIDI Code Migration

### Express Server → Investigate or Delete

**Next Steps:**
1. Search codebase for active usage:
   ```bash
   grep -r "ts/app/server" ../
   grep -r "Brain" ../
   grep -r "localhost:3000" ../
   ```
2. Review `brain.ts` for unique orchestration logic
3. Compare with Next.js route functionality
4. **Decision:**
   - **If unique functionality exists:** Extract to service layer
   - **If duplicates Next.js:** Delete from attic

---

## How to Extract Code When Needed

### General Extraction Pattern

```bash
# 1. Copy file to target package
cp sampler-attic/src/[category]/[file].ts [target-package]/src/[new-location]/[file].ts

# 2. Update imports
# Change to @/ pattern and workspace packages
# OLD: import { foo } from '../../../lib/bar'
# NEW: import { foo } from '@/lib/bar'
# OR:  import { foo } from '@oletizi/sampler-lib'

# 3. Refactor to current architecture
# - Interface-first design
# - Dependency injection
# - Factory functions (not classes)
# - TypeScript strict mode

# 4. Add tests
# Create [target-package]/test/unit/[file].test.ts
# Achieve 80%+ coverage

# 5. Update package exports
# Add to [target-package]/src/index.ts

# 6. Verify build and tests
cd [target-package]
pnpm build
pnpm test

# 7. Delete from attic
rm sampler-attic/src/[category]/[file].ts
# Update this README to mark as migrated
```

### Web Code Extraction (Next.js → Vite)

**Example: Migrating translate route to tRPC**

```bash
# 1. Create new package structure
mkdir -p sampler-web-ui/server/routers
mkdir -p sampler-web-ui/client

# 2. Install dependencies
cd sampler-web-ui
pnpm add vite @vitejs/plugin-react
pnpm add @trpc/server @trpc/client
pnpm add @oletizi/sampler-export @oletizi/sampler-translate

# 3. Convert Next.js route to tRPC
# See ATTIC-NOTES.md for detailed conversion examples

# 4. Set up Vite config
# Create vite.config.ts with React plugin

# 5. Test API endpoints
pnpm test

# 6. Delete from attic when complete
```

**Detailed conversion examples:** See `ATTIC-NOTES.md` section: Converting Next.js Routes to tRPC

### MIDI Code Extraction (to sampler-midi)

**Example: Migrating JV-1080 device**

```bash
# 1. Copy to sampler-midi
cd sampler-midi/src/devices
cp ../../sampler-attic/src/midi/roland-jv-1080.ts ./jv-1080.ts

# 2. Update imports
# Change: import { MIDIDevice } from '@/midi/device'
# To:     import { DeviceInterface } from '@/types'

# 3. Refactor to match current architecture
# - Use factory function: createJV1080(config)
# - Implement DeviceInterface
# - Add dependency injection

# 4. Add comprehensive tests
# Create test/devices/jv-1080.test.ts

# 5. Update package exports
# Add to src/index.ts:
# export { createJV1080 } from '@/devices/jv-1080';

# 6. Build and test
pnpm build
pnpm test

# 7. Delete from attic
rm ../../sampler-attic/src/midi/roland-jv-1080.ts
```

**Detailed migration guidance:** See `ATTIC-NOTES.md` section: MIDI Code Migration

---

## Dependencies and Relationships

### External Dependencies (Not Installed)

The archived code expects these dependencies (currently NOT in package.json):

**Web Interface:**
- `next` - Next.js framework
- `@vercel/edge` - Edge runtime
- `express` - Express web framework
- `@mui/material` - Material-UI components
- `cors`, `helmet` - Express middleware
- React and related libraries

**MIDI:**
- `webmidi` or `node-midi` - MIDI communication

**Note:** These dependencies are NOT installed in the attic package. They would be added when migrating code to active packages.

### Internal Dependencies (Already in Packages)

The archived code references these modules (now properly packaged):

- `@oletizi/sampler-lib` - Core utilities and types
- `@oletizi/sampler-export` - Disk extraction functionality
- `@oletizi/sampler-translate` - Format conversion
- `@oletizi/sampler-backup` - Backup operations
- `@oletizi/sampler-devices` - Device abstractions
- `@oletizi/sampler-midi` - MIDI communication

**Migration Impact:** When extracting code, update imports to use workspace packages.

### Reverse Dependencies (Should Be None)

**Expected:** No active code should import from sampler-attic

**Verification:**
```bash
# Search for imports from attic
grep -r "sampler-attic" ../sampler-*/src/ ../lib-runtime/src/

# Expected output: No matches (attic is isolated)
```

**If found:** Those are blocking dependencies that must be resolved before migration.

---

## Contributing

### When to Add Code to Attic

**Criteria for attic storage:**
1. Code is uncertain but potentially valuable
2. Code requires significant refactoring before use
3. Code depends on unresolved architectural decisions
4. Code is out of scope but may be needed later

**DO NOT add to attic:**
- Obsolete code (delete it)
- Clear migrations (migrate directly to packages)
- Duplicate functionality (delete it)

### When to Extract Code from Attic

**Triggers for extraction:**
1. Architectural decision made (e.g., Vite stack chosen)
2. User need confirmed (e.g., JV-1080 support requested)
3. Functionality required for features
4. Code review determines it's needed

**Process:**
1. Follow extraction steps in "How to Extract Code When Needed"
2. Ensure all quality gates met (tests, TypeScript strict, etc.)
3. Delete from attic when successfully migrated
4. Update this README to reflect migration

### Attic Maintenance

**Regular reviews:**
- Every 3 months: Review attic contents
- Decide: Migrate, keep, or delete each file
- Update this README with decisions

**Success criteria:**
- Attic should shrink over time
- Goal: Empty attic (all code migrated or deleted)

---

## File Organization

```
sampler-attic/
├── README.md                    # This file - What's stored and why
├── ATTIC-NOTES.md              # Detailed refactoring guidance (779 lines)
├── package.json                # Package config (private: true)
├── tsconfig.json               # TypeScript config
└── src/
    ├── web/                    # Web interface code (916 lines)
    │   ├── nextjs/            # Next.js API routes (493 lines)
    │   │   ├── config/        # Configuration endpoints (3 files)
    │   │   │   ├── route.ts
    │   │   │   ├── save/route.ts
    │   │   │   └── server/route.ts
    │   │   └── t/             # Translator/operations endpoints (11 files)
    │   │       ├── akaidisk/route.ts
    │   │       ├── audiodata/[...path]/route.ts
    │   │       ├── cd/[...path]/route.ts
    │   │       ├── chop/route.ts
    │   │       ├── list/[...path]/route.ts
    │   │       ├── meta/[...path]/route.ts
    │   │       ├── mkdir/[...path]/route.ts
    │   │       ├── progress/route.ts
    │   │       ├── rm/[...path]/route.ts
    │   │       ├── syncremote/route.ts
    │   │       └── translate/route.ts
    │   ├── express/           # Express server (405 lines)
    │   │   ├── server.ts      # Express app (159 lines)
    │   │   ├── brain.ts       # Orchestration layer (193 lines)
    │   │   ├── api.ts         # API definitions (10 lines)
    │   │   └── lib-session.ts # Session management (43 lines)
    │   └── ui/                # UI theme/middleware (28 lines)
    │       ├── theme.ts       # Material-UI theme (10 lines)
    │       └── middleware.ts  # Next.js middleware (18 lines)
    ├── midi/                   # MIDI device support (331 lines)
    │   └── roland-jv-1080.ts  # Roland JV-1080 synthesizer
    └── uncertain/              # Uncertain/stub files (2 lines)
        └── map-app.ts         # Mapper stub (unclear purpose)
```

---

## Package Status

**Build Status:** ⚠️ Configured but NOT built (TypeScript may not compile due to missing dependencies)
**Test Status:** ❌ No tests (not needed for archived code)
**Distribution:** 🔒 PRIVATE - **NEVER** to be published to npm
**Maintenance:** Minimal - preservation and reference only

**Purpose:** This package is NOT meant to be built or run. It serves solely as an archive for code pending future decisions.

---

## Timeline and Next Steps

### Immediate (Phase 2) - ✅ COMPLETE
- [x] Code archived to attic package
- [x] Comprehensive documentation created
- [x] Migration strategy documented
- [x] src-deprecated/ eliminated

### Short Term (Phase 3-5)
- [ ] Verify no active imports to archived code
- [ ] Decide on web UI approach (Vite refactor vs delete)
- [ ] Determine JV-1080 support needs (user feedback required)
- [ ] Investigate Express server usage (active or obsolete?)

### Long Term (Future Phases)
- [ ] Create `sampler-web-ui` package (if web interface needed)
- [ ] Migrate MIDI code to `sampler-midi` (if JV-1080 support needed)
- [ ] Extract Express orchestration (if unique functionality identified)
- [ ] **Delete entire attic package** when all code migrated or obsoleted

**Ultimate Goal:** Empty attic = all architectural decisions resolved

---

## Related Documentation

**Project Documentation:**
- [WORKPLAN-CLEANUP.md](../WORKPLAN-CLEANUP.md) - Overall cleanup plan
- [DISTRIBUTION.md](../DISTRIBUTION.md) - Distribution strategy
- [Phase 1 Audit](../.claude/reports/phase1/phase1-deprecated-audit.md) - Original analysis

**Attic-Specific Documentation:**
- [ATTIC-NOTES.md](./ATTIC-NOTES.md) - **Detailed refactoring guidance** (779 lines)
  - Web code migration strategy
  - Next.js → Vite conversion examples
  - Express server analysis
  - MIDI device migration guide
  - Code conversion patterns
  - Decision matrices

**Archive Access:**
- Git branch: `archive/src-deprecated-2025-10-04`
- Git tag: `archive-deprecated-2025-10-04`

---

## Questions?

### Before Extracting Code

Consult these resources:
1. **ATTIC-NOTES.md** - Detailed migration guidance and examples
2. **Phase 1 Audit** - Original categorization and analysis
3. **Project maintainer** - For architectural decisions
4. **WORKPLAN-CLEANUP.md** - Task 5.1 for README standards

### Key Decisions Needed

**Web Interface:**
- Which framework? (Vite + React recommended)
- Web app or desktop app? (Electron option)
- tRPC or REST API? (tRPC recommended for type safety)

**MIDI Support:**
- Is JV-1080 support in scope?
- Are there active users?
- Priority level?

**Express Server:**
- Is it actively used?
- Does it have unique functionality?
- Migrate or delete?

---

**Last Updated:** 2025-10-04
**Created By:** typescript-pro (Phase 2, Task 2.0)
**Enhanced By:** documentation-engineer (Phase 5, Task 5.1)
**Maintained By:** architect-reviewer
**Review Frequency:** Every 3 months or as needed during cleanup phases

---

**Remember:** This attic is temporary. The goal is **zero files** - all code either migrated to active packages or confirmed obsolete and deleted.
