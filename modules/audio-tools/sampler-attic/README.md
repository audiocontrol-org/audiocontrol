# Sampler Attic - Deferred Code Storage

**Version:** 0.0.1
**Status:** PRIVATE - NOT FOR DISTRIBUTION
**Created:** 2025-10-04
**Purpose:** Temporary storage for code pending refactoring

---

## Overview

This package stores code from `src-deprecated/` that has been deemed uncertain or requires significant refactoring before inclusion in the main packages. The code is preserved here for future reference and potential migration.

**Total Archived Code:** 22 files, 1,259 lines

---

## What Code is Stored

### 1. Web Interface Code (916 lines)

#### Next.js API Routes (493 lines)
14 Next.js route handlers that provided a web-based interface for sampler operations.

**Location in Attic:** `src/web/nextjs/`

**Original Files:**
- `src-deprecated/app/api/config/route.ts` → `src/web/nextjs/config/route.ts`
- `src-deprecated/app/api/config/save/route.ts` → `src/web/nextjs/config/save/route.ts`
- `src-deprecated/app/api/config/server/route.ts` → `src/web/nextjs/config/server/route.ts`
- `src-deprecated/app/api/t/akaidisk/route.ts` → `src/web/nextjs/t/akaidisk/route.ts`
- `src-deprecated/app/api/t/audiodata/[...path]/route.ts` → `src/web/nextjs/t/audiodata/[...path]/route.ts`
- `src-deprecated/app/api/t/cd/[...path]/route.ts` → `src/web/nextjs/t/cd/[...path]/route.ts`
- `src-deprecated/app/api/t/chop/route.ts` → `src/web/nextjs/t/chop/route.ts`
- `src-deprecated/app/api/t/list/[...path]/route.ts` → `src/web/nextjs/t/list/[...path]/route.ts`
- `src-deprecated/app/api/t/meta/[...path]/route.ts` → `src/web/nextjs/t/meta/[...path]/route.ts`
- `src-deprecated/app/api/t/mkdir/[...path]/route.ts` → `src/web/nextjs/t/mkdir/[...path]/route.ts`
- `src-deprecated/app/api/t/progress/route.ts` → `src/web/nextjs/t/progress/route.ts`
- `src-deprecated/app/api/t/rm/[...path]/route.ts` → `src/web/nextjs/t/rm/[...path]/route.ts`
- `src-deprecated/app/api/t/syncremote/route.ts` → `src/web/nextjs/t/syncremote/route.ts`
- `src-deprecated/app/api/t/translate/route.ts` → `src/web/nextjs/t/translate/route.ts`

#### Express Server (405 lines)
Alternative Express-based web server with orchestration logic.

**Location in Attic:** `src/web/express/`

**Original Files:**
- `src-deprecated/ts/app/server.ts` (159 lines) → `src/web/express/server.ts`
- `src-deprecated/ts/app/brain.ts` (193 lines) → `src/web/express/brain.ts`
- `src-deprecated/ts/app/api.ts` (10 lines) → `src/web/express/api.ts`
- `src-deprecated/lib/lib-session.ts` (43 lines) → `src/web/express/lib-session.ts`

#### UI Components/Styling (28 lines)
Material-UI theme and Next.js middleware.

**Location in Attic:** `src/web/ui/`

**Original Files:**
- `src-deprecated/theme.ts` (10 lines) → `src/web/ui/theme.ts`
- `src-deprecated/middleware.ts` (18 lines) → `src/web/ui/middleware.ts`

### 2. MIDI Code (331 lines)

**Location in Attic:** `src/midi/`

**Original Files:**
- `src-deprecated/midi/roland-jv-1080.ts` (331 lines) → `src/midi/roland-jv-1080.ts`

**Functionality:** Roland JV-1080 synthesizer MIDI device support

### 3. Uncertain Files (2 lines)

**Location in Attic:** `src/uncertain/`

