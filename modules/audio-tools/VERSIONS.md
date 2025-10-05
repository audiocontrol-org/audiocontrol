# Versioning History

## Why is the version at 7.0.0?

The audio-tools monorepo uses semantic versioning, and the current v7.0.0 reflects **aggressive major version bumping during active refactoring**, not the age or maturity of the codebase.

## Version Timeline

All major version changes happened within ~1 hour on **October 3, 2025** during intensive cleanup:

| Version | Date/Time | Changes | Reason |
|---------|-----------|---------|--------|
| 0.0.19 | Pre-Oct 3 | Initial development | Pre-cleanup baseline |
| 2.0.0 | Oct 3, 22:51 | S3000XL code generation refactoring | Breaking API changes (skipped v1.0.0) |
| 6.0.0 | Oct 3, 23:46 | Moved S3000XL wrappers `sampler-devices` → `sampler-midi` | Breaking import paths |
| 7.0.0 | Oct 3, 23:48 | Final publish with comprehensive docs | Release milestone |

Between v2.0.0 and v6.0.0, there were only **4 commits** but the version jumped **4 major versions**. Each breaking change during refactoring received its own major version bump.

## What Each Version Represented

### v0.0.19 (Pre-cleanup)
- Original code with `src-deprecated/` directory
- Mixed mocha+chai tests
- Large monolithic files (1000+ lines)

### v2.0.0 (Oct 3, 22:51)
- **Breaking**: S3000XL code generation refactored
- Generated code moved from inline to separate modules
- Skipped v1.0.0 entirely

### v3.0.0 - v5.0.0 (Oct 3, ~23:00-23:30)
- Intermediate refactoring steps
- Dependency updates and test framework migration
- Breaking changes to internal module structure

### v6.0.0 (Oct 3, 23:46)
- **Breaking**: Moved S3000XL wrapper classes from `sampler-devices` to `sampler-midi`
- Import path changes: `@/devices/s3000xl` → different module
- Workspace dependency updates

### v7.0.0 (Oct 3, 23:48)
- **Breaking**: Comprehensive refactoring completion
  - Large files split (1,085 lines → 7 focused modules max 397 lines)
  - Test framework migration (mocha+chai → vitest)
  - Deleted all `src-deprecated/` code
  - Comprehensive CHANGELOG.md files added
  - Full JSDoc/TSDoc documentation
- Official release milestone

## Why Such Aggressive Versioning?

### Technical Reasons
1. **Strict Semver Adherence**: Every breaking API change = major version bump
2. **Monorepo Synchronization**: All packages bumped together for consistency
3. **No Pre-release Versions**: Used major versions instead of v2.0.0-alpha.1, etc.
4. **Breaking Changes by Default**: Project guidelines explicitly state "Break backwards compatibility by default unless explicitly required" (.claude/CLAUDE.md)

### Development Context
The versioning reflects the **"Code Cleanup" phase** before wider distribution:

From sampler-attic/CHANGELOG.md:
```
THIS PACKAGE IS NOT FOR DISTRIBUTION
This is a private archive package containing code that is deferred for future refactoring
```

The project was aggressively refactored to meet quality standards before public release, with each breaking change receiving a proper major version bump rather than using pre-release versions or staying in v0.x.x.

## Comparison to Typical Versioning

### Typical Approach for New Projects
```
v0.1.0 → v0.2.0 → v0.5.0 → v1.0.0 (first stable)
```
- Stay in v0.x.x during heavy development
- Use v1.0.0 for "stable API" declaration
- Timeline: months to years

### This Project's Approach
```
v0.0.19 → v2.0.0 → v6.0.0 → v7.0.0 (first release)
```
- Major version for every breaking change
- v7.0.0 represents "stable, ready for distribution"
- Timeline: hours during intensive refactoring session

## Package-Specific Versions

Not all packages are at v7.0.0:

| Package | Version | Status |
|---------|---------|--------|
| sampler-devices | 7.0.0 | Core package, synchronized |
| sampler-lib | 7.0.0 | Core package, synchronized |
| sampler-midi | 7.0.0 | Core package, synchronized |
| sampler-translate | 7.0.0 | Core package, synchronized |
| sampler-export | 1.0.0 | Independent release cycle |
| sampler-backup | 1.0.0 | Independent release cycle |
| sampler-interface | 3.0.0 | Independent release cycle |
| sampler-attic | 0.0.1 | Private, not for distribution |

## Future Versioning Strategy

Going forward from v7.0.0:

- **Patch releases (v7.0.x)**: Bug fixes, documentation updates, internal refactoring
- **Minor releases (v7.x.0)**: New features with backward compatibility
- **Major releases (v8.0.0+)**: Breaking API changes (expected to be rare now that cleanup is complete)

## Key Takeaway

**Version 7.0.0 does not indicate:**
- Project age (this is a new project)
- API maturity over years of development
- Seven major releases to users

**Version 7.0.0 indicates:**
- Seven iterations of breaking changes during pre-release refactoring
- Strict adherence to semantic versioning
- Completion of aggressive cleanup phase
- Ready for public distribution

The version number is high because the project **broke its own API seven times in a few hours** during cleanup, not because it's been around for years.
