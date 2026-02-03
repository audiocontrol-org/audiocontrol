# Bundled mtools Binaries

This directory contains pre-compiled `mcopy` binaries from GNU mtools for zero-dependency DOS/FAT disk extraction.

## Binary Sources

### darwin-arm64/mcopy
- **Source**: Homebrew mtools 4.0.49
- **Platform**: macOS Apple Silicon (M1/M2/M3)
- **Command**: `brew install mtools`
- **License**: GPL-3.0
- **Size**: 190KB
- **SHA256**: `a654c7489cd768e81e1ac89c0b58da73bb0ee00e981d729901a6fa57ef96d65c`

### linux-x64/mcopy
- **Source**: Alpine Linux mtools 4.0.44 (Docker-based build)
- **Platform**: Linux x86_64
- **Build Method**: Docker with Alpine Linux base
- **License**: GPL-3.0
- **Size**: 209KB
- **SHA256**: `0aa5cae4b927d93519697abe281855a8d4847c93f03694e9fabb65dad807f512`

### linux-arm64/mcopy
- **Source**: Alpine Linux mtools 4.0.44 (Docker-based build)
- **Platform**: Linux ARM64 (aarch64)
- **Build Method**: Docker with Alpine Linux base
- **License**: GPL-3.0
- **Size**: 197KB
- **SHA256**: `ff774992fa021553283af4bd1b485cb88d2f15ad7a082b5e0551f121bd670fa0`

## Build Information

### macOS Binary
Extracted from Homebrew installation:
```bash
brew install mtools
cp $(brew --prefix)/bin/mcopy bin/mtools/darwin-arm64/mcopy
```

### Linux Binaries (Docker-based)
Built using Docker to ensure compatibility and minimal dependencies:

```bash
# Build for x64
docker build --platform linux/amd64 -t mtools-builder-amd64 -f Dockerfile.mtools .
docker create --name temp-container-amd64 mtools-builder-amd64
docker cp temp-container-amd64:/usr/bin/mcopy bin/mtools/linux-x64/mcopy
docker rm temp-container-amd64

# Build for ARM64
docker build --platform linux/arm64 -t mtools-builder-arm64 -f Dockerfile.mtools .
docker create --name temp-container-arm64 mtools-builder-arm64
docker cp temp-container-arm64:/usr/bin/mcopy bin/mtools/linux-arm64/mcopy
docker rm temp-container-arm64
```

Alpine Linux base provides:
- Small binary size (static compilation)
- Minimal dependencies (musl libc)
- Wide compatibility across Linux distributions

## Why Bundled Binaries?

Many Akai sampler disk images use DOS/FAT32 filesystem format. Extracting files from these disks requires mtools (`mcopy`). By bundling the binaries, we provide a zero-configuration installation experience - users can `npm install` and immediately start extracting disks without manual dependency installation.

## Fallback Behavior

If the bundled binary is unavailable or fails:
1. The tool attempts to use system-installed `mcopy`
2. If neither is available, a helpful error message with installation instructions is shown

## Platform Support Status

| Platform | Status | Binary Source | Size |
|----------|--------|---------------|------|
| macOS Apple Silicon (darwin-arm64) | ✅ Bundled | Homebrew 4.0.49 | 190KB |
| macOS Intel (darwin-x64) | ⏳ Planned | TBD | - |
| Linux x64 (linux-x64) | ✅ Bundled | Alpine Linux 4.0.44 | 209KB |
| Linux ARM64 (linux-arm64) | ✅ Bundled | Alpine Linux 4.0.44 | 197KB |
| Windows x64 (win32-x64) | ⏳ Planned | TBD | - |

## Adding Binaries for Other Platforms

To add support for additional platforms:

1. Install mtools on the target platform (or build via Docker)
2. Copy the `mcopy` binary to the appropriate directory:
   - `darwin-x64/mcopy` - macOS Intel
   - `win32-x64/mcopy.exe` - Windows x64

3. Set executable permissions (Unix): `chmod +x mcopy`
4. Test the binary works on the target platform
5. Update this README with source, size, and SHA256 checksum

## License

GNU mtools is licensed under GPL-3.0. See:
- https://www.gnu.org/software/mtools/
- https://github.com/Homebrew/homebrew-core/blob/master/Formula/m/mtools.rb

## Verification

To verify the bundled binaries:

```bash
# Check binary format
file darwin-arm64/mcopy
file linux-x64/mcopy
file linux-arm64/mcopy

# Expected outputs:
# darwin-arm64/mcopy: Mach-O 64-bit executable arm64
# linux-x64/mcopy: ELF 64-bit LSB executable, x86-64
# linux-arm64/mcopy: ELF 64-bit LSB executable, ARM aarch64

# Test execution
./darwin-arm64/mcopy --version
./linux-x64/mcopy --version
./linux-arm64/mcopy --version

# Verify checksums
shasum -a 256 darwin-arm64/mcopy linux-x64/mcopy linux-arm64/mcopy
```

Expected SHA256 checksums:
```
a654c7489cd768e81e1ac89c0b58da73bb0ee00e981d729901a6fa57ef96d65c  darwin-arm64/mcopy
0aa5cae4b927d93519697abe281855a8d4847c93f03694e9fabb65dad807f512  linux-x64/mcopy
ff774992fa021553283af4bd1b485cb88d2f15ad7a082b5e0551f121bd670fa0  linux-arm64/mcopy
```
