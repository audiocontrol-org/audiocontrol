# @audiocontrol/audiotools-config

**Shared configuration system for audio-tools packages.**

## Purpose

The `audiotools-config` package provides a unified configuration system for all audio-tools packages (backup, export, and future tools). It manages a single configuration file at `~/.audiotools/config.json`, enabling zero-flag workflows and consistent configuration across all tools.

## Features

- **Single config file**: `~/.audiotools/config.json` for all tools
- **Type-safe API**: Full TypeScript support with strict types
- **CRUD operations**: Complete create, read, update, delete operations for configuration
- **Auto-discovery**: Automatically discover existing backups and import them
- **Interactive wizard**: User-friendly configuration via terminal prompts
- **Extensible**: Easy to add configuration for new tools
- **Validation**: Built-in validation for all configuration values

## Installation

### As a Library Dependency

```bash
# In your package.json
{
  "dependencies": {
    "@audiocontrol/audiotools-config": "^1.0.0"
  }
}
```

### Standalone (Not Recommended)

```bash
npm install -g @audiocontrol/audiotools-config
```

**Note:** This package is typically installed as a dependency of other audio-tools packages. For end users, install `@audiocontrol/audiotools` instead.

## Configuration File Format

The configuration file is stored at `~/.audiotools/config.json`:

```json
{
  "version": "1.0",
  "backup": {
    "backupRoot": "~/.audiotools/backup",
    "sources": [
      {
        "name": "pi-scsi2",
        "type": "remote",
        "source": "pi-scsi2.local:~/images/",
        "device": "images",
        "sampler": "pi-scsi2",
        "enabled": true
      },
      {
        "name": "s5k-gotek",
        "type": "local",
        "source": "/Volumes/GOTEK",
        "device": "floppy",
        "sampler": "s5k-studio",
        "enabled": true
      }
    ]
  },
  "export": {
    "outputRoot": "~/.audiotools/sampler-export/extracted",
    "formats": ["sfz", "decentsampler"],
    "skipUnchanged": true,
    "enabledSources": ["pi-scsi2", "s5k-gotek"]
  }
}
```

### Configuration Schema

#### `AudioToolsConfig`

Top-level configuration object:

- `version`: Config format version (currently "1.0")
- `backup?`: Backup tool configuration (see `BackupConfig`)
- `export?`: Export tool configuration (see `ExportConfig`)
- `[key: string]`: Future tools can add their own configuration sections

#### `BackupConfig`

Configuration for the backup tool:

- `backupRoot`: Root directory for all backups (default: `~/.audiotools/backup`)
- `sources`: Array of backup sources (see `BackupSource`)

#### `BackupSource`

Individual backup source configuration:

- `name`: Unique identifier for this source (e.g., "pi-scsi2", "s5k-gotek")
- `type`: Source type - `"remote"` (SSH) or `"local"` (mounted media)
- `source`: Source path (e.g., "pi-scsi2.local:~/images/" or "/Volumes/GOTEK")
- `device`: Device identifier (e.g., "images", "floppy", "scsi0")
- `sampler?`: Sampler name (optional, defaults to source name)
- `enabled`: Whether this source is active for backups

**Device UUID Tracking (Optional):**

For local media sources, additional fields enable device UUID tracking to recognize the same physical device across remounts:

- `volumeUUID?`: Primary device identifier (e.g., "12345678-1234-1234-1234-123456789012")
- `volumeLabel?`: Human-readable volume name (e.g., "SDCARD", "S5000_BACKUP")
- `volumeSerial?`: Fallback identifier for devices without UUID (e.g., "12345678-02")
- `lastSeen?`: ISO 8601 timestamp of last detection (e.g., "2025-10-09T14:30:00.000Z")
- `registeredAt?`: ISO 8601 timestamp when device was first registered (e.g., "2025-10-09T14:30:00.000Z")

