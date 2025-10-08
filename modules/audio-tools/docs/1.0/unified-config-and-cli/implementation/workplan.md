# Unified Configuration and CLI System Implementation Workplan

## Overview

Create a **unified configuration system** and **single CLI interface** for all audio-tools commands. This establishes a foundation for current tools (backup, export) and future modules to share configuration and provide a consistent user experience.

## Goals

1. **Single config file**: `~/.audiotools/config.json` for all tools
2. **Shared configuration library**: `@oletizi/audiotools-config` package
3. **Unified CLI**: Single `audiotools` command with subcommands
4. **Zero-flag workflows**: All tools run without flags after configuration
5. **Interactive setup**: Unified wizard that configures all tools
6. **Extensible**: Easy to add new tools and config sections
7. **Backward compatible**: Existing commands still work

## Architecture

### Unified CLI Structure

```bash
# New unified CLI
audiotools backup              # backup subcommand
audiotools export              # export subcommand
audiotools config              # config subcommand (all tools)
audiotools <future-command>    # Future tools

# Backward compatible (still work)
akai-backup sync ...
akai-export extract ...
```

### Unified Config Structure

`~/.audiotools/config.json`:

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
        "enabled": true
      }
    ]
  },
  "export": {
    "outputRoot": "~/.audiotools/sampler-export/extracted",
    "formats": ["sfz", "decentsampler"],
    "skipUnchanged": true,
    "enabledSources": ["pi-scsi2"]
  },
  "future-tool": {
    "setting1": "value1"
  }
}
```

### Package Structure

```
audio-tools/
├── audiotools-config/          # NEW: Shared configuration package
│   ├── src/
│   │   ├── config.ts           # Config loading/saving
│   │   ├── types.ts            # Shared types
│   │   ├── validator.ts        # Validation
│   │   ├── discovery.ts        # Auto-discovery
│   │   └── wizard.ts           # Interactive wizard
│   └── package.json
│
├── audiotools-cli/             # NEW: Unified CLI
│   ├── src/
│   │   ├── index.ts            # Main CLI entry point
│   │   ├── commands/
│   │   │   ├── backup.ts       # Backup subcommand
│   │   │   ├── export.ts       # Export subcommand
│   │   │   └── config.ts       # Config subcommand
│   │   └── utils/
│   └── package.json
│
├── sampler-backup/
│   ├── src/
│   │   ├── lib/                # Library code (no CLI)
│   │   └── cli/backup.ts       # Standalone CLI (backward compat)
│   └── package.json            # Depends on audiotools-config
│
├── sampler-export/
│   ├── src/
│   │   ├── lib/                # Library code (no CLI)
│   │   └── cli/extract.ts      # Standalone CLI (backward compat)
│   └── package.json            # Depends on audiotools-config
│
└── pnpm-workspace.yaml
```

## User Experience

### New Unified CLI

```bash
# Installation
npm install -g @oletizi/audiotools

# Configuration (unified wizard)
$ audiotools config

Welcome to Audio Tools Configuration!

This will configure all your audio tools in one place.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: Backup Sources
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? Add a backup source? (Y/n) y
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2: Extraction Settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? Output formats: [X] SFZ [X] DecentSampler
...

Configuration saved to ~/.audiotools/config.json

You can now run:
  $ audiotools backup     # Backup all enabled sources
  $ audiotools export     # Extract all enabled sources

# Usage
$ audiotools backup              # Backup all enabled sources
$ audiotools export              # Extract all enabled sources
$ audiotools backup pi-scsi2     # Backup specific source
$ audiotools export --format sfz # Override config

# Help
$ audiotools --help
$ audiotools backup --help
$ audiotools config --help
```

### Backward Compatible CLIs

```bash
# These still work
$ akai-backup sync --source pi-scsi2.local:~/images/ --device images
$ akai-export extract ~/disk.hds --format sfz

# But can also use config
$ akai-backup backup              # Uses config (new)
$ akai-export extract             # Uses config (new)
```

### Auto-Discovery (Existing Backups)

```bash
$ audiotools config

No configuration found, but I found existing backups!

