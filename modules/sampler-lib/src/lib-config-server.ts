import fs from "fs/promises";
import path from "pathe";
import {newServerOutput, ProcessOutput} from "@/lib-io";
import {ClientConfig, newClientConfig} from "@/lib-config-client";
import {objectFromFile} from "@/lib-io";
import {pad} from "@/lib-core";
import {mkdir} from "@/lib-fs-server"

const DEFAULT_DATA_DIR: string = path.join(process.env.HOME ? process.env.HOME : "/", '.audiotools')
const out: ProcessOutput = newServerOutput(false)

/**
 * Server-side configuration for sampler operations.
 *
 * @remarks
 * Manages paths for source files, target files, sessions, jobs, and
 * integration with PiSCSI and Akai tools.
 */
export interface ServerConfig {
    /** PiSCSI host address */
    piscsiHost: string;
    /** SCSI ID of the S3000XL sampler */
    s3kScsiId: number;
    /** Path to akaitools installation */
    akaiTools: string
    /** Path to Akai disk image */
    akaiDisk: string
    /** Root directory for S3000XL data */
    s3k: string
    /** Root directory for source files */
    sourceRoot: string
    /** Root directory for target/output files */
    targetRoot: string
    /** Root directory for session data */
    sessionRoot: string
    /** Root directory for job data */
    jobsRoot: string
    /** Path to log file */
    logfile: string

    /**
     * Gets the path to the default program file for a given keygroup count.
     *
     * @param keygroupCount - Number of keygroups in the program (1-99)
     * @returns Path to the default program template file
     *
     * @example
     * ```typescript
     * const templatePath = config.getS3kDefaultProgramPath(8);
     * // Returns: 'data/s3000xl/defaults/kg_08.a3p'
     * ```
     */
    getS3kDefaultProgramPath(keygroupCount: number): string;
}

/**
 * Validates server configuration and ensures required directories exist.
 *
 * @param cfg - Server configuration to validate
 * @throws {Error} If configuration is invalid or required fields are missing
 *
 * @internal
 */
async function validate(cfg: ServerConfig) {
    if (!cfg) {
        throw new Error('Config is undefined')
    }
    if (cfg.s3kScsiId === undefined) {
        throw new Error('S3000XL disk SCSI ID is undefined.')
    }
    if (!cfg.piscsiHost) {
        throw new Error('piscsi hostis undefined.')
    }
    await mkdir(cfg.sourceRoot)
    await mkdir(cfg.targetRoot)
    await mkdir(cfg.sessionRoot)
    await mkdir(cfg.s3k)
}

/**
 * Creates a server configuration with defaults and optional persistence.
 *
 * @param dataDir - Data directory path (default: ~/.audiotools)
 * @returns Promise resolving to validated ServerConfig
 * @throws {Error} If configuration validation fails
 *
 * @example
 * ```typescript
 * const config = await newServerConfig();
 * console.log('PiSCSI host:', config.piscsiHost);
 * console.log('S3K SCSI ID:', config.s3kScsiId);
 * ```
 *
 * @remarks
 * - Creates default configuration
 * - Attempts to load stored configuration from server-config.json
 * - Merges stored values with defaults
 * - Creates required directories
 * - Validates configuration before returning
 */
export async function newServerConfig(dataDir = DEFAULT_DATA_DIR): Promise<ServerConfig> {
    const targetDir = path.join(dataDir, 'target')
    const sourceDir = path.join(dataDir, 'source')
    const rv: ServerConfig = {
        piscsiHost: "pi-scsi2.local", s3kScsiId: 4,
        getS3kDefaultProgramPath(keygroupCount: number): string {
            return path.join('data', 's3000xl', 'defaults', `kg_${pad(keygroupCount, 2)}.a3p`)
        },
        sourceRoot: sourceDir,
        targetRoot: targetDir,
        jobsRoot: path.join(dataDir, 'jobs'),
        sessionRoot: path.join(dataDir, 'sessions'),
        logfile: path.join(dataDir, 'log.txt'),
        s3k: path.join(targetDir, 's3k'),
        akaiDisk: path.join(targetDir, 's3k', 'HD4.hds'),
        akaiTools: path.join(dataDir, 'akaitools-1.5')
    }
    const configPath = path.join(dataDir, 'server-config.json')
    try {
        const storedConfig = (await objectFromFile(configPath)).data
        rv.piscsiHost = storedConfig.piscsiHost
        rv.s3kScsiId = storedConfig.s3kScsiId
        rv.sourceRoot = storedConfig.sourceRoot
        rv.targetRoot = storedConfig.targetRoot
    } catch (e) {
    }
    await validate(rv)
    return rv
}

/**
 * Saves client configuration to disk.
 *
 * @param cfg - Client configuration to save
 * @param dataDir - Data directory path (default: ~/.audiotools)
 * @returns Promise resolving to the path where config was saved
 * @throws {Error} If directory creation or file write fails
 *
 * @example
 * ```typescript
 * const config = newClientConfig();
 * config.midiInput = 'IAC Driver Bus 1';
 * config.midiOutput = 'S3000XL';
 * const savedPath = await saveClientConfig(config);
 * console.log('Config saved to:', savedPath);
 * ```
 */
export function saveClientConfig(cfg: ClientConfig, dataDir = DEFAULT_DATA_DIR): Promise<string> {
    const configPath = path.join(dataDir, 'config.json')
    out.log(`Saving config to   : ${configPath}`)
    return new Promise((resolve, reject) => {
            ensureDataDir(dataDir)
                .then(() => fs.writeFile(configPath, JSON.stringify(cfg))
                    .then(() => resolve(configPath)))
                .catch((err) => reject(err))
                .catch((err) => reject(err))
        }
    )
}

/**
 * Loads client configuration from disk.
 *
 * @param dataDir - Data directory path (default: ~/.audiotools)
 * @returns Promise resolving to ClientConfig (defaults if file doesn't exist)
 *
 * @example
 * ```typescript
 * const config = await loadClientConfig();
 * console.log('MIDI input:', config.midiInput);
 * console.log('MIDI output:', config.midiOutput);
 * ```
 *
 * @remarks
 * Returns default configuration if config file doesn't exist or cannot be read.
 * Does not throw errors - logs warnings and returns defaults on failure.
 */
export async function loadClientConfig(dataDir = DEFAULT_DATA_DIR): Promise<ClientConfig> {
    const rv: ClientConfig = newClientConfig()
    const configPath = path.join(dataDir, 'config.json');
    let storedConfig = null
    try {
        out.log(`Reading config from: ${configPath}`)
        storedConfig = JSON.parse((await fs.readFile(configPath)).toString())
        rv.midiOutput = storedConfig.midiOutput
        rv.midiInput = storedConfig.midiInput
    } catch (err) {
        out.log(`Error reading config from: ${configPath}: ${(err as Error).message}`)
    }
    return rv
}

/**
 * Ensures the data directory exists, creating it if necessary.
 *
 * @param dataDir - Data directory path (default: ~/.audiotools)
 * @returns Promise resolving when directory exists or has been created
 * @throws {Error} If path exists but is not a directory
 *
 * @internal
 */
function ensureDataDir(dataDir = DEFAULT_DATA_DIR) {
    return fs.stat(dataDir)
        .then(stats => {
            if (!stats.isDirectory()) {
                throw new Error(`${dataDir} is not a directory`)
            }
        })
        .catch(() => fs.mkdir(dataDir))
}
