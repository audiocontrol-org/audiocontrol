/**
 * MTools Binary Management
 *
 * Locates mtools mcopy binary for current platform, with fallback to system installation.
 */

import { resolve, join, dirname } from "pathe";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

/**
 * Detect current platform identifier
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
 * @returns Absolute path to mcopy executable
 * @throws Error if mcopy binary cannot be found
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
 */
export function isMcopyAvailable(): boolean {
    try {
        getMcopyBinary();
        return true;
    } catch (err) {
        return false;
    }
}