**Example with UUID tracking:**
```typescript
{
  name: 's5k-sdcard',
  type: 'local',
  source: '/Volumes/SDCARD',
  device: 'sd-card',
  sampler: 's5000',
  enabled: true,
  volumeUUID: '12345678-1234-1234-1234-123456789012',
  volumeLabel: 'SDCARD',
  lastSeen: '2025-10-09T14:30:00.000Z',
  registeredAt: '2025-10-09T14:00:00.000Z'
}
```

**Backward Compatibility:**
All UUID fields are optional. Existing configurations remain valid without modification.


#### `ExportConfig`

Configuration for the export tool:

- `outputRoot`: Root directory for extracted files
- `formats`: Array of output formats - `"sfz"` and/or `"decentsampler"`
- `skipUnchanged`: Skip unchanged disk images during batch processing
- `enabledSources`: Array of source names enabled for export

## API Reference

### Configuration Loading and Saving

#### `loadConfig(path?: string): Promise<AudioToolsConfig>`

Load configuration from disk. Creates default config if none exists.

```typescript
import { loadConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
console.log(config.backup.sources);
```

**Parameters:**
- `path` (optional): Custom config file path (default: `~/.audiotools/config.json`)

**Returns:** Promise resolving to the loaded configuration

#### `saveConfig(config: AudioToolsConfig, path?: string): Promise<void>`

Save configuration to disk.

```typescript
import { saveConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
config.backup.sources.push(newSource);
await saveConfig(config);
```

**Parameters:**
- `config`: Configuration object to save
- `path` (optional): Custom config file path (default: `~/.audiotools/config.json`)

#### `getDefaultConfig(): AudioToolsConfig`

Get default configuration structure.

```typescript
import { getDefaultConfig } from '@audiocontrol/audiotools-config';

const defaultConfig = getDefaultConfig();
```

**Returns:** Default configuration object

### Backup Source Operations

#### `addBackupSource(config: AudioToolsConfig, source: BackupSource): AudioToolsConfig`

Add a new backup source to configuration.

```typescript
import { addBackupSource, loadConfig, saveConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const newSource = {
  name: 's5k-zulu',
  type: 'local',
  source: '/Volumes/ZULUSCSI',
  device: 'scsi0',
  sampler: 's5k-studio',
  enabled: true,
};

const updatedConfig = addBackupSource(config, newSource);
await saveConfig(updatedConfig);
```

**Parameters:**
- `config`: Current configuration
- `source`: Backup source to add

**Returns:** Updated configuration (immutable)

**Throws:** Error if source with same name already exists

#### `updateBackupSource(config: AudioToolsConfig, name: string, updates: Partial<BackupSource>): AudioToolsConfig`

Update an existing backup source.

```typescript
import { updateBackupSource, loadConfig, saveConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const updatedConfig = updateBackupSource(config, 'pi-scsi2', {
  enabled: false,
  source: 'pi-scsi2.local:~/new-path/',
});
await saveConfig(updatedConfig);
```

**Parameters:**
- `config`: Current configuration
- `name`: Name of source to update
- `updates`: Partial source object with fields to update

**Returns:** Updated configuration (immutable)

**Throws:** Error if source not found

#### `removeBackupSource(config: AudioToolsConfig, name: string): AudioToolsConfig`

Remove a backup source from configuration.

```typescript
import { removeBackupSource, loadConfig, saveConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const updatedConfig = removeBackupSource(config, 'old-source');
await saveConfig(updatedConfig);
```

**Parameters:**
- `config`: Current configuration
- `name`: Name of source to remove

**Returns:** Updated configuration (immutable)

**Throws:** Error if source not found

#### `getEnabledBackupSources(config: AudioToolsConfig): BackupSource[]`

Get all backup sources where `enabled: true`.

```typescript
import { getEnabledBackupSources, loadConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const enabledSources = getEnabledBackupSources(config);

for (const source of enabledSources) {
  console.log(`Backing up: ${source.name}`);
}
```

**Parameters:**
- `config`: Current configuration

**Returns:** Array of enabled backup sources

#### `toggleBackupSource(config: AudioToolsConfig, name: string): AudioToolsConfig`

Toggle the `enabled` state of a backup source.

```typescript
import { toggleBackupSource, loadConfig, saveConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const updatedConfig = toggleBackupSource(config, 'pi-scsi2');
await saveConfig(updatedConfig);
```