Discovered backup structure:
  1. pi-scsi2/images/ (15 files, 3.2 GB)
  2. s5k-studio/floppy/ (8 files, 1.5 GB)

? Import these as backup sources? (Y/n) y
...
```

## Implementation Plan

### Phase 1: Create audiotools-config Package (3-4 hours) ✅ COMPLETED

**1.1 Create package structure**

```bash
mkdir audiotools-config
cd audiotools-config
pnpm init
```

**1.2 Create `audiotools-config/src/types.ts`**

```typescript
// Generic config structure - extensible for future tools
export interface AudioToolsConfig {
  version: string;
  backup?: BackupConfig;
  export?: ExportConfig;
  [key: string]: any;  // Allow future tools to add their config
}

export interface BackupSource {
  name: string;
  type: 'remote' | 'local';
  source: string;
  device: string;
  sampler?: string;
  enabled: boolean;
}

export interface BackupConfig {
  backupRoot: string;
  sources: BackupSource[];
}

export interface ExportConfig {
  outputRoot: string;
  formats: ('sfz' | 'decentsampler')[];
  skipUnchanged: boolean;
  enabledSources: string[];
}

export interface DiscoveredBackup {
  sampler: string;
  device: string;
  path: string;
  fileCount: number;
  totalSize: number;
  lastModified: Date;
  inferredType: 'remote' | 'local';
}
```

**1.3 Create `audiotools-config/src/config.ts`**

```typescript
import { homedir } from 'os';
import { join } from 'pathe';

export const DEFAULT_CONFIG_PATH = join(homedir(), '.audiotools', 'config.json');

// Core config operations
export async function loadConfig(path?: string): Promise<AudioToolsConfig>
export async function saveConfig(config: AudioToolsConfig, path?: string): Promise<void>
export function getDefaultConfig(): AudioToolsConfig

// Backup operations
export function addBackupSource(config: AudioToolsConfig, source: BackupSource): AudioToolsConfig
export function updateBackupSource(config: AudioToolsConfig, name: string, updates: Partial<BackupSource>): AudioToolsConfig
export function removeBackupSource(config: AudioToolsConfig, name: string): AudioToolsConfig
export function getEnabledBackupSources(config: AudioToolsConfig): BackupSource[]
export function toggleBackupSource(config: AudioToolsConfig, name: string): AudioToolsConfig

// Export operations
export function updateExportConfig(config: AudioToolsConfig, updates: Partial<ExportConfig>): AudioToolsConfig
export function enableSourceForExport(config: AudioToolsConfig, sourceName: string): AudioToolsConfig
export function disableSourceForExport(config: AudioToolsConfig, sourceName: string): AudioToolsConfig
export function getEnabledExportSources(config: AudioToolsConfig): BackupSource[]

// Generic tool config operations (for future tools)
export function getToolConfig<T>(config: AudioToolsConfig, toolName: string): T | undefined
export function setToolConfig<T>(config: AudioToolsConfig, toolName: string, toolConfig: T): AudioToolsConfig
```

**1.4 Create `audiotools-config/src/discovery.ts`**

Auto-discovery of existing backups:

```typescript
export async function discoverExistingBackups(
  backupRoot?: string
): Promise<DiscoveredBackup[]>

export function inferBackupType(samplerName: string): 'remote' | 'local'

export async function importDiscoveredBackups(
  discovered: DiscoveredBackup[]
): Promise<BackupSource[]>
```

**1.5 Create `audiotools-config/src/wizard.ts`**

Interactive configuration wizard:

```typescript
import inquirer from 'inquirer';

