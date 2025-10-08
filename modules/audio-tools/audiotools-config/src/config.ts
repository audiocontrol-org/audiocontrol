/**
 * Configuration management for audio-tools.
 *
 * Provides functions for loading, saving, and manipulating the unified
 * audio-tools configuration file (`~/.audiotools/config.json`).
 *
 * All functions follow functional/immutable patterns - they return new
 * configuration objects rather than mutating existing ones.
 *
 * @module audiotools-config/config
 */

import { homedir } from 'node:os';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'pathe';
import type {
  AudioToolsConfig,
  BackupSource,
  BackupConfig,
  ExportConfig,
} from '@/types.js';

/**
 * Default configuration file path.
 * Expands to `~/.audiotools/config.json` on the current system.
 */
export const DEFAULT_CONFIG_PATH = join(homedir(), '.audiotools', 'config.json');

/**
 * Returns the default configuration structure.
 *
 * This is used when no configuration file exists or as a base for new configurations.
 * All tools start with sensible defaults.
 *
 * @returns Default AudioToolsConfig object
 *
 * @example
 * ```typescript
 * const config = getDefaultConfig();
 * console.log(config.backup.backupRoot); // '~/.audiotools/backup'
 * ```
 */
export function getDefaultConfig(): AudioToolsConfig {
  return {
    version: '1.0',
    backup: {
      backupRoot: join(homedir(), '.audiotools', 'backup'),
      sources: [],
    },
    export: {
      outputRoot: join(homedir(), '.audiotools', 'sampler-export', 'extracted'),
      formats: ['sfz', 'decentsampler'],
      skipUnchanged: true,
      enabledSources: [],
    },
  };
}

/**
 * Loads configuration from file or returns default configuration.
 *
 * If the configuration file doesn't exist, returns the default configuration
 * without creating the file. This allows graceful degradation when no
 * configuration is present.
 *
 * @param path - Optional path to config file (defaults to DEFAULT_CONFIG_PATH)
 * @returns Promise resolving to the loaded or default configuration
 * @throws Error if the configuration file exists but cannot be parsed
 *
 * @example
 * ```typescript
 * // Load from default location
 * const config = await loadConfig();
 *
 * // Load from custom path
 * const customConfig = await loadConfig('/path/to/config.json');
 * ```
 */
export async function loadConfig(path?: string): Promise<AudioToolsConfig> {
  const configPath = path ?? DEFAULT_CONFIG_PATH;

  try {
    const contents = await readFile(configPath, 'utf-8');
    const config = JSON.parse(contents) as AudioToolsConfig;
    return config;
  } catch (error: any) {
    // If file doesn't exist, return default config
    if (error.code === 'ENOENT') {
      return getDefaultConfig();
    }

    // Re-throw parsing or other errors with context
    const message = `Failed to load configuration from ${configPath}: ${error.message}`;
    throw new Error(message);
  }
}

/**
 * Saves configuration to file.
 *
 * Creates the parent directory if it doesn't exist.
 * Formats the JSON with 2-space indentation for readability.
 *
 * @param config - Configuration object to save
 * @param path - Optional path to save to (defaults to DEFAULT_CONFIG_PATH)
 * @returns Promise that resolves when the file is written
 * @throws Error if the file cannot be written
 *
 * @example
 * ```typescript
 * const config = getDefaultConfig();
 * await saveConfig(config);
 *
 * // Save to custom location
 * await saveConfig(config, '/custom/path/config.json');
 * ```
 */
export async function saveConfig(
  config: AudioToolsConfig,
  path?: string
): Promise<void> {
  const configPath = path ?? DEFAULT_CONFIG_PATH;

  try {
    // Ensure parent directory exists
    const dir = dirname(configPath);
    await mkdir(dir, { recursive: true });

    // Write formatted JSON
    const contents = JSON.stringify(config, null, 2);
    await writeFile(configPath, contents, 'utf-8');
  } catch (error: any) {
    const message = `Failed to save configuration to ${configPath}: ${error.message}`;
    throw new Error(message);
  }
}

// ============================================================================
// Backup Source Operations
// ============================================================================

/**
 * Adds a new backup source to the configuration.
 *
 * Returns a new configuration object with the source added.
 * If a source with the same name already exists, it will be replaced.
 *
 * @param config - Current configuration
 * @param source - Backup source to add
 * @returns New configuration with the source added
 *
 * @example
 * ```typescript
 * const config = getDefaultConfig();
 * const newSource: BackupSource = {
 *   name: 'pi-scsi2',
 *   type: 'remote',
 *   source: 'pi-scsi2.local:~/images/',
 *   device: 'images',
 *   enabled: true
 * };
 *
 * const updated = addBackupSource(config, newSource);
 * await saveConfig(updated);
 * ```
 */
