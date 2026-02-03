import fs from "fs/promises";

/**
 * Ensures a directory exists, creating it if necessary.
 *
 * @param dir - Path to the directory
 * @returns Promise resolving to true if directory exists or was created, false on failure
 *
 * @example
 * ```typescript
 * const success = await mkdir('/path/to/dir');
 * if (success) {
 *   console.log('Directory ready');
 * } else {
 *   console.error('Failed to create directory');
 * }
 * ```
 *
 * @remarks
 * - Returns false for empty/null directory paths
 * - If directory exists, verifies it's actually a directory
 * - Attempts to create directory if it doesn't exist
 * - Does not create parent directories (use fs.mkdir with recursive option for that)
 * - Swallows errors and returns false on failure
 */
export async function mkdir(dir: string) {
    if (!dir) return false

    try {
        return (await fs.stat(dir)).isDirectory()
    } catch (e) {
        try {
            await fs.mkdir(dir)
            return true
        } catch (e) {
            return false
        }
    }
}
