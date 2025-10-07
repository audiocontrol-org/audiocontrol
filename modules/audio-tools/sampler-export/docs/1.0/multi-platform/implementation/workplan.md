# Multi-Platform mtools Binary Support - Implementation Plan

**Status:** In Progress
**Version:** 1.0.0
**Created:** 2025-10-07
**Last Updated:** 2025-10-07

## Overview

Add bundled mtools binaries for macOS Intel, Linux x64, and Linux ARM64 to achieve zero-configuration installation across all major platforms (excluding Windows for v1.0.0).

## Current State

### ✅ Implemented
- Platform detection logic in `src/utils/mtools-binary.ts`
- Fallback chain: bundled → system → error with installation instructions
- darwin-arm64 binary bundled and tested
- Package.json files array includes bin/mtools/

### ⚠️ Missing
- darwin-x64 (macOS Intel) binary
- linux-x64 (Linux 64-bit) binary
- linux-arm64 (Linux ARM64/Raspberry Pi) binary

## Goals

1. **Zero-configuration installation** on supported platforms
2. **Package size < 5MB** total with all binaries
3. **Maintain fallback to system mtools** for unsupported platforms
4. **Platform-specific testing** to verify binary execution

## Target Platforms

| Platform | Architecture | Priority | Status |
|----------|--------------|----------|--------|
| macOS ARM | arm64 | High | ✅ Complete |
| macOS Intel | x64 | High | ⚠️ Needed |
| Linux x64 | x64 | High | ⚠️ Needed |
| Linux ARM | arm64 | Medium | ⚠️ Needed |
| Windows | x64 | Low | Deferred to v2.0.0 |

## Implementation Tasks

### Phase 1: Binary Acquisition

#### Task 1.1: Build Linux Binaries with Docker (Recommended)

**Use automated build script:**
```bash
cd sampler-export/docs/1.0/multi-platform/implementation
./build-binaries.sh
```

**Script does:**
1. Uses Docker multi-platform builds for Linux x64 and ARM64
2. Extracts mcopy binary from Ubuntu 22.04 containers
3. Checks binary info and dependencies
4. Validates total package size

**Manual Docker build (if needed):**
```bash
# Linux x64
docker run --rm --platform linux/amd64 \
  -v $(pwd)/output:/output ubuntu:22.04 \
  bash -c "apt update && apt install -y mtools && cp /usr/bin/mcopy /output/"

# Linux ARM64
docker run --rm --platform linux/arm64 \
  -v $(pwd)/output:/output ubuntu:22.04 \
  bash -c "apt update && apt install -y mtools && cp /usr/bin/mcopy /output/"
```

**Advantages:**
- Fast local iteration (no CI wait times)
- Easy debugging
- Reproducible builds
- Works on any machine with Docker

**Acceptance Criteria:**
- [ ] mcopy binary obtained for linux-x64 via Docker
- [ ] mcopy binary obtained for linux-arm64 via Docker
- [ ] Binary executes in target platform containers
- [ ] Dependencies documented with `ldd`
- [ ] Binary sizes documented

#### Task 1.2: Build/Acquire macOS Binaries

**macOS binaries cannot be cross-compiled in Docker** - must be built natively.

**For darwin-arm64 (current machine):**
```bash
brew install mtools
cp $(which mcopy) bin/mtools/darwin-arm64/mcopy
```

**For darwin-x64 (Intel Mac or CI):**

Option 1 - **Borrow Intel Mac:**
```bash
brew install mtools
cp $(which mcopy) bin/mtools/darwin-x64/mcopy
# Transfer via USB, AirDrop, or git
```

Option 2 - **GitHub Actions:**
```yaml
- runs-on: macos-13  # Intel runner
- run: brew install mtools
- run: cp $(which mcopy) artifacts/darwin-x64/
```

Option 3 - **Ask in community:**
- Post issue asking for darwin-x64 binary contribution
- Verify checksum before including

**Acceptance Criteria:**
- [ ] mcopy binary obtained for darwin-x64
- [ ] Binary executes on macOS Intel
- [ ] Binary size documented
- [ ] Source/build method documented

### Phase 2: Integration

#### Task 2.1: Add Binaries to Repository

**Steps:**
1. Create platform directories:
   ```bash
   mkdir -p sampler-export/bin/mtools/darwin-x64
   mkdir -p sampler-export/bin/mtools/linux-x64
   mkdir -p sampler-export/bin/mtools/linux-arm64
   ```