**Original Files:**
- `src-deprecated/app/mapper/map-app.ts` (2 lines) → `src/uncertain/map-app.ts`

---

## Why Code Was Deferred

### Web Interface Code
**Reason:** Stack transition required
**Details:** The Next.js-based web interface needs to be refactored to use a Vite-based stack. This will be a separate project (`sampler-web-ui`) that consumes the CLI packages.

**Why Not Migrate Now:**
1. Next.js adds significant dependencies (React, Next.js framework)
2. Web interface is not essential for CLI/backup/export functionality
3. Better to refactor to Vite stack in dedicated project
4. UI framework choice should be reconsidered (React vs Vue vs Svelte)

**Future Plan:** Create `sampler-web-ui` package with Vite + modern UI framework

### Express Server Code
**Reason:** Uncertain if still in use
**Details:** Alternative web server implementation that may duplicate Next.js functionality.

**Questions:**
- Is this server actively used anywhere?
- Does it provide functionality not available in Next.js routes?
- Is it a legacy implementation that was superseded?

**Future Plan:** Investigate usage, then either migrate to packages or delete

### Roland JV-1080 Support
**Reason:** Uncertain if needed
**Details:** MIDI support for Roland JV-1080 synthesizer. Unclear if this is actively used or planned for future use.

**Questions:**
- Is JV-1080 support needed for the project?
- Are there users actively using this functionality?
- Should this be migrated to `sampler-midi` package?

**Future Plan:** Determine user need, then migrate or delete

### Uncertain Files
**Reason:** Stub/minimal code
**Details:** Files with minimal functionality that may be incomplete or obsolete.

---

## Dependencies and Relationships

### Web Code Dependencies
The web interface code has dependencies on:
- **Next.js** - App router, API routes
- **Express** - Alternative server implementation
- **Material-UI** - Theme and styling
- **Session management** - User sessions and state

### Internal Dependencies
The archived code references these (now-packaged) modules:
- `sampler-lib` - Core utilities and types
- `sampler-export` - Disk extraction functionality
- `sampler-translate` - Format conversion
- `sampler-backup` - Backup operations

### External Dependencies (Not in package.json)
The code expects these dependencies (not currently installed):
- `next` - Next.js framework
- `express` - Express web framework
- `@mui/material` - Material-UI components
- Various React libraries

---

## How to Extract Code

### For Web Interface Refactoring

#### Step 1: Create New Package
```bash
# Create dedicated web UI package
mkdir -p sampler-web-ui
cd sampler-web-ui
pnpm init
```

#### Step 2: Setup Vite Stack
```bash
# Install Vite and your chosen framework
pnpm add -D vite @vitejs/plugin-react  # or @vitejs/plugin-vue
```

#### Step 3: Extract API Logic
```bash
# Copy relevant business logic from Next.js routes
# Transform to work with Vite/fetch-based API calls
cp ../sampler-attic/src/web/nextjs/t/translate/route.ts ./src/api/translate.ts
```

#### Step 4: Refactor Express Logic
If needed, extract Express server orchestration:
```bash
cp ../sampler-attic/src/web/express/brain.ts ./src/orchestration/
```

### For MIDI Code Migration

If JV-1080 support is needed:

```bash
# Copy to sampler-midi package
cd sampler-midi
cp ../sampler-attic/src/midi/roland-jv-1080.ts ./src/devices/jv-1080.ts

# Update imports to use @/ pattern
# Add tests
# Update sampler-midi exports
```

---

## Refactoring Guidelines

### Web Code → Vite Migration

**Key Changes Needed:**
1. **Replace Next.js API Routes** with RESTful endpoints or tRPC
2. **Remove App Router dependencies** - use Vite routing instead
3. **Replace getServerSideProps** with client-side data fetching
4. **Update Material-UI theme** to work with Vite
5. **Replace Next.js middleware** with Vite middleware or Express