export function addBackupSource(
  config: AudioToolsConfig,
  source: BackupSource
): AudioToolsConfig {
  const backup = config.backup ?? { backupRoot: '', sources: [] };

  // Remove existing source with same name if present
  const filteredSources = backup.sources.filter((s) => s.name !== source.name);

  return {
    ...config,
    backup: {
      ...backup,
      sources: [...filteredSources, source],
    },
  };
}

/**
 * Updates an existing backup source with partial changes.
 *
 * Returns a new configuration object with the source updated.
 * If the source doesn't exist, throws an error.
 *
 * @param config - Current configuration
 * @param name - Name of the source to update
 * @param updates - Partial source properties to update
 * @returns New configuration with the source updated
 * @throws Error if the source is not found
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const updated = updateBackupSource(config, 'pi-scsi2', {
 *   enabled: false,
 *   sampler: 's5000'
 * });
 * await saveConfig(updated);
 * ```
 */
export function updateBackupSource(
  config: AudioToolsConfig,
  name: string,
  updates: Partial<BackupSource>
): AudioToolsConfig {
  const backup = config.backup ?? { backupRoot: '', sources: [] };
  const sourceIndex = backup.sources.findIndex((s) => s.name === name);

  if (sourceIndex === -1) {
    throw new Error(`Backup source not found: ${name}`);
  }

  const updatedSources = [...backup.sources];
  updatedSources[sourceIndex] = {
    ...updatedSources[sourceIndex],
    ...updates,
  };

  return {
    ...config,
    backup: {
      ...backup,
      sources: updatedSources,
    },
  };
}

/**
 * Removes a backup source from the configuration.
 *
 * Returns a new configuration object with the source removed.
 * If the source doesn't exist, returns the configuration unchanged.
 * Also removes the source from export.enabledSources if present.
 *
 * @param config - Current configuration
 * @param name - Name of the source to remove
 * @returns New configuration with the source removed
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const updated = removeBackupSource(config, 'old-source');
 * await saveConfig(updated);
 * ```
 */
export function removeBackupSource(
  config: AudioToolsConfig,
  name: string
): AudioToolsConfig {
  const backup = config.backup ?? { backupRoot: '', sources: [] };
  const exportConfig = config.export ?? {
    outputRoot: '',
    formats: [],
    skipUnchanged: true,
    enabledSources: [],
  };

  return {
    ...config,
    backup: {
      ...backup,
      sources: backup.sources.filter((s) => s.name !== name),
    },
    export: {
      ...exportConfig,
      enabledSources: exportConfig.enabledSources.filter((s) => s !== name),
    },
  };
}

/**
 * Gets all backup sources that are currently enabled.
 *
 * @param config - Current configuration
 * @returns Array of enabled backup sources
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const enabled = getEnabledBackupSources(config);
 * console.log(`Found ${enabled.length} enabled sources`);
 *
 * for (const source of enabled) {
 *   console.log(`- ${source.name} (${source.type})`);
 * }
 * ```
 */
export function getEnabledBackupSources(config: AudioToolsConfig): BackupSource[] {
  const backup = config.backup ?? { backupRoot: '', sources: [] };
  return backup.sources.filter((s) => s.enabled);
}

/**
 * Toggles the enabled state of a backup source.
 *
 * Returns a new configuration object with the source's enabled flag flipped.
 * If the source doesn't exist, throws an error.
 *
 * @param config - Current configuration
 * @param name - Name of the source to toggle
 * @returns New configuration with the source toggled
 * @throws Error if the source is not found
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const toggled = toggleBackupSource(config, 'pi-scsi2');
 * await saveConfig(toggled);
 * ```
 */
export function toggleBackupSource(
  config: AudioToolsConfig,
  name: string
): AudioToolsConfig {
  const backup = config.backup ?? { backupRoot: '', sources: [] };
  const source = backup.sources.find((s) => s.name === name);

  if (!source) {
    throw new Error(`Backup source not found: ${name}`);
  }

  return updateBackupSource(config, name, { enabled: !source.enabled });
}

// ============================================================================
// Export Configuration Operations
// ============================================================================

/**
 * Updates export configuration with partial changes.
 *
 * Returns a new configuration object with export settings updated.
 *
 * @param config - Current configuration
 * @param updates - Partial export config properties to update
 * @returns New configuration with export settings updated
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const updated = updateExportConfig(config, {
 *   formats: ['sfz'],
 *   skipUnchanged: false
 * });
 * await saveConfig(updated);
 * ```
 */
export function updateExportConfig(
  config: AudioToolsConfig,
  updates: Partial<ExportConfig>
): AudioToolsConfig {
  const exportConfig = config.export ?? {
    outputRoot: '',
    formats: [],
    skipUnchanged: true,
    enabledSources: [],
  };

  return {
    ...config,
    export: {
      ...exportConfig,
      ...updates,
    },
  };
}