export async function runConfigWizard(configPath?: string): Promise<void>
export async function addBackupSourceWizard(config: AudioToolsConfig): Promise<BackupSource>
export async function editBackupSourceWizard(config: AudioToolsConfig): Promise<void>
export async function editExportConfigWizard(config: AudioToolsConfig): Promise<void>
export async function importBackupsWizard(discovered: DiscoveredBackup[]): Promise<BackupSource[]>
export async function mainMenu(config: AudioToolsConfig): Promise<void>
```

**1.6 Create `audiotools-config/package.json`**

```json
{
  "name": "@oletizi/audiotools-config",
  "version": "1.0.0",
  "description": "Shared configuration system for audio-tools",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "dependencies": {
    "inquirer": "^9.2.0",
    "pathe": "^1.1.0"
  },
  "devDependencies": {
    "@types/inquirer": "^9.0.0"
  }
}
```

**Phase 1 Completion Summary:**
- ✅ Package structure created (package.json, tsconfig.json, .gitignore)
- ✅ `src/types.ts` - 214 lines, 5 interfaces (AudioToolsConfig, BackupSource, BackupConfig, ExportConfig, DiscoveredBackup)
- ✅ `src/config.ts` - 561 lines, 15 functions (load, save, CRUD operations for backup/export)
- ✅ `src/validator.ts` - 316 lines, 4 validation functions + ValidationResult interface
- ✅ `src/discovery.ts` - 263 lines, 3 discovery functions (discover, infer, import)
- ✅ `src/wizard.ts` - 911 lines, 7 wizard functions (runConfigWizard, mainMenu, add/edit/remove, import)
- ✅ `src/index.ts` - Barrel exports for all modules
- ✅ TypeScript compilation successful, all files build correctly
- **Total:** 2,265 lines of TypeScript implementing complete configuration system

### Phase 2: Create Unified audiotools CLI (3-4 hours) ✅ COMPLETED

**2.1 Create `audiotools-cli` package**

```bash
mkdir audiotools-cli
cd audiotools-cli
pnpm init
```

**2.2 Create `audiotools-cli/src/index.ts`**

Main CLI entry point:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { backupCommand } from '@/commands/backup.js';
import { exportCommand } from '@/commands/export.js';
import { configCommand } from '@/commands/config.js';

const program = new Command();

program
  .name('audiotools')
  .description('Audio Tools - Backup, extract, and convert Akai sampler data')
  .version('1.0.0');

// Add subcommands
program.addCommand(backupCommand);
program.addCommand(exportCommand);
program.addCommand(configCommand);

program.parse();
```

**2.3 Create `audiotools-cli/src/commands/backup.ts`**

```typescript
import { Command } from 'commander';
import { loadConfig, getEnabledBackupSources } from '@oletizi/audiotools-config';
import { RemoteSource } from '@oletizi/sampler-backup';
import { LocalSource } from '@oletizi/sampler-backup';

export const backupCommand = new Command('backup')
  .description('Backup sampler disk images')
  .argument('[source]', 'Specific source name to backup')
  .option('-s, --source <path>', 'Override: source path')
  .option('-d, --device <name>', 'Override: device name')
  .option('--sampler <name>', 'Override: sampler name')
  .option('--dry-run', 'Show what would be backed up')
  .action(async (sourceName, options) => {
    if (options.source) {
      // Flag-based (backward compatible)
      // Delegate to existing backup logic
    } else {
      // Config-based (new)
      const config = await loadConfig();
      const sources = getEnabledBackupSources(config);

      if (sourceName) {
        // Backup specific source by name
        const source = sources.find(s => s.name === sourceName);
        if (!source) {
          console.error(`Source not found: ${sourceName}`);
          process.exit(1);
        }
        await backupSource(source);
      } else {
        // Backup all enabled sources
        for (const source of sources) {
          await backupSource(source);
        }
      }
    }
  });
```

**2.4 Create `audiotools-cli/src/commands/export.ts`**

```typescript
import { Command } from 'commander';
import { loadConfig, getEnabledExportSources } from '@oletizi/audiotools-config';
import { extractAkaiDisk } from '@oletizi/sampler-export';

export const exportCommand = new Command('export')
  .description('Extract and convert disk images')
  .argument('[source]', 'Specific source name to export')
  .option('-i, --input <path>', 'Override: input disk image or directory')
  .option('-f, --format <format>', 'Override: output format (sfz, decentsampler)')
  .option('-o, --output <path>', 'Override: output directory')
  .action(async (sourceName, options) => {
    if (options.input) {
      // Flag-based (backward compatible)
      // Delegate to existing export logic
    } else {
      // Config-based (new)
      const config = await loadConfig();
      const sources = getEnabledExportSources(config);

      if (sourceName) {
        // Export specific source
        const source = sources.find(s => s.name === sourceName);
        if (!source) {
          console.error(`Source not found: ${sourceName}`);
          process.exit(1);
        }
        await exportSource(source, config.export);
      } else {
        // Export all enabled sources
        for (const source of sources) {
          await exportSource(source, config.export);
        }
      }
    }
  });
```