2. Copy binaries:
   ```bash
   cp mcopy-darwin-x64 sampler-export/bin/mtools/darwin-x64/mcopy
   cp mcopy-linux-x64 sampler-export/bin/mtools/linux-x64/mcopy
   cp mcopy-linux-arm64 sampler-export/bin/mtools/linux-arm64/mcopy
   ```

3. Set executable permissions:
   ```bash
   chmod +x sampler-export/bin/mtools/*/mcopy
   ```

**Acceptance Criteria:**
- [ ] All binaries in correct directory structure
- [ ] Executable permissions set
- [ ] Git tracks binaries (verify .gitignore)

#### Task 2.2: Update Package Configuration

**Update `sampler-export/package.json`:**
```json
{
  "files": [
    "dist",
    "bin/mtools/darwin-arm64",
    "bin/mtools/darwin-x64",
    "bin/mtools/linux-x64",
    "bin/mtools/linux-arm64",
    "LICENSE"
  ]
}
```

**Acceptance Criteria:**
- [ ] package.json includes all binary directories
- [ ] npm pack includes binaries
- [ ] Verify with: `npm pack && tar -tzf *.tgz | grep bin/mtools`

#### Task 2.3: Update Documentation

**Update `bin/mtools/README.md`:**
- Document all bundled platforms
- Add binary sizes
- Include source/build information
- Update license information if needed

**Acceptance Criteria:**
- [ ] README.md updated with all platforms
- [ ] Binary sources documented
- [ ] License compliance verified

### Phase 3: Testing

#### Task 3.1: Local Testing (Current Platform)

**Test on macOS ARM (current):**
```bash
pnpm --filter @oletizi/sampler-export build
node -e "console.log(require('./dist/utils/mtools-binary.js').getMcopyBinary())"
# Should return: .../bin/mtools/darwin-arm64/mcopy
```

**Acceptance Criteria:**
- [ ] Build succeeds
- [ ] Binary detection works
- [ ] Extraction functionality works

#### Task 3.2: Cross-Platform CI Testing

**GitHub Actions workflow:**
```yaml
name: Multi-Platform Binary Test

on: [push, pull_request]

jobs:
  test-macos-intel:
    runs-on: macos-13
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @oletizi/sampler-export build
      - run: pnpm --filter @oletizi/sampler-export test

  test-linux-x64:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @oletizi/sampler-export build
      - run: pnpm --filter @oletizi/sampler-export test

  test-linux-arm64:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/setup-qemu-action@v2
      - uses: docker/setup-buildx-action@v2
      - run: docker run --platform linux/arm64 ...
```

**Acceptance Criteria:**
- [ ] CI tests pass on all platforms
- [ ] Binary detection works on each platform
- [ ] Extraction functionality works

#### Task 3.3: Manual Platform Testing

**Test matrix:**
- [ ] macOS ARM (M1/M2/M3) - bundled binary
- [ ] macOS Intel - bundled binary
- [ ] Ubuntu 22.04 x64 - bundled binary
- [ ] Ubuntu 24.04 x64 - bundled binary
- [ ] Raspberry Pi (ARM64) - bundled binary
- [ ] Alpine Linux - fallback to system mtools
- [ ] macOS without binary - fallback to system mtools

**Test scenarios:**
1. Binary detection
2. DOS disk extraction
3. Batch extraction
4. Error messages when binary missing

### Phase 4: Package Size Validation

#### Task 4.1: Measure Package Size

**Check total size:**
```bash
npm pack
ls -lh *.tgz
# Target: < 5MB
```

**Breakdown by platform:**
```bash
tar -tzf *.tgz | grep bin/mtools | xargs -I {} sh -c 'tar -xzf *.tgz {} -O | wc -c'
```

**Acceptance Criteria:**
- [ ] Total package size < 5MB
- [ ] Individual binary sizes documented
- [ ] Size optimization if needed (strip, compression)

#### Task 4.2: Optimize if Needed

**If package > 5MB:**
1. Strip debug symbols:
   ```bash
   strip -S bin/mtools/*/mcopy
   ```

2. Compress binaries:
   ```bash
   # Consider gzip/brotli compression with runtime decompression
   ```

3. Consider alternative approaches:
   - Post-install download script
   - Separate platform-specific packages
   - Optional peer dependencies

**Acceptance Criteria:**
- [ ] Package size meets < 5MB target
- [ ] Functionality preserved after optimization

