# Changelog

## 1.0.0-alpha.40

### Patch Changes

- Sync sampler-attic version with other packages

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2025-10-04

### Added

- **Attic package created** to preserve code for future refactoring
- **Web interface code** (916 lines) - Deferred for Vite stack refactoring
  - Next.js API routes (14 files from `app/api/`)
  - Express server implementation (`ts/app/server.ts`, `ts/app/brain.ts`, `ts/app/api.ts`)
  - Session management (`lib/lib-session.ts`)
  - UI components and theme (`theme.ts`, `middleware.ts`)
- **Roland JV-1080 MIDI support** (331 lines) - Uncertain if needed, preserved for potential future use
  - Full sysex implementation for JV-1080
  - Preserved from `src-deprecated/midi/roland-jv-1080.ts`
- **Comprehensive documentation**
  - README.md (338 lines) - Documents all stored code with reasoning
  - ATTIC-NOTES.md (779 lines) - Refactoring guidance and migration notes

### Structure

```
sampler-attic/
├── src/web/          # 20 files (926 lines) - Web interface code
│   ├── nextjs/      # Next.js API routes
│   ├── express/     # Express server
│   └── ui/          # UI components/theme
├── src/midi/         # 1 file (331 lines) - JV-1080 support
└── src/uncertain/    # 1 file (2 lines) - Other uncertain files
```

## ⚠️ Important Notice

**THIS PACKAGE IS NOT FOR DISTRIBUTION**

This is a private archive package (`"private": true`) containing code that:

- Is **deferred for future refactoring** (web interface → Vite stack)
- Has **uncertain need** (JV-1080 support)
- Should **NOT be manually edited** (will be extracted or discarded)

### What's Stored Here

#### 1. Web Interface Code (926 lines)

**Reason for storage**: Will be refactored to Vite stack in separate `sampler-web-ui` project

**Contents**:

- Next.js API routes for sampler interaction
- Express server for legacy compatibility
- Session management and UI components

**Future plan**: Extract and refactor to modern Vite + React stack

#### 2. Roland JV-1080 MIDI Support (331 lines)

**Reason for storage**: Uncertain if needed, preserved for potential future use

**Contents**:

- Complete sysex implementation for Roland JV-1080 synthesizer
- MIDI parameter control
- Device communication protocols

**Future plan**: Determine if JV-1080 support is needed, then either:

- Integrate into `sampler-midi` package
- Create separate `roland-jv-1080` package
- Discard if not needed

#### 3. Other Uncertain Files (2 lines)

**Reason for storage**: Need more investigation before migration or deletion

**Future plan**: Investigate and migrate or delete

### How to Use This Attic

#### Extracting Code

If you need code from the attic:

```bash
# 1. Copy the file(s) to appropriate package
cp sampler-attic/src/web/nextjs/route.ts target-package/src/

# 2. Refactor for current architecture
#    - Update imports to use @/ pattern
#    - Add TypeScript strict mode compliance
#    - Add tests (80%+ coverage)
#    - Add JSDoc documentation

# 3. Delete from attic
rm sampler-attic/src/web/nextjs/route.ts

# 4. Update ATTIC-NOTES.md
#    - Document extraction
#    - Update migration status
```

#### When to Extract vs Discard

**Extract if**:

- Functionality is needed in production
- Code provides unique value
- Can be refactored to meet quality standards

**Discard if**:

- Functionality no longer needed
- Better implementation exists
- Code is obsolete or redundant

### Original File Locations

All files in this attic came from `src-deprecated/`:

| Attic Path                   | Original Path                           | Lines | Reason              |
| ---------------------------- | --------------------------------------- | ----- | ------------------- |
| `src/web/nextjs/*`           | `src-deprecated/app/api/*`              | 600   | Web refactor        |
| `src/web/express/*`          | `src-deprecated/ts/app/*`               | 405   | Web refactor        |
| `src/web/ui/*`               | `src-deprecated/theme.ts`, etc.         | 20    | Web refactor        |
| `src/midi/roland-jv-1080.ts` | `src-deprecated/midi/roland-jv-1080.ts` | 331   | Uncertain need      |
| `src/uncertain/*`            | Various                                 | 2     | Needs investigation |

### Archive History

- **Created**: 2025-10-04 (Phase 2 of cleanup work)
- **Source**: `src-deprecated/` directory
- **Archive branch**: `archive/src-deprecated-2025-10-04`
- **Archive tag**: `archive-deprecated-2025-10-04`

To view original archived code:

```bash
git checkout archive/src-deprecated-2025-10-04
# or
git show archive-deprecated-2025-10-04:src-deprecated/path/to/file.ts
```

### Documentation

- **README.md** - Complete documentation of stored code
- **ATTIC-NOTES.md** - Refactoring guidance and future plans
- **CHANGELOG.md** - This file, tracking attic changes

### Package Configuration

```json
{
  "name": "@oletizi/sampler-attic",
  "version": "0.0.1",
  "private": true, // NOT for npm distribution
  "description": "Archive of deferred/uncertain code for future refactoring"
}
```

## Future Refactoring Plans

### Web Interface (Priority 1)

1. Create new `sampler-web-ui` project
2. Set up Vite + React stack
3. Extract and refactor Next.js routes to Vite API
4. Extract and refactor UI components
5. Migrate session management
6. Delete web code from attic
7. Archive or delete Express server code

### JV-1080 Support (Priority 2)

1. Determine if JV-1080 support is needed
2. If yes: Refactor to meet current architecture standards
3. If yes: Add to `sampler-midi` or create separate package
4. If yes: Add comprehensive tests (80%+ coverage)
5. If no: Delete from attic
6. Update ATTIC-NOTES.md with decision

### Uncertain Files (Priority 3)

1. Investigate each file's purpose
2. Determine migration target or obsolescence
3. Extract and refactor OR delete
4. Document decision

## Versioning Strategy

This package uses minimal versioning:

- **0.0.1** - Initial attic creation
- **Will NOT be published to npm** (`private: true`)
- **Version bumps** only when attic structure changes significantly

---

[0.0.1]: https://github.com/oletizi/audio-tools/releases/tag/sampler-attic-v0.0.1