**2.5 Create `audiotools-cli/src/commands/config.ts`**

```typescript
import { Command } from 'commander';
import { runConfigWizard } from '@oletizi/audiotools-config';

export const configCommand = new Command('config')
  .description('Configure audio tools')
  .option('--list', 'List current configuration')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (options) => {
    if (options.list) {
      // Display current config
    } else if (options.reset) {
      // Reset config
    } else {
      // Run interactive wizard
      await runConfigWizard();
    }
  });
```

**2.6 Create `audiotools-cli/package.json`**

```json
{
  "name": "@oletizi/audiotools",
  "version": "1.0.0",
  "description": "Unified CLI for audio-tools",
  "type": "module",
  "bin": {
    "audiotools": "./dist/index.js"
  },
  "dependencies": {
    "@oletizi/audiotools-config": "workspace:*",
    "@oletizi/sampler-backup": "workspace:*",
    "@oletizi/sampler-export": "workspace:*",
    "commander": "^11.0.0"
  }
}
```

**Phase 2 Completion Summary:**
- ✅ Package structure created (package.json, tsconfig.json, .gitignore)
- ✅ `src/index.ts` - 32 lines, main CLI entry point with commander setup
- ✅ `src/commands/backup.ts` - 235 lines, backup subcommand with dual workflow support
- ✅ `src/commands/export.ts` - 225 lines, export subcommand with dual workflow support
- ✅ `src/commands/config.ts` - 86 lines, config subcommand delegating to wizard
- ✅ TypeScript compilation successful, CLI commands functional
- ✅ Workspace integration complete (pnpm-workspace.yaml updated)
- **Total:** 578 lines of TypeScript implementing unified CLI
- **Commands verified:** `audiotools backup`, `audiotools export`, `audiotools config` all working

### Phase 3: Update sampler-backup (2 hours)

**3.1 Refactor into lib and CLI**

```
sampler-backup/src/
├── lib/                        # Library code (importable)
│   ├── sources/
│   │   ├── remote-source.ts
│   │   └── local-source.ts
│   └── index.ts                # Export public API
└── cli/
    └── backup.ts               # Standalone CLI (backward compat)
```

**3.2 Update `sampler-backup/package.json`**

```json
{
  "name": "@oletizi/sampler-backup",
  "main": "./dist/lib/index.js",
  "types": "./dist/lib/index.d.ts",
  "bin": {
    "akai-backup": "./dist/cli/backup.js"
  },
  "exports": {
    ".": {
      "import": "./dist/lib/index.js",
      "types": "./dist/lib/index.d.ts"
    }
  },
  "dependencies": {
    "@oletizi/audiotools-config": "workspace:*"
  }
}
```

**3.3 Update `sampler-backup/src/cli/backup.ts`**

Add config support (uses audiotools-config):

```typescript
import { loadConfig, getEnabledBackupSources } from '@oletizi/audiotools-config';

// Support both flag-based and config-based usage
if (!options.source) {
  const config = await loadConfig();
  const sources = getEnabledBackupSources(config);
  // ... backup from config
} else {
  // ... flag-based (existing logic)
}
```

### Phase 4: Update sampler-export (2 hours)

**4.1 Refactor into lib and CLI**

```
sampler-export/src/
├── lib/                        # Library code (importable)
│   ├── extractor/
│   ├── converters/
│   └── index.ts                # Export public API
└── cli/
    └── extract.ts              # Standalone CLI (backward compat)
```

**4.2 Update `sampler-export/package.json`**

