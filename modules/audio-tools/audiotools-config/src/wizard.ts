/**
 * Interactive configuration wizard for audio-tools.
 *
 * Provides user-friendly prompts for configuring backup sources, export settings,
 * and discovering/importing existing backups. Uses inquirer for interactive CLI prompts.
 *
 * @module audiotools-config/wizard
 */

import inquirer from 'inquirer';
import type {
  AudioToolsConfig,
  BackupSource,
  DiscoveredBackup,
} from '@/types.js';
import {
  loadConfig,
  saveConfig,
  addBackupSource,
  updateBackupSource,
  removeBackupSource,
  updateExportConfig,
  enableSourceForExport,
  disableSourceForExport,
  DEFAULT_CONFIG_PATH,
} from '@/config.js';
import {
  discoverExistingBackups,
  importDiscoveredBackups,
} from '@/discovery.js';
import {
  validateBackupSource,
  testBackupSourceConnection,
} from '@/validator.js';

/**
 * Format bytes to human-readable size.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "3.2 GB", "150 MB")
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/**
 * Display a configuration summary.
 *
 * @param config - Configuration to summarize
 */
function displayConfigSummary(config: AudioToolsConfig): void {
  console.log('\n=== Current Configuration ===\n');

  // Backup sources summary
  const backupSources = config.backup?.sources || [];
  const enabledBackup = backupSources.filter((s) => s.enabled);

  console.log(`Backup Sources: ${backupSources.length} total, ${enabledBackup.length} enabled`);
  if (backupSources.length > 0) {
    backupSources.forEach((source) => {
      const status = source.enabled ? '✓' : '✗';
      console.log(`  ${status} ${source.name} (${source.type}): ${source.source}`);
    });
  }

  // Export settings summary
  const exportConfig = config.export;
  if (exportConfig) {
    console.log(`\nExport Settings:`);
    console.log(`  Output formats: ${exportConfig.formats.join(', ')}`);
    console.log(`  Skip unchanged: ${exportConfig.skipUnchanged ? 'yes' : 'no'}`);
    console.log(`  Enabled sources: ${exportConfig.enabledSources.length > 0 ? exportConfig.enabledSources.join(', ') : 'none'}`);
  }

  console.log('');
}

/**
 * Import existing backups wizard.
 *
 * Presents discovered backups to the user and allows them to selectively
 * import them as configured backup sources.
 *
 * @param discovered - Array of discovered backups
 * @returns Array of BackupSource configurations to add
 *
 * @example
 * ```typescript
 * const discovered = await discoverExistingBackups();
 * if (discovered.length > 0) {
 *   const sources = await importBackupsWizard(discovered);
 *   // Add sources to config
 * }
 * ```
 */