**Parameters:**
- `config`: Current configuration
- `name`: Name of source to toggle

**Returns:** Updated configuration (immutable)

**Throws:** Error if source not found

### Export Configuration Operations

#### `updateExportConfig(config: AudioToolsConfig, updates: Partial<ExportConfig>): AudioToolsConfig`

Update export configuration.

```typescript
import { updateExportConfig, loadConfig, saveConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const updatedConfig = updateExportConfig(config, {
  formats: ['sfz'],
  skipUnchanged: false,
});
await saveConfig(updatedConfig);
```

**Parameters:**
- `config`: Current configuration
- `updates`: Partial export config with fields to update

**Returns:** Updated configuration (immutable)

#### `enableSourceForExport(config: AudioToolsConfig, sourceName: string): AudioToolsConfig`

Enable a backup source for export processing.

```typescript
import { enableSourceForExport, loadConfig, saveConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const updatedConfig = enableSourceForExport(config, 's5k-gotek');
await saveConfig(updatedConfig);
```

**Parameters:**
- `config`: Current configuration
- `sourceName`: Name of source to enable for export

**Returns:** Updated configuration (immutable)

#### `disableSourceForExport(config: AudioToolsConfig, sourceName: string): AudioToolsConfig`

Disable a backup source for export processing.

```typescript
import { disableSourceForExport, loadConfig, saveConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const updatedConfig = disableSourceForExport(config, 'old-source');
await saveConfig(updatedConfig);
```

**Parameters:**
- `config`: Current configuration
- `sourceName`: Name of source to disable for export

**Returns:** Updated configuration (immutable)

#### `getEnabledExportSources(config: AudioToolsConfig): BackupSource[]`

Get all backup sources enabled for export.

```typescript
import { getEnabledExportSources, loadConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const exportSources = getEnabledExportSources(config);

for (const source of exportSources) {
  console.log(`Exporting: ${source.name}`);
}
```

**Parameters:**
- `config`: Current configuration

**Returns:** Array of backup sources enabled for export

### Generic Tool Configuration

These functions support configuration for future tools.

#### `getToolConfig<T>(config: AudioToolsConfig, toolName: string): T | undefined`

Get configuration for a specific tool.

```typescript
import { getToolConfig } from '@audiocontrol/audiotools-config';

interface MyToolConfig {
  setting1: string;
  setting2: number;
}

const config = await loadConfig();
const myToolConfig = getToolConfig<MyToolConfig>(config, 'myTool');

if (myToolConfig) {
  console.log(myToolConfig.setting1);
}
```

**Parameters:**
- `config`: Current configuration
- `toolName`: Name of tool configuration section

**Returns:** Tool configuration or `undefined` if not found

#### `setToolConfig<T>(config: AudioToolsConfig, toolName: string, toolConfig: T): AudioToolsConfig`

Set configuration for a specific tool.

```typescript
import { setToolConfig, saveConfig } from '@audiocontrol/audiotools-config';

interface MyToolConfig {
  setting1: string;
  setting2: number;
}

const config = await loadConfig();
const myToolConfig: MyToolConfig = {
  setting1: 'value',
  setting2: 42,
};

const updatedConfig = setToolConfig(config, 'myTool', myToolConfig);
await saveConfig(updatedConfig);
```

**Parameters:**
- `config`: Current configuration
- `toolName`: Name of tool configuration section
- `toolConfig`: Configuration object for the tool

**Returns:** Updated configuration (immutable)

### Validation

#### `validateBackupSource(source: Partial<BackupSource>): ValidationResult`

Validate a backup source configuration.

```typescript
import { validateBackupSource } from '@audiocontrol/audiotools-config';

const result = validateBackupSource({
  name: 'my-source',
  type: 'remote',
  source: 'host:~/path/',
  device: 'images',
});

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

**Returns:** `ValidationResult` with `valid: boolean` and `errors: string[]`

#### `validateExportConfig(exportConfig: Partial<ExportConfig>): ValidationResult`

Validate export configuration.

```typescript
import { validateExportConfig } from '@audiocontrol/audiotools-config';