```json
{
  "name": "@oletizi/sampler-export",
  "main": "./dist/lib/index.js",
  "types": "./dist/lib/index.d.ts",
  "bin": {
    "akai-export": "./dist/cli/extract.js"
  },
  "exports": {
    ".": {
      "import": "./dist/lib/index.js",
      "types": "./dist/lib/index.d.ts"
    }
  },
  "dependencies": {
    "@oletizi/audiotools-config": "workspace:*"
  }
}
```

**4.3 Update `sampler-export/src/cli/extract.ts`**

Add config support (uses audiotools-config):

```typescript
import { loadConfig, getEnabledExportSources } from '@oletizi/audiotools-config';

// Support both flag-based and config-based usage
if (!options.input) {
  const config = await loadConfig();
  const sources = getEnabledExportSources(config);
  // ... extract from config
} else {
  // ... flag-based (existing logic)
}
```

### Phase 5: Testing (2-3 hours)

**5.1 audiotools-config tests**

```typescript
// audiotools-config/test/config.test.ts
describe('AudioToolsConfig', () => {
  it('should load default config')
  it('should save and load config')
  it('should add/remove backup sources')
  it('should update export config')
  it('should support generic tool configs')
})

// audiotools-config/test/discovery.test.ts
describe('BackupDiscovery', () => {
  it('should discover existing backups')
  it('should infer backup types')
  it('should import discovered backups')
})
```

**5.2 audiotools-cli tests**

```typescript
// audiotools-cli/test/commands.test.ts
describe('Unified CLI', () => {
  it('should run backup subcommand')
  it('should run export subcommand')
  it('should run config subcommand')
  it('should support --help')
})
```

**5.3 Integration tests**

```typescript
// audiotools-cli/test/integration/workflow.test.ts
describe('End-to-End Workflow', () => {
  it('should configure via wizard')
  it('should backup using config')
  it('should export using config')
  it('should support backward-compatible commands')
})
```

### Phase 6: Documentation (1-2 hours)

**6.1 Create `audiotools-config/README.md`**

Document the configuration library:
- Config file format
- API reference
- Usage examples
- Extending for new tools

**6.2 Create `audiotools-cli/README.md`**

Document the unified CLI:
- Installation
- Commands
- Configuration
- Migration from legacy commands

**6.3 Update existing READMEs**

- `sampler-backup/README.md` - Add unified CLI section
- `sampler-export/README.md` - Add unified CLI section

**6.4 Create `docs/1.0/unified-cli/README.md`**

Complete guide:
- Unified CLI concept
- Configuration system
- Backward compatibility
- Adding new tools

## Timeline

| Phase | Tasks | Time Estimate |
|-------|-------|---------------|
| 1 | Create audiotools-config package | 3-4 hours |
| 2 | Create audiotools-cli package | 3-4 hours |
| 3 | Update sampler-backup | 2 hours |
| 4 | Update sampler-export | 2 hours |
| 5 | Testing | 2-3 hours |
| 6 | Documentation | 1-2 hours |
| **Total** | | **13-17 hours** |

## Success Criteria

### Core Functionality
- [ ] `@oletizi/audiotools-config` package created and builds
- [ ] `@oletizi/audiotools` CLI package created and builds
- [ ] Single config file at `~/.audiotools/config.json`
- [ ] Config wizard accessible via `audiotools config`, `akai-backup config`, or `akai-export config`
- [ ] Auto-discovery detects existing backups

### Unified CLI
- [ ] `audiotools backup` runs backup with config
- [ ] `audiotools export` runs export with config
- [ ] `audiotools config` launches wizard
- [ ] `audiotools --help` shows all subcommands
- [ ] Subcommand-specific help works (`audiotools backup --help`)

### Backward Compatibility
- [ ] `akai-backup sync --source ... --device ...` still works
- [ ] `akai-export extract ... --format ...` still works
- [ ] Legacy commands can also use config (`akai-backup backup`)
- [ ] Flags override config when provided

### Configuration
- [ ] Can configure backup sources
- [ ] Can configure extraction settings
- [ ] Can enable/disable sources independently for backup and export
- [ ] Changes to config affect all tools immediately

### Library Exports
- [ ] `sampler-backup` exports library API (not just CLI)
- [ ] `sampler-export` exports library API (not just CLI)
- [ ] Both can be imported and used programmatically