export async function importBackupsWizard(
  discovered: DiscoveredBackup[]
): Promise<BackupSource[]> {
  if (discovered.length === 0) {
    return [];
  }

  console.log('\n=== Discovered Existing Backups ===\n');

  // Display discovered backups
  discovered.forEach((backup, index) => {
    console.log(`${index + 1}. ${backup.sampler}/${backup.device}`);
    console.log(`   Path: ${backup.path}`);
    console.log(`   Files: ${backup.fileCount}, Size: ${formatSize(backup.totalSize)}`);
    console.log(`   Last modified: ${backup.lastModified.toLocaleString()}`);
    console.log(`   Inferred type: ${backup.inferredType}`);
    console.log('');
  });

  // Ask if user wants to import
  const { shouldImport } = await inquirer.prompt<{ shouldImport: boolean }>([
    {
      type: 'confirm',
      name: 'shouldImport',
      message: 'Import these as backup sources?',
      default: true,
    },
  ]);

  if (!shouldImport) {
    return [];
  }

  // Let user select which to import
  const { selectedIndices } = await inquirer.prompt<{ selectedIndices: number[] }>([
    {
      type: 'checkbox',
      name: 'selectedIndices',
      message: 'Select backups to import:',
      choices: discovered.map((backup, index) => ({
        name: `${backup.sampler}/${backup.device} (${formatSize(backup.totalSize)})`,
        value: index,
        checked: true,
      })),
    },
  ]);

  const sources: BackupSource[] = [];

  // Configure each selected backup
  for (const index of selectedIndices) {
    const backup = discovered[index];
    console.log(`\nConfiguring: ${backup.sampler}/${backup.device}`);

    // Confirm/adjust source type
    const { sourceType } = await inquirer.prompt<{ sourceType: 'remote' | 'local' }>([
      {
        type: 'list',
        name: 'sourceType',
        message: 'Source type:',
        choices: ['remote', 'local'],
        default: backup.inferredType,
      },
    ]);

    // Generate default name
    const defaultName = `${backup.sampler}-${backup.device}`;

    // Prompt for source details
    const { name, source, device, sampler, enableBackup, enableExport } = await inquirer.prompt<{
      name: string;
      source: string;
      device: string;
      sampler?: string;
      enableBackup: boolean;
      enableExport: boolean;
    }>([
      {
        type: 'input',
        name: 'name',
        message: 'Source name:',
        default: defaultName,
        validate: (input: string) => {
          if (!input || input.trim() === '') {
            return 'Name cannot be empty';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'source',
        message:
          sourceType === 'remote'
            ? 'SSH path (user@host:path or host:path):'
            : 'Local path:',
        default:
          sourceType === 'remote'
            ? `${backup.sampler}:~/`
            : backup.path,
        validate: (input: string) => {
          if (!input || input.trim() === '') {
            return 'Source path cannot be empty';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'device',
        message: 'Device identifier:',
        default: backup.device,
        validate: (input: string) => {
          if (!input || input.trim() === '') {
            return 'Device cannot be empty';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'sampler',
        message: 'Sampler model (optional for remote, required for local):',
        default: backup.sampler,
        when: () => sourceType === 'local',
        validate: (input: string) => {
          if (sourceType === 'local' && (!input || input.trim() === '')) {
            return 'Sampler model is required for local sources';
          }
          return true;
        },
      },
      {
        type: 'confirm',
        name: 'enableBackup',
        message: 'Enable for backup?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'enableExport',
        message: 'Enable for extraction?',
        default: true,
      },
    ]);

    sources.push({
      name,
      type: sourceType,
      source,
      device,
      sampler: sourceType === 'local' ? sampler : backup.sampler,
      enabled: enableBackup,
    });
  }

  return sources;
}

/**
 * Add backup source wizard.
 *
 * Guides the user through creating a new backup source configuration.
 *
 * @param config - Current configuration
 * @returns New BackupSource configuration
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const newSource = await addBackupSourceWizard(config);
 * const updated = addBackupSource(config, newSource);
 * await saveConfig(updated);
 * ```
 */
export async function addBackupSourceWizard(
  config: AudioToolsConfig
): Promise<BackupSource> {
  console.log('\n=== Add Backup Source ===\n');

  const answers = await inquirer.prompt<{
    sourceType: 'remote' | 'local';
    name: string;
    source: string;
    device: string;
    sampler?: string;
    enableBackup: boolean;
    enableExport: boolean;
  }>([
    {
      type: 'list',
      name: 'sourceType',
      message: 'Source type:',
      choices: [
        { name: 'Remote (SSH/PiSCSI)', value: 'remote' },
        { name: 'Local (SD card/USB drive)', value: 'local' },
      ],
    },
    {
      type: 'input',
      name: 'name',
      message: 'Source name (unique identifier):',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Name cannot be empty';
        }
        // Check for duplicate names
        const existing = config.backup?.sources || [];
        if (existing.some((s) => s.name === input)) {
          return `Source "${input}" already exists`;
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'source',
      message: (answers: any) =>
        answers.sourceType === 'remote'
          ? 'SSH path (user@host:path or host:path):'
          : 'Local path (e.g., /Volumes/AKAI_SD):',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Source path cannot be empty';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'device',
      message: 'Device identifier (e.g., images, floppy, sd-card):',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Device cannot be empty';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'sampler',
      message: 'Sampler model (e.g., s5000, s3000xl):',
      when: (answers: any) => answers.sourceType === 'local',
      validate: (input: string, answers: any) => {
        if (answers.sourceType === 'local' && (!input || input.trim() === '')) {
          return 'Sampler model is required for local sources';
        }
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'enableBackup',
      message: 'Enable for backup?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'enableExport',
      message: 'Enable for extraction?',
      default: true,
    },
  ]);

  const newSource: BackupSource = {
    name: answers.name,
    type: answers.sourceType,
    source: answers.source,
    device: answers.device,
    sampler: answers.sampler,
    enabled: answers.enableBackup,
  };

  // Validate the source (will throw if invalid)
  try {
    validateBackupSource(newSource);
  } catch (error) {
    console.error('\nValidation error:', error instanceof Error ? error.message : String(error));
    throw new Error('Invalid backup source configuration');
  }

  return newSource;
}

/**
 * Edit backup source wizard.
 *
 * Allows editing of an existing backup source configuration.
 *
 * @param config - Current configuration
 * @returns Promise that resolves when editing is complete
 *
 * @example
 * ```typescript
 * let config = await loadConfig();
 * await editBackupSourceWizard(config);
 * // Config is updated by the wizard
 * ```
 */
export async function editBackupSourceWizard(
  config: AudioToolsConfig
): Promise<void> {
  const sources = config.backup?.sources || [];

  if (sources.length === 0) {
    console.log('\nNo backup sources configured yet.');
    return;
  }

  // Select source to edit
  const { sourceName } = await inquirer.prompt<{ sourceName: string }>([
    {
      type: 'list',
      name: 'sourceName',
      message: 'Select source to edit:',
      choices: sources.map((s) => ({
        name: `${s.name} (${s.type}): ${s.source}`,
        value: s.name,
      })),
    },
  ]);

  const source = sources.find((s) => s.name === sourceName);
  if (!source) {
    throw new Error(`Source not found: ${sourceName}`);
  }

  console.log(`\nEditing: ${source.name}`);
  console.log('(Press Enter to keep current value)\n');

  // Edit fields (show current as default)
  const updates = await inquirer.prompt<{
    source: string;
    device: string;
    sampler?: string;
    enabled: boolean;
  }>([
    {
      type: 'input',
      name: 'source',
      message: 'Source path:',
      default: source.source,
    },
    {
      type: 'input',
      name: 'device',
      message: 'Device identifier:',
      default: source.device,
    },
    {
      type: 'input',
      name: 'sampler',
      message: 'Sampler model:',
      default: source.sampler || '',
      when: source.type === 'local',
    },
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enabled for backup?',
      default: source.enabled,
    },
  ]);

  // Update the config
  const updatedConfig = updateBackupSource(config, sourceName, updates);

  // Validate updated source (will throw if invalid)
  const updatedSource = updatedConfig.backup?.sources.find((s) => s.name === sourceName);
  if (updatedSource) {
    try {
      validateBackupSource(updatedSource);
    } catch (error) {
      console.error('\nValidation error:', error instanceof Error ? error.message : String(error));
      throw new Error('Invalid backup source configuration');
    }
  }

  // Save changes
  await saveConfig(updatedConfig);
  console.log('\nSource updated successfully!');
}

/**
 * Remove backup source wizard.
 *
 * Allows removal of an existing backup source configuration.
 *
 * @param config - Current configuration
 * @returns Promise that resolves when removal is complete
 *
 * @example
 * ```typescript
 * let config = await loadConfig();
 * await removeBackupSourceWizard(config);
 * // Config is updated by the wizard
 * ```
 */
export async function removeBackupSourceWizard(
  config: AudioToolsConfig
): Promise<void> {
  const sources = config.backup?.sources || [];

  if (sources.length === 0) {
    console.log('\nNo backup sources configured yet.');
    return;
  }

  // Select source to remove
  const { sourceName } = await inquirer.prompt<{ sourceName: string }>([
    {
      type: 'list',
      name: 'sourceName',
      message: 'Select source to remove:',
      choices: sources.map((s) => ({
        name: `${s.name} (${s.type}): ${s.source}`,
        value: s.name,
      })),
    },
  ]);

  // Confirm removal
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Remove "${sourceName}"? This cannot be undone.`,
      default: false,
    },
  ]);

  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  // Remove and save
  const updatedConfig = removeBackupSource(config, sourceName);
  await saveConfig(updatedConfig);
  console.log(`\nSource "${sourceName}" removed successfully!`);
}

/**
 * Edit export configuration wizard.
 *
 * Allows editing of export settings (formats, output directory, etc.).
 *
 * @param config - Current configuration
 * @returns Promise that resolves when editing is complete
 *
 * @example
 * ```typescript
 * let config = await loadConfig();
 * await editExportConfigWizard(config);
 * // Config is updated by the wizard
 * ```
 */
export async function editExportConfigWizard(
  config: AudioToolsConfig
): Promise<void> {
  console.log('\n=== Export Configuration ===\n');

  const currentExport = config.export;

  const updates = await inquirer.prompt<{
    formats: ('sfz' | 'decentsampler')[];
    outputRoot: string;
    skipUnchanged: boolean;
  }>([
    {
      type: 'checkbox',
      name: 'formats',
      message: 'Output formats:',
      choices: [
        { name: 'SFZ', value: 'sfz', checked: currentExport?.formats.includes('sfz') },
        {
          name: 'DecentSampler',
          value: 'decentsampler',
          checked: currentExport?.formats.includes('decentsampler'),
        },
      ],
      validate: (input: string[]) => {
        if (input.length === 0) {
          return 'Select at least one format';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'outputRoot',
      message: 'Output directory:',
      default: currentExport?.outputRoot || '~/.audiotools/sampler-export/extracted',
    },
    {
      type: 'confirm',
      name: 'skipUnchanged',
      message: 'Skip unchanged disk images?',
      default: currentExport?.skipUnchanged ?? true,
    },
  ]);

  // Update and save
  const updatedConfig = updateExportConfig(config, updates);
  await saveConfig(updatedConfig);
  console.log('\nExport configuration updated successfully!');
}

/**
 * Main menu for configuration management.
 *
 * Provides a menu-driven interface for all configuration operations.
 * Loops until the user chooses to exit.
 *
 * @param config - Current configuration
 * @returns Promise that resolves when user exits
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * await mainMenu(config);
 * ```
 */
export async function mainMenu(config: AudioToolsConfig): Promise<void> {
  while (true) {
    displayConfigSummary(config);

    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Add backup source', value: 'add' },
          { name: 'Edit backup source', value: 'edit' },
          { name: 'Remove backup source', value: 'remove' },
          { name: 'Enable/disable source for backup', value: 'toggle-backup' },
          { name: 'Enable/disable source for extraction', value: 'toggle-export' },
          { name: 'Change extraction settings', value: 'export-config' },
          { name: 'Test backup source connection', value: 'test' },
          { name: 'View full configuration', value: 'view' },
          new inquirer.Separator(),
          { name: 'Exit', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') {
      console.log('\nConfiguration saved. Goodbye!');
      break;
    }

    try {
      switch (action) {
        case 'add': {
          const newSource = await addBackupSourceWizard(config);
          config = addBackupSource(config, newSource);
          const { enableExport } = await inquirer.prompt<{ enableExport: boolean }>([
            {
              type: 'confirm',
              name: 'enableExport',
              message: 'Enable this source for extraction?',
              default: true,
            },
          ]);
          if (enableExport) {
            config = enableSourceForExport(config, newSource.name);
          }
          await saveConfig(config);
          console.log('\nSource added successfully!');
          break;
        }

        case 'edit': {
          await editBackupSourceWizard(config);
          // Reload config after edit
          config = await loadConfig();
          break;
        }

        case 'remove': {
          await removeBackupSourceWizard(config);
          // Reload config after removal
          config = await loadConfig();
          break;
        }

        case 'toggle-backup': {
          const sources = config.backup?.sources || [];
          if (sources.length === 0) {
            console.log('\nNo backup sources configured yet.');
            break;
          }

          const { sourceName } = await inquirer.prompt<{ sourceName: string }>([
            {
              type: 'list',
              name: 'sourceName',
              message: 'Select source to toggle:',
              choices: sources.map((s) => ({
                name: `${s.enabled ? '✓' : '✗'} ${s.name} (${s.type})`,
                value: s.name,
              })),
            },
          ]);

          const source = sources.find((s) => s.name === sourceName);
          if (source) {
            config = updateBackupSource(config, sourceName, { enabled: !source.enabled });
            await saveConfig(config);
            console.log(`\n"${sourceName}" ${source.enabled ? 'disabled' : 'enabled'} for backup.`);
          }
          break;
        }

        case 'toggle-export': {
          const sources = config.backup?.sources || [];
          if (sources.length === 0) {
            console.log('\nNo backup sources configured yet.');
            break;
          }

          const enabledExport = config.export?.enabledSources || [];

          const { sourceName } = await inquirer.prompt<{ sourceName: string }>([
            {
              type: 'list',
              name: 'sourceName',
              message: 'Select source to toggle for extraction:',
              choices: sources.map((s) => ({
                name: `${enabledExport.includes(s.name) ? '✓' : '✗'} ${s.name} (${s.type})`,
                value: s.name,
              })),
            },
          ]);

          if (enabledExport.includes(sourceName)) {
            config = disableSourceForExport(config, sourceName);
            console.log(`\n"${sourceName}" disabled for extraction.`);
          } else {
            config = enableSourceForExport(config, sourceName);
            console.log(`\n"${sourceName}" enabled for extraction.`);
          }
          await saveConfig(config);
          break;
        }

        case 'export-config': {
          await editExportConfigWizard(config);
          // Reload config after edit
          config = await loadConfig();
          break;
        }

        case 'test': {
          const sources = config.backup?.sources || [];
          if (sources.length === 0) {
            console.log('\nNo backup sources configured yet.');
            break;
          }

          const { sourceName } = await inquirer.prompt<{ sourceName: string }>([
            {
              type: 'list',
              name: 'sourceName',
              message: 'Select source to test:',
              choices: sources.map((s) => ({
                name: `${s.name} (${s.type}): ${s.source}`,
                value: s.name,
              })),
            },
          ]);

          const source = sources.find((s) => s.name === sourceName);
          if (source) {
            console.log(`\nTesting connection to "${sourceName}"...`);
            const accessible = await testBackupSourceConnection(source);
            if (accessible) {
              console.log('✓ Connection successful!');
            } else {
              console.log('✗ Connection failed. Source is not accessible.');
            }
          }
          break;
        }

        case 'view': {
          console.log('\n=== Full Configuration ===\n');
          console.log(JSON.stringify(config, null, 2));
          console.log('');
          await inquirer.prompt([
            {
              type: 'input',
              name: 'continue',
              message: 'Press Enter to continue...',
            },
          ]);
          break;
        }
      }
    } catch (error: any) {
      console.error(`\nError: ${error.message}`);
      const { retry } = await inquirer.prompt<{ retry: boolean }>([
        {
          type: 'confirm',
          name: 'retry',
          message: 'Continue?',
          default: true,
        },
      ]);
      if (!retry) {
        break;
      }
    }
  }
}

/**
 * Main configuration wizard entry point.
 *
 * Coordinates the entire configuration workflow:
 * 1. Loads existing config or starts fresh
 * 2. Discovers existing backups (if no config)
 * 3. Offers to import discovered backups
 * 4. Runs initial setup or main menu
 * 5. Saves configuration
 *
 * @param configPath - Optional custom config file path
 * @returns Promise that resolves when wizard is complete
 *
 * @example
 * ```typescript
 * // Run with default config path
 * await runConfigWizard();
 *
 * // Run with custom path
 * await runConfigWizard('/custom/path/config.json');
 * ```
 */
export async function runConfigWizard(configPath?: string): Promise<void> {
  const path = configPath ?? DEFAULT_CONFIG_PATH;

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  Audio Tools Configuration Wizard         ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // Load existing config
  let config = await loadConfig(path);
  const hasConfig = config.backup && config.backup.sources.length > 0;

  if (!hasConfig) {
    console.log('No configuration found. Let\'s set up your audio tools!\n');

    // Check for existing backups
    console.log('Scanning for existing backups...');
    const discovered = await discoverExistingBackups(config.backup?.backupRoot);

    if (discovered.length > 0) {
      const importedSources = await importBackupsWizard(discovered);

      // Add imported sources to config
      for (const source of importedSources) {
        config = addBackupSource(config, source);
        config = enableSourceForExport(config, source.name);
      }

      if (importedSources.length > 0) {
        await saveConfig(config, path);
        console.log(`\nImported ${importedSources.length} backup source(s)!`);
      }
    } else {
      console.log('No existing backups found.\n');
    }

    // Initial setup if no sources yet
    if (!config.backup || config.backup.sources.length === 0) {
      console.log('=== Initial Setup ===\n');

      const { addSource } = await inquirer.prompt<{ addSource: boolean }>([
        {
          type: 'confirm',
          name: 'addSource',
          message: 'Add a backup source?',
          default: true,
        },
      ]);

      if (addSource) {
        const newSource = await addBackupSourceWizard(config);
        config = addBackupSource(config, newSource);
        config = enableSourceForExport(config, newSource.name);
      }

      // Configure export settings
      console.log('\n=== Export Settings ===\n');
      await editExportConfigWizard(config);
      config = await loadConfig(path); // Reload after export config edit

      await saveConfig(config, path);
      console.log('\nInitial configuration saved!');
    }
  }

  // Show main menu
  await mainMenu(config);
}