const result = validateExportConfig({
  outputRoot: '~/.audiotools/export',
  formats: ['sfz', 'decentsampler'],
});

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

**Returns:** `ValidationResult` with `valid: boolean` and `errors: string[]`

#### `validateUnifiedConfig(config: AudioToolsConfig): ValidationResult`

Validate entire configuration structure.

```typescript
import { validateUnifiedConfig, loadConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const result = validateUnifiedConfig(config);

if (!result.valid) {
  console.error('Configuration has errors:', result.errors);
}
```

**Returns:** `ValidationResult` with `valid: boolean` and `errors: string[]`

#### `testBackupSourceConnection(source: BackupSource): Promise<ValidationResult>`

Test connectivity to a backup source (SSH or local path).

```typescript
import { testBackupSourceConnection } from '@audiocontrol/audiotools-config';

const source = {
  name: 'pi-scsi2',
  type: 'remote',
  source: 'pi-scsi2.local:~/images/',
  device: 'images',
  enabled: true,
};

const result = await testBackupSourceConnection(source);

if (result.valid) {
  console.log('Connection successful!');
} else {
  console.error('Connection failed:', result.errors);
}
```

**Returns:** Promise resolving to `ValidationResult`

### Auto-Discovery

#### `discoverExistingBackups(backupRoot?: string): Promise<DiscoveredBackup[]>`

Discover existing backups in a directory structure.

```typescript
import { discoverExistingBackups } from '@audiocontrol/audiotools-config';

const discovered = await discoverExistingBackups('~/.audiotools/backup');

for (const backup of discovered) {
  console.log(`Found: ${backup.sampler}/${backup.device}`);
  console.log(`  Files: ${backup.fileCount}`);
  console.log(`  Size: ${(backup.totalSize / 1024 / 1024).toFixed(1)} MB`);
}
```

**Parameters:**
- `backupRoot` (optional): Directory to search (default: `~/.audiotools/backup`)

**Returns:** Promise resolving to array of discovered backups

#### `inferBackupType(samplerName: string): 'remote' | 'local'`

Infer backup type from sampler name.

```typescript
import { inferBackupType } from '@audiocontrol/audiotools-config';

const type1 = inferBackupType('pi-scsi2');  // 'remote' (SSH-based)
const type2 = inferBackupType('s5k-gotek'); // 'local' (local media)
```

**Parameters:**
- `samplerName`: Sampler/source name

**Returns:** Inferred type: `'remote'` or `'local'`

#### `importDiscoveredBackups(discovered: DiscoveredBackup[]): Promise<BackupSource[]>`

Convert discovered backups into backup source configurations.

```typescript
import { discoverExistingBackups, importDiscoveredBackups } from '@audiocontrol/audiotools-config';

const discovered = await discoverExistingBackups();
const sources = await importDiscoveredBackups(discovered);

// Add sources to config
const config = await loadConfig();
for (const source of sources) {
  config = addBackupSource(config, source);
}
await saveConfig(config);
```

**Parameters:**
- `discovered`: Array of discovered backups

**Returns:** Promise resolving to array of backup source configurations

### Interactive Wizard

#### `runConfigWizard(configPath?: string): Promise<void>`

Run the full interactive configuration wizard.

```typescript
import { runConfigWizard } from '@audiocontrol/audiotools-config';

// Run wizard (will create or load config, prompt user, and save)
await runConfigWizard();
```

**Parameters:**
- `configPath` (optional): Custom config file path

**Returns:** Promise that resolves when wizard completes

#### `mainMenu(config: AudioToolsConfig): Promise<void>`

Display the main configuration menu.

```typescript
import { mainMenu, loadConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
await mainMenu(config);
```

**Parameters:**
- `config`: Current configuration

**Returns:** Promise that resolves when menu interaction completes

#### `addBackupSourceWizard(config: AudioToolsConfig): Promise<BackupSource>`

Interactive wizard to add a backup source.