**Recommended Stack:**
- **Build Tool:** Vite
- **Framework:** React/Vue/Svelte (TBD)
- **Styling:** Tailwind CSS or continue with Material-UI
- **State Management:** Zustand or Pinia
- **API:** tRPC for type-safe end-to-end or REST with OpenAPI

### Express Server Evaluation

Before migrating, determine:
1. Is this server used anywhere?
   ```bash
   # Search for imports
   grep -r "ts/app/server" ../
   grep -r "Brain" ../
   ```

2. What unique functionality does it provide?
   - Review `brain.ts` orchestration logic
   - Compare with Next.js route functionality

3. Should it be preserved?
   - If YES: Migrate to dedicated server package
   - If NO: Delete from attic

### MIDI Code Migration

If migrating to `sampler-midi`:
1. Update imports to use workspace packages
2. Add comprehensive tests
3. Document device specifications
4. Add CLI commands if needed
5. Update package exports

---

## Testing Archived Code

**Important:** This code is NOT tested in the attic package. Tests should be written during migration.

### Web Code Testing
When migrating, create tests for:
- API endpoint functionality
- Server orchestration logic
- Session management
- Error handling

### MIDI Code Testing
When migrating, create tests for:
- Device initialization
- MIDI message handling
- SysEx parsing
- Error conditions

---

## File Organization

```
sampler-attic/
├── README.md                    # This file
├── ATTIC-NOTES.md              # Migration and refactoring notes
├── package.json                # Package config (private: true)
├── tsconfig.json               # TypeScript config
└── src/
    ├── web/                    # Web interface code (916 lines)
    │   ├── nextjs/            # Next.js API routes (493 lines)
    │   │   ├── config/        # Configuration endpoints
    │   │   └── t/             # Translator endpoints
    │   ├── express/           # Express server (405 lines)
    │   │   ├── server.ts      # Express app
    │   │   ├── brain.ts       # Orchestration
    │   │   ├── api.ts         # API definitions
    │   │   └── lib-session.ts # Session management
    │   └── ui/                # UI theme/middleware (28 lines)
    │       ├── theme.ts       # Material-UI theme
    │       └── middleware.ts  # Next.js middleware
    ├── midi/                   # MIDI device support (331 lines)
    │   └── roland-jv-1080.ts  # JV-1080 device
    └── uncertain/              # Uncertain/stub files (2 lines)
        └── map-app.ts         # Mapper stub
```

---

## Timeline and Next Steps

### Immediate (Phase 2)
- [x] Code archived to attic package
- [ ] Verify no active imports to archived code
- [ ] Document migration strategy

### Short Term (Phase 3-4)
- [ ] Decide on web UI approach (Vite refactor vs delete)
- [ ] Determine JV-1080 support needs
- [ ] Delete obsolete files from src-deprecated/

### Long Term (Future Phases)
- [ ] Create `sampler-web-ui` package (if needed)
- [ ] Migrate MIDI code to `sampler-midi` (if needed)
- [ ] Delete entire attic package when code migrated or obsoleted

---

## Package Status

**Build Status:** Configured but NOT built (TypeScript may not compile due to missing dependencies)
**Test Status:** No tests (not needed for archived code)
**Distribution:** PRIVATE - never to be published to npm
**Maintenance:** Minimal - only for preservation and reference

---

## Related Documentation

- [Phase 1 Deprecated Audit](../.claude/reports/phase1/phase1-deprecated-audit.md)
- [WORKPLAN-CLEANUP.md](../WORKPLAN-CLEANUP.md)
- [DISTRIBUTION.md](../DISTRIBUTION.md)

---

## Questions?

If you're considering extracting code from the attic, consult:
1. **Phase 1 Audit** - Original analysis and categorization
2. **ATTIC-NOTES.md** - Detailed refactoring guidance
3. **Project maintainer** - For decisions on web UI and MIDI support

---

**Last Updated:** 2025-10-04
**Maintained By:** architect-reviewer
**Review Frequency:** As needed during cleanup phases