### Phase 5: Release Preparation

#### Task 5.1: Update CHANGELOG.md

**Add entry:**
```markdown
## [1.0.0] - 2025-10-XX

### Added
- Bundled mtools binaries for macOS Intel (darwin-x64)
- Bundled mtools binaries for Linux x64 (linux-x64)
- Bundled mtools binaries for Linux ARM64 (linux-arm64)
- Zero-configuration DOS/FAT disk extraction on all major platforms

### Changed
- Package size increased from X MB to Y MB (all platforms included)
```

#### Task 5.2: Update ROADMAP.md

**Mark as complete:**
```markdown
## ✅ Cross-Platform Binary Support (Completed)

**Completed platforms:**
- [x] macOS Apple Silicon (darwin-arm64)
- [x] macOS Intel (darwin-x64)
- [x] Linux x64 (linux-x64)
- [x] Linux ARM64 (linux-arm64)
- [x] Fallback to system mtools if bundled binary unavailable
- [x] Package size < 5MB total

**Deferred:**
- [ ] Windows x64 (win32-x64) - Deferred to v2.0.0
```

#### Task 5.3: Version Bump and Publish

```bash
# Bump version
pnpm --filter @oletizi/sampler-export version patch

# Build
pnpm --filter @oletizi/sampler-export build

# Publish
pnpm --filter @oletizi/sampler-export publish
```

## Technical Considerations

### Binary Compatibility

**macOS:**
- Minimum OS version requirements
- Code signing (may require notarization for distribution)
- Gatekeeper bypass for unsigned binaries

**Linux:**
- glibc version compatibility (target Ubuntu 20.04+ / glibc 2.31+)
- musl libc support (Alpine Linux) - may need separate binary
- Dynamic library dependencies (prefer static linking)

**ARM64:**
- Test on both 64-bit kernel and 32-bit userspace
- Raspberry Pi OS compatibility
- Performance on low-power ARM devices

### Security Considerations

1. **Binary verification:**
   - Document binary sources
   - Include checksums in README
   - Consider signing binaries

2. **Supply chain:**
   - Use official package repositories
   - Document build process
   - Reproducible builds where possible

3. **License compliance:**
   - mtools is GPL-licensed
   - Bundling requires GPL compliance
   - Document in LICENSE file

### Fallback Strategy

**When bundled binary unavailable:**
1. Check system PATH for mcopy
2. Provide clear installation instructions
3. Exit code 0 with warning (not error)
4. Continue with native Akai extraction only

## Success Metrics

- [ ] Zero-configuration installation on 4+ platforms
- [ ] Package size < 5MB
- [ ] CI tests pass on all platforms
- [ ] No user-reported binary issues for 2 weeks post-release
- [ ] 90%+ of users don't need to install mtools manually

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Package size > 5MB | Medium | Medium | Strip binaries, consider platform packages |
| Binary compatibility issues | High | Medium | Extensive CI testing, fallback to system |
| GPL licensing concerns | High | Low | Legal review, proper attribution |
| Platform-specific bugs | Medium | Medium | User testing, quick patch release |
| Binary acquisition delays | Low | Medium | Use GitHub Actions for automation |

## Timeline

**Week 1: Binary Acquisition**
- Day 1-2: Set up GitHub Actions for binary building
- Day 3-4: Acquire and test darwin-x64 binary
- Day 5-7: Acquire and test linux-x64 and linux-arm64 binaries

**Week 2: Integration and Testing**
- Day 8-9: Add binaries to repository, update configs
- Day 10-12: CI testing and platform validation
- Day 13-14: Package size optimization if needed

**Week 3: Release**
- Day 15-16: Documentation and changelog updates
- Day 17: Alpha release (1.0.0-alpha.5)
- Day 18-21: User testing and feedback
- Day 22: Stable release (1.0.0)

## References

- [mtools project](https://www.gnu.org/software/mtools/)
- [mtools-binary.ts](../../src/utils/mtools-binary.ts)
- [ROADMAP.md](../../../../ROADMAP.md)
- [GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html)

## Next Steps

1. Start with GitHub Actions setup for automated binary building
2. Acquire darwin-x64 binary using macos-13 runner
3. Test locally with borrowed macOS Intel machine or CI
4. Repeat for Linux platforms
5. Integrate, test, and release

---

**Document Version:** 1.0
**Author:** Audio Tools Team
**Review Status:** Draft