```typescript
import { addBackupSourceWizard, loadConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
const newSource = await addBackupSourceWizard(config);
console.log(`Added source: ${newSource.name}`);
```

**Parameters:**
- `config`: Current configuration

**Returns:** Promise resolving to the new backup source

#### `editBackupSourceWizard(config: AudioToolsConfig): Promise<void>`

Interactive wizard to edit backup sources.

```typescript
import { editBackupSourceWizard, loadConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
await editBackupSourceWizard(config);
```

**Parameters:**
- `config`: Current configuration

**Returns:** Promise that resolves when editing completes

#### `removeBackupSourceWizard(config: AudioToolsConfig): Promise<void>`

Interactive wizard to remove backup sources.

```typescript
import { removeBackupSourceWizard, loadConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
await removeBackupSourceWizard(config);
```

**Parameters:**
- `config`: Current configuration

**Returns:** Promise that resolves when removal completes

#### `editExportConfigWizard(config: AudioToolsConfig): Promise<void>`

Interactive wizard to edit export configuration.

```typescript
import { editExportConfigWizard, loadConfig } from '@audiocontrol/audiotools-config';

const config = await loadConfig();
await editExportConfigWizard(config);
```

**Parameters:**
- `config`: Current configuration

**Returns:** Promise that resolves when editing completes

#### `importBackupsWizard(discovered: DiscoveredBackup[]): Promise<BackupSource[]>`

Interactive wizard to import discovered backups.

```typescript
import { discoverExistingBackups, importBackupsWizard } from '@audiocontrol/audiotools-config';

const discovered = await discoverExistingBackups();
const sources = await importBackupsWizard(discovered);
console.log(`Imported ${sources.length} sources`);
```

**Parameters:**
- `discovered`: Array of discovered backups

**Returns:** Promise resolving to array of selected backup sources

## Usage Examples

### Basic Configuration Workflow

```typescript
import {
  loadConfig,
  saveConfig,
  addBackupSource,
  enableSourceForExport,
} from '@audiocontrol/audiotools-config';

// Load existing config or create default
const config = await loadConfig();

// Add a backup source
const piScsiSource = {
  name: 'pi-scsi2',
  type: 'remote' as const,
  source: 'pi-scsi2.local:~/images/',
  device: 'images',
  enabled: true,
};

let updatedConfig = addBackupSource(config, piScsiSource);

// Enable source for export
updatedConfig = enableSourceForExport(updatedConfig, 'pi-scsi2');

// Save configuration
await saveConfig(updatedConfig);
```

### Auto-Discovery and Import

```typescript
import {
  discoverExistingBackups,
  importDiscoveredBackups,
  loadConfig,
  saveConfig,
  addBackupSource,
} from '@audiocontrol/audiotools-config';

// Discover existing backups
const discovered = await discoverExistingBackups();

console.log(`Found ${discovered.length} existing backup structures`);

// Import as backup sources
const sources = await importDiscoveredBackups(discovered);

// Add to configuration
let config = await loadConfig();
for (const source of sources) {
  config = addBackupSource(config, source);
}

await saveConfig(config);
```

### Reading Configuration in a Tool

```typescript
import { loadConfig, getEnabledBackupSources } from '@audiocontrol/audiotools-config';

async function runBackup() {
  const config = await loadConfig();
  const sources = getEnabledBackupSources(config);

  if (sources.length === 0) {
    console.error('No backup sources configured');
    process.exit(1);
  }

  for (const source of sources) {
    console.log(`Backing up ${source.name}...`);
    // Perform backup using source configuration
  }
}
```

### Interactive Configuration

```typescript
import { runConfigWizard } from '@audiocontrol/audiotools-config';

// Launch interactive wizard
await runConfigWizard();
```

The wizard will:
1. Detect existing backups and offer to import them
2. Allow user to add/edit/remove backup sources
3. Configure export settings (formats, output paths)
4. Validate all inputs
5. Save configuration to `~/.audiotools/config.json`

## Integration Guide for New Tools

Adding configuration support for a new audio-tool:

### 1. Define Tool Configuration Type

