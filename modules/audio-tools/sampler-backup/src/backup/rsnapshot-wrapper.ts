/**
 * Rsnapshot Wrapper
 *
 * Executes rsnapshot commands for sampler backups
 */

import { spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "pathe";
import {
    getDefaultRsnapshotConfig,
    writeRsnapshotConfig,
    getDefaultConfigPath,
} from "@/config/rsnapshot-config.js";
import type {
    BackupOptions,
    BackupResult,
    RsnapshotInterval,
    RsnapshotConfig,
} from "@/types/index.js";

/**
 * Execute rsnapshot command
 */
async function executeRsnapshot(
    args: string[],
    configPath: string
): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
        const proc = spawn("rsnapshot", ["-c", configPath, ...args]);

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
            const output = data.toString();
            stdout += output;
            process.stdout.write(output); // Stream to console
        });

        proc.stderr?.on("data", (data) => {
            const output = data.toString();
            stderr += output;
            process.stderr.write(output); // Stream to console
        });

        proc.on("close", (code) => {
            if (code === 0) {
                resolve({ success: true, output: stdout });
            } else {
                resolve({
                    success: false,
                    output: stdout,
                    error: `rsnapshot exited with code ${code}: ${stderr}`,
                });
            }
        });

        proc.on("error", (err) => {
            resolve({
                success: false,
                output: stdout,
                error: `Failed to execute rsnapshot: ${err.message}`,
            });
        });
    });
}

/**
 * Test rsnapshot configuration
 */
export async function testRsnapshotConfig(
    configPath: string
): Promise<{ valid: boolean; error?: string }> {
    console.log(`Testing rsnapshot configuration: ${configPath}`);

    const result = await executeRsnapshot(["configtest"], configPath);

    if (result.success) {
        console.log("✓ Configuration is valid");
        return { valid: true };
    } else {
        console.error("✗ Configuration is invalid");
        return { valid: false, error: result.error };
    }
}

/**
 * Run rsnapshot backup
 */
export async function runBackup(
    options: BackupOptions = {}
): Promise<BackupResult> {
    const {
        interval = "daily" as RsnapshotInterval,
        configPath = getDefaultConfigPath(),
        configOnly = false,
        test = false,
    } = options;

    const result: BackupResult = {
        success: false,
        interval,
        configPath,
        errors: [],
    };

    try {
        // Ensure config directory exists
        const configDir = dirname(configPath);
        if (!existsSync(configDir)) {
            mkdirSync(configDir, { recursive: true });
        }

        // Generate or verify config
        if (!existsSync(configPath) || configOnly) {
            console.log(`Generating rsnapshot configuration: ${configPath}`);
            const config: RsnapshotConfig = getDefaultRsnapshotConfig();
            writeRsnapshotConfig(config, configPath);

            result.snapshotPath = config.snapshotRoot;

            if (configOnly) {
                console.log("✓ Configuration generated");
                result.success = true;
                return result;
            }
        }

        // Test configuration
        if (test) {
            const testResult = await testRsnapshotConfig(configPath);
            if (!testResult.valid) {
                result.errors.push(testResult.error || "Config test failed");
                return result;
            }
            result.success = true;
            return result;
        }

        // Run backup
        console.log(`\nRunning rsnapshot ${interval} backup...`);
        console.log(`Config: ${configPath}\n`);

        const backupResult = await executeRsnapshot([interval], configPath);

        if (!backupResult.success) {
            result.errors.push(backupResult.error || "Backup failed");
            return result;
        }

        console.log(`\n✓ Backup complete: ${interval}`);
        result.success = true;
    } catch (err: any) {
        result.errors.push(`Backup failed: ${err.message}`);
    }

    return result;
}

/**
 * Get the latest snapshot directory
 */
export function getLatestSnapshotDir(
    snapshotRoot: string,
    interval: RsnapshotInterval = "daily"
): string {
    // rsnapshot creates directories like: daily.0, daily.1, etc.
    // daily.0 is the most recent
    return `${snapshotRoot}/${interval}.0`;
}
