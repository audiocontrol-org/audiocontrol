# Bundled mtools Binaries

This directory contains pre-compiled `mcopy` binaries from GNU mtools for zero-dependency DOS/FAT disk extraction.

## Binary Sources

### darwin-arm64/mcopy
- **Source**: Homebrew mtools 4.0.49
- **Platform**: macOS Apple Silicon (M1/M2/M3)
- **Command**: `brew install mtools`
- **License**: GPL-3.0
- **Size**: ~190KB

## Why Bundled Binaries?

Many Akai sampler disk images use DOS/FAT32 filesystem format. Extracting files from these disks requires mtools (`mcopy`). By bundling the binaries, we provide a zero-configuration installation experience - users can `npm install` and immediately start extracting disks without manual dependency installation.

## Fallback Behavior

If the bundled binary is unavailable or fails:
1. The tool attempts to use system-installed `mcopy`
2. If neither is available, a helpful error message with installation instructions is shown

## Adding Binaries for Other Platforms

To add support for additional platforms:

1. Install mtools on the target platform
2. Copy the `mcopy` binary to the appropriate directory:
   - `darwin-x64/mcopy` - macOS Intel
   - `linux-x64/mcopy` - Linux x86_64
   - `linux-arm64/mcopy` - Linux ARM64
   - `win32-x64/mcopy.exe` - Windows x64

3. Set executable permissions (Unix): `chmod +x mcopy`
4. Test the binary works on the target platform

## License

GNU mtools is licensed under GPL-3.0. See:
- https://www.gnu.org/software/mtools/
- https://github.com/Homebrew/homebrew-core/blob/master/Formula/m/mtools.rb

## Verification

To verify the bundled binary:

```bash
# Check binary
file darwin-arm64/mcopy

# Expected output:
# darwin-arm64/mcopy: Mach-O 64-bit executable arm64

# Test execution
./darwin-arm64/mcopy --version
```