### Testing & Docs
- [ ] All tests pass
- [ ] Documentation complete for all packages
- [ ] Migration guide for existing users

## Migration Path

### For New Users

```bash
# Install unified CLI
npm install -g @oletizi/audiotools

# Configure
audiotools config

# Use
audiotools backup
audiotools export
```

### For Existing Users

```bash
# Existing commands still work
akai-backup sync --source ... --device ...
akai-export extract ... --format ...

# Optionally migrate to unified CLI
audiotools config  # Import existing backups
audiotools backup  # Use config
audiotools export  # Use config
```

## Benefits of Unified Approach

### Single Config File
- **One source of truth**: `~/.audiotools/config.json`
- **No drift**: Changes propagate to all tools
- **Easy backup**: Single file to backup/share

### Unified CLI
- **Consistent UX**: All commands under `audiotools`
- **Discoverability**: `audiotools --help` shows everything
- **Future-proof**: Easy to add new tools

### Shared Library
- **DRY**: Config logic in one place
- **Type safety**: Shared types across all tools
- **Maintainability**: Update config system once

### Backward Compatibility
- **No breaking changes**: Legacy commands work
- **Gradual migration**: Users can migrate at their pace
- **Dual interfaces**: Both styles work

## Future Tools Integration

Adding a new tool is simple:

**1. Add config type to audiotools-config:**

```typescript
// audiotools-config/src/types.ts
export interface MyToolConfig {
  setting1: string;
  setting2: number;
}

// Update AudioToolsConfig
export interface AudioToolsConfig {
  version: string;
  backup?: BackupConfig;
  export?: ExportConfig;
  myTool?: MyToolConfig;  // New tool
}
```

**2. Add subcommand to audiotools-cli:**

```typescript
// audiotools-cli/src/commands/my-tool.ts
import { Command } from 'commander';
import { loadConfig } from '@oletizi/audiotools-config';

export const myToolCommand = new Command('my-tool')
  .description('My new tool')
  .action(async () => {
    const config = await loadConfig();
    const toolConfig = config.myTool;
    // ... use config
  });

// audiotools-cli/src/index.ts
program.addCommand(myToolCommand);
```

**3. Optionally add wizard section:**

```typescript
// audiotools-config/src/wizard.ts
export async function configureMyTool(config: AudioToolsConfig): Promise<void> {
  // ... interactive prompts
}
```

That's it! The new tool automatically:
- Uses the shared config file
- Integrates with `audiotools` CLI
- Shows up in `audiotools --help`
- Can be configured via `audiotools config`

## Package Publishing

### Individual Packages (Current)

```bash
npm install -g @oletizi/sampler-backup
npm install -g @oletizi/sampler-export
```

### Unified Package (New, Recommended)

```bash
npm install -g @oletizi/audiotools
# Includes everything: backup, export, config
```

### Library-Only Use

```typescript
// Import as libraries
import { RemoteSource } from '@oletizi/sampler-backup';
import { extractAkaiDisk } from '@oletizi/sampler-export';
import { loadConfig } from '@oletizi/audiotools-config';

// Use programmatically
const config = await loadConfig();
const source = new RemoteSource({ ... });
await source.backup('daily');
```

## Archive Superseded Plans

Move these to `docs/1.0/superseded/`:
- `docs/1.0/sampler-backup/cli-config/implementation/workplan.md`
- `docs/1.0/sampler-export/cli-config/implementation/workplan.md`

Create `docs/1.0/superseded/README.md`:

```markdown
# Superseded Implementation Plans

These plans were created but superseded by better architectural approaches:

- **sampler-backup/cli-config/** - Superseded by unified config system
- **sampler-export/cli-config/** - Superseded by unified config system

See `docs/1.0/unified-cli/` for the current implementation plan.
```

## Notes

- Config file uses JSON for easy manual editing
- Wizard accessible from any command (`audiotools`, `akai-backup`, `akai-export`)
- Backward compatibility maintained via existing bin entries
- Library exports enable programmatic use
- Future tools integrate seamlessly
- Single source of truth for all configuration
