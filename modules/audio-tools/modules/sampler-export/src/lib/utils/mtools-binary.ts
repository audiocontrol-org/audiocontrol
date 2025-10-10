/**
 * MTools Binary Management
 *
 * Locates mtools mcopy binary for current platform with fallback to system installation.
 * Supports bundled binaries for zero-configuration cross-platform deployment.
 *
 * @module utils/mtools-binary
 */

import { resolve, join, dirname } from "pathe";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

/**
 * Detect current platform identifier
 *
 * Maps Node.js platform and architecture to binary naming scheme used in bin/ directory.
 *
 * @returns Platform identifier string (e.g., "darwin-arm64", "linux-x64")
 * @throws Error if platform/architecture combination is unsupported
 *
 * @remarks
 * Supported platforms:
 * - darwin-arm64: macOS Apple Silicon
 * - darwin-x64: macOS Intel
 * - linux-x64: Linux 64-bit
 * - linux-arm64: Linux ARM64 (Raspberry Pi, etc.)
 * - win32-x64: Windows 64-bit
 *
 * @internal
 */
function detectPlatform(): string {
    const platform = process.platform;
    const arch = process.arch;

    // Map Node.js platform/arch to our binary naming scheme
    if (platform === "darwin") {
        if (arch === "arm64") return "darwin-arm64";
        if (arch === "x64") return "darwin-x64";
    } else if (platform === "linux") {
        if (arch === "x64") return "linux-x64";
        if (arch === "arm64") return "linux-arm64";
    } else if (platform === "win32") {
        if (arch === "x64") return "win32-x64";
    }

    throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

/**
 * Get path to bundled mcopy binary for current platform
 *
 * Searches for platform-specific mcopy binary in package bin/ directory.
 * Works correctly from both dist/ build output and source locations.
 *
 * @returns Absolute path to bundled binary if found, null otherwise
 *
 * @remarks
 * Binary directory structure:
 * ```
 * bin/
 *   mtools/
 *     darwin-arm64/
 *       mcopy
 *     darwin-x64/
 *       mcopy
 *     linux-x64/
 *       mcopy
 *     win32-x64/
 *       mcopy.exe
 * ```
 *
 * Path resolution handles multiple scenarios:
 * - Running from dist/ (built code)
 * - Running from src/ (development)
 * - ESM module imports
 *
 * @internal
 */
function getBundledBinaryPath(): string | null {
    try {
        const platformId = detectPlatform();

        // Get package root (works for both ESM and CommonJS)
        // When running from dist/, we need to go up to package root
        const currentFile = fileURLToPath(import.meta.url);
        const currentDir = dirname(currentFile);

        // Navigate from dist/ back to package root
        // dist/utils/mtools-binary.js -> ../../bin/mtools/
        const packageRoot = resolve(currentDir, "../..");
        const binaryDir = join(packageRoot, "bin", "mtools", platformId);

        const binaryName = platformId.startsWith("win32") ? "mcopy.exe" : "mcopy";
        const binaryPath = join(binaryDir, binaryName);

        if (existsSync(binaryPath)) {
            return binaryPath;
        }

        return null;
    } catch (err) {
        return null;
    }
}

/**
 * Find system mcopy binary using 'which' command
 *
 * Searches for mcopy in system PATH using platform-appropriate command.
 *
 * @returns Absolute path to system mcopy if found, null otherwise
 *
 * @remarks
 * Uses platform-specific commands:
 * - Unix/macOS: `which mcopy`
 * - Windows: `where mcopy.exe`
 *
 * Returns first match if multiple installations exist.
 * Silent failure (returns null) if binary not found.
 *
 * @internal
 */
function getSystemBinaryPath(): string | null {
    try {
        const which = process.platform === "win32" ? "where" : "which";
        const binaryName = process.platform === "win32" ? "mcopy.exe" : "mcopy";

        const result = execSync(`${which} ${binaryName}`, {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"]
        }).trim();

        if (result && existsSync(result.split("\n")[0])) {
            return result.split("\n")[0];
        }

        return null;
    } catch (err) {
        return null;
    }
}

/**
 * Locate mcopy binary with the following precedence:
 * 1. Bundled binary for current platform
 * 2. System-installed mcopy
 * 3. Error if neither found
 *
 * This function implements the binary resolution strategy for zero-configuration
 * deployment while supporting development and custom installations.
 *
 * @returns Absolute path to mcopy executable
 * @throws Error if mcopy binary cannot be found, with installation instructions
 *
 * @remarks
 * Resolution order (fail-fast):
 * 1. **Bundled binary**: Checked first for zero-config deployment
 * 2. **System binary**: Fallback for development or custom installations
 * 3. **Error with instructions**: Provides platform-specific installation guidance
 *
 * Error message includes installation commands for:
 * - macOS: `brew install mtools`
 * - Linux (Debian/Ubuntu): `sudo apt install mtools`
 * - Linux (RHEL/CentOS): `sudo yum install mtools`
 * - Windows: Link to GNU mtools website
 *
 * @example
 * ```typescript
 * try {
 *   const mcopyPath = getMcopyBinary();
 *   console.log(`Using mcopy: ${mcopyPath}`);
 *   // Execute mcopy operations...
 * } catch (err) {
 *   console.error(err.message); // Installation instructions
 * }
 * ```
 *
 * @public
 */
export function getMcopyBinary(): string {
    // Try bundled binary first
    const bundledPath = getBundledBinaryPath();
    if (bundledPath) {
        return bundledPath;
    }

    // Fallback to system binary
    const systemPath = getSystemBinaryPath();
    if (systemPath) {
        return systemPath;
    }

    // No mcopy available
    const platform = detectPlatform();
    throw new Error(
        `mcopy binary not found for platform ${platform}. ` +
        `Please install mtools:\n` +
        `  macOS: brew install mtools\n` +
        `  Linux: sudo apt install mtools (Debian/Ubuntu) or sudo yum install mtools (RHEL/CentOS)\n` +
        `  Windows: Install mtools from https://www.gnu.org/software/mtools/`
    );
}

/**
 * Check if mcopy is available
 *
 * Non-throwing availability check for conditional functionality.
 * Useful for feature detection or graceful degradation.
 *
 * @returns True if mcopy binary is available (bundled or system), false otherwise
 *
 * @example
 * ```typescript
 * if (isMcopyAvailable()) {
 *   console.log('DOS disk extraction supported');
 *   await extractDosDisk(...);
 * } else {
 *   console.warn('DOS disk extraction not available - mtools not found');
 *   console.log('Native Akai disk extraction only');
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Conditional feature enablement
 * const features = {
 *   nativeAkai: true,
 *   dosFat: isMcopyAvailable(),
 *   conversion: true
 * };
 * ```
 *
 * @public
 */
export function isMcopyAvailable(): boolean {
    try {
        getMcopyBinary();
        return true;
    } catch (err) {
        return false;
    }
}