/**
 * Enables a backup source for export operations.
 *
 * Adds the source name to export.enabledSources if not already present.
 * Returns a new configuration object.
 *
 * @param config - Current configuration
 * @param sourceName - Name of the source to enable for export
 * @returns New configuration with the source enabled for export
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const updated = enableSourceForExport(config, 'pi-scsi2');
 * await saveConfig(updated);
 * ```
 */
export function enableSourceForExport(
  config: AudioToolsConfig,
  sourceName: string
): AudioToolsConfig {
  const exportConfig = config.export ?? {
    outputRoot: '',
    formats: [],
    skipUnchanged: true,
    enabledSources: [],
  };

  // Don't add if already present
  if (exportConfig.enabledSources.includes(sourceName)) {
    return config;
  }

  return {
    ...config,
    export: {
      ...exportConfig,
      enabledSources: [...exportConfig.enabledSources, sourceName],
    },
  };
}

/**
 * Disables a backup source for export operations.
 *
 * Removes the source name from export.enabledSources if present.
 * Returns a new configuration object.
 *
 * @param config - Current configuration
 * @param sourceName - Name of the source to disable for export
 * @returns New configuration with the source disabled for export
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const updated = disableSourceForExport(config, 'old-source');
 * await saveConfig(updated);
 * ```
 */
export function disableSourceForExport(
  config: AudioToolsConfig,
  sourceName: string
): AudioToolsConfig {
  const exportConfig = config.export ?? {
    outputRoot: '',
    formats: [],
    skipUnchanged: true,
    enabledSources: [],
  };

  return {
    ...config,
    export: {
      ...exportConfig,
      enabledSources: exportConfig.enabledSources.filter((s) => s !== sourceName),
    },
  };
}

/**
 * Gets all backup sources that are enabled for export.
 *
 * Returns the intersection of enabled backup sources and sources
 * listed in export.enabledSources.
 *
 * @param config - Current configuration
 * @returns Array of backup sources that are enabled for export
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const exportSources = getEnabledExportSources(config);
 * console.log(`Exporting from ${exportSources.length} sources`);
 *
 * for (const source of exportSources) {
 *   console.log(`- ${source.name}: ${source.source}`);
 * }
 * ```
 */
export function getEnabledExportSources(config: AudioToolsConfig): BackupSource[] {
  const backup = config.backup ?? { backupRoot: '', sources: [] };
  const exportConfig = config.export ?? {
    outputRoot: '',
    formats: [],
    skipUnchanged: true,
    enabledSources: [],
  };

  // Return sources that are both enabled and in the enabledSources list
  return backup.sources.filter(
    (s) => s.enabled && exportConfig.enabledSources.includes(s.name)
  );
}

// ============================================================================
// Generic Tool Configuration Operations
// ============================================================================

/**
 * Gets configuration for a specific tool.
 *
 * Enables future tools to store their configuration in the unified config file.
 * Returns undefined if the tool has no configuration.
 *
 * @typeParam T - Type of the tool configuration
 * @param config - Current configuration
 * @param toolName - Name of the tool (e.g., 'myTool', 'converter', etc.)
 * @returns Tool configuration object or undefined
 *
 * @example
 * ```typescript
 * interface MyToolConfig {
 *   setting1: string;
 *   setting2: number;
 * }
 *
 * const config = await loadConfig();
 * const toolConfig = getToolConfig<MyToolConfig>(config, 'myTool');
 *
 * if (toolConfig) {
 *   console.log(toolConfig.setting1);
 * }
 * ```
 */
export function getToolConfig<T>(
  config: AudioToolsConfig,
  toolName: string
): T | undefined {
  return config[toolName] as T | undefined;
}

/**
 * Sets configuration for a specific tool.
 *
 * Enables future tools to store their configuration in the unified config file.
 * Returns a new configuration object with the tool configuration added/updated.
 *
 * @typeParam T - Type of the tool configuration
 * @param config - Current configuration
 * @param toolName - Name of the tool (e.g., 'myTool', 'converter', etc.)
 * @param toolConfig - Tool configuration object
 * @returns New configuration with the tool configuration set
 *
 * @example
 * ```typescript
 * interface MyToolConfig {
 *   setting1: string;
 *   setting2: number;
 * }
 *
 * const config = await loadConfig();
 * const updated = setToolConfig<MyToolConfig>(config, 'myTool', {
 *   setting1: 'value',
 *   setting2: 42
 * });
 * await saveConfig(updated);
 * ```
 */
export function setToolConfig<T>(
  config: AudioToolsConfig,
  toolName: string,
  toolConfig: T
): AudioToolsConfig {
  return {
    ...config,
    [toolName]: toolConfig,
  };
}