```typescript
// In your tool package
export interface MyToolConfig {
  setting1: string;
  setting2: number;
  enabled: boolean;
}
```

### 2. Load and Use Configuration

```typescript
import { loadConfig, getToolConfig } from '@audiocontrol/audiotools-config';

async function myToolMain() {
  const config = await loadConfig();
  const myConfig = getToolConfig<MyToolConfig>(config, 'myTool');

  if (!myConfig) {
    console.error('Tool not configured. Run: audiotools config');
    process.exit(1);
  }

  // Use configuration
  console.log(myConfig.setting1);
}
```

### 3. Add Wizard Support (Optional)

```typescript
import { loadConfig, saveConfig, setToolConfig } from '@audiocontrol/audiotools-config';
import inquirer from 'inquirer';

export async function configureMyTool() {
  const config = await loadConfig();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'setting1',
      message: 'Enter setting1:',
    },
    {
      type: 'number',
      name: 'setting2',
      message: 'Enter setting2:',
    },
  ]);

  const myConfig: MyToolConfig = {
    setting1: answers.setting1,
    setting2: answers.setting2,
    enabled: true,
  };

  const updatedConfig = setToolConfig(config, 'myTool', myConfig);
  await saveConfig(updatedConfig);
}
```

### 4. Register with Unified CLI

```typescript
// In audiotools-cli/src/commands/my-tool.ts
import { Command } from 'commander';
import { loadConfig, getToolConfig } from '@audiocontrol/audiotools-config';
import { MyToolConfig, runMyTool } from '@audiocontrol/my-tool';

export const myToolCommand = new Command('my-tool')
  .description('Run my tool')
  .action(async () => {
    const config = await loadConfig();
    const toolConfig = getToolConfig<MyToolConfig>(config, 'myTool');

    if (!toolConfig) {
      console.error('Not configured. Run: audiotools config');
      process.exit(1);
    }

    await runMyTool(toolConfig);
  });

// In audiotools-cli/src/index.ts
import { myToolCommand } from './commands/my-tool.js';
program.addCommand(myToolCommand);
```

Now users can run:
```bash
audiotools config       # Configure your tool
audiotools my-tool      # Run your tool
```

## Design Principles

### Immutability

All configuration operations return new configuration objects rather than mutating existing ones:

```typescript
// Good: Immutable updates
const updated = addBackupSource(config, newSource);
await saveConfig(updated);

// Also valid: Chain operations
const updated = enableSourceForExport(
  addBackupSource(config, newSource),
  'new-source'
);
```

### Type Safety

All configuration structures are fully typed with TypeScript:

```typescript
import type { AudioToolsConfig, BackupSource, ExportConfig } from '@audiocontrol/audiotools-config';

// Full type inference and checking
const source: BackupSource = {
  name: 'test',
  type: 'remote',  // Only 'remote' | 'local' allowed
  source: 'host:path/',
  device: 'images',
  enabled: true,
};
```

### Extensibility

The configuration system supports future tools without breaking changes:

```typescript
// Future tools can add their config
interface AudioToolsConfig {
  version: string;
  backup?: BackupConfig;
  export?: ExportConfig;
  // Any other tool can add here
  [key: string]: any;
}

// Generic accessors support any tool
const myToolConfig = getToolConfig<MyToolConfig>(config, 'myTool');
```

### Validation

All inputs are validated before being saved:

```typescript
const result = validateBackupSource(source);
if (!result.valid) {
  console.error('Invalid source:', result.errors);
  process.exit(1);
}
```

## Constants

- `DEFAULT_CONFIG_PATH`: `~/.audiotools/config.json` - Default configuration file location

## TypeScript Types

All types are exported and available for import:

```typescript
import type {
  AudioToolsConfig,
  BackupSource,
  BackupConfig,
  ExportConfig,
  DiscoveredBackup,
  ValidationResult,
} from '@audiocontrol/audiotools-config';
```

## License

Apache-2.0

## Repository

Part of the [ol_dsp](https://github.com/oletizi/ol_dsp) monorepo.

See the [audio-tools documentation](../docs/1.0/unified-cli/README.md) for more information about the unified CLI system.
