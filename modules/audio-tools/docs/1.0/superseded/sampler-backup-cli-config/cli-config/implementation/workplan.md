# CLI Config Command Implementation Workplan

## Overview

Add an `akai-backup config` command that provides an interactive wizard for managing backup sources, enabling "one-click" backup workflows where users can run `akai-backup backup` without any flags.

## Goals

1. **Zero-flag backups**: `akai-backup backup` runs all configured sources
2. **Interactive setup**: Guided wizard for adding/editing sources
3. **Persistent configuration**: JSON file at `~/.audiotools/backup-config.json`
4. **Easy maintenance**: Add, edit, remove, enable/disable sources
5. **Backward compatible**: Flags still work, config is optional

## User Experience

### Initial Setup (No Existing Backups)

```bash
$ akai-backup config

No configuration found. Let's set up your backup sources!

? Add a backup source? (Y/n) y

? Source type: (Use arrow keys)
❯ Remote (SSH/PiSCSI)
  Local (SD card, USB drive)

? Source name: pi-scsi2
? SSH path: pi-scsi2.local:~/images/
? Device identifier: images
? Enable this source? (Y/n) y

✓ Added source: pi-scsi2

? Add another source? (Y/n) y

? Source type: Local (SD card, USB drive)
? Source name: s5k-gotek
? Local mount path: /Volumes/GOTEK
? Sampler name: s5k-studio
? Device identifier: floppy
? Enable this source? (Y/n) y

✓ Added source: s5k-gotek

? Add another source? (Y/n) n

Configuration saved to ~/.audiotools/backup-config.json

You can now run backups without flags:
  $ akai-backup backup        # Backs up all enabled sources
  $ akai-backup backup pi-scsi2   # Backs up specific source
```

### Initial Setup (With Existing Backups)

**Auto-Discovery Feature**: When `~/.audiotools/backup/` contains existing backup directories, offer to create config from discovered structure.

```bash
$ akai-backup config

No configuration found, but I found existing backups!

Discovered backup structure:
  1. pi-scsi2/
     └── images/ (15 files, 3.2 GB, last modified: 2 hours ago)

  2. s5k-studio/
     └── floppy/ (8 files, 1.5 GB, last modified: 1 day ago)

  3. s3k-zulu/
     └── scsi0/ (3 files, 512 MB, last modified: 1 week ago)

? Import these as backup sources? (Y/n) y

For each discovered backup, I'll ask how to configure it...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Source: pi-scsi2/images

This appears to be a remote backup (directory name looks like hostname).

? Source type for pi-scsi2/images:
❯ Remote (SSH) - I'll prompt for SSH path
  Local (SD/USB) - I'll prompt for mount path
  Skip this source

? Source type: Remote (SSH)
? SSH source path: pi-scsi2.local:~/images/
? Enable this source? (Y/n) y

✓ Configured: pi-scsi2 → pi-scsi2.local:~/images/ (device: images)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Source: s5k-studio/floppy

This appears to be a local backup (sampler/device structure).

? Source type for s5k-studio/floppy:
❯ Local (SD/USB) - I'll prompt for mount path
  Remote (SSH) - I'll prompt for SSH path
  Skip this source

? Source type: Local (SD/USB)
? Local mount path: /Volumes/GOTEK
? Enable this source? (Y/n) y

✓ Configured: s5k-gotek → /Volumes/GOTEK (sampler: s5k-studio, device: floppy)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Source: s3k-zulu/scsi0

? Source type for s3k-zulu/scsi0:
  Local (SD/USB)
  Remote (SSH)
❯ Skip this source

✓ Skipped s3k-zulu/scsi0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configuration saved to ~/.audiotools/backup-config.json

Configured 2 sources (skipped 1):
  ✓ pi-scsi2 (remote: pi-scsi2.local:~/images/)
  ✓ s5k-gotek (local: /Volumes/GOTEK)

You can now run backups without flags:
  $ akai-backup backup        # Backs up all enabled sources
  $ akai-backup backup pi-scsi2   # Backs up specific source
```

### Managing Existing Configuration

```bash
$ akai-backup config

Current backup sources:
  1. [✓] pi-scsi2 (remote: pi-scsi2.local:~/images/)
  2. [✓] s5k-gotek (local: /Volumes/GOTEK)
  3. [✗] old-sampler (remote: old.local:~/data)

? What would you like to do? (Use arrow keys)
❯ Add a new source
  Edit a source
  Remove a source
  Enable/disable a source
  Test a source connection
  View configuration
  Exit
```

### Running Backups with Config

```bash
# Backup all enabled sources
$ akai-backup backup
Backing up 2 sources...
✓ pi-scsi2: 15 files synced (3.2 GB)
✓ s5k-gotek: 8 files synced (1.5 GB)

# Backup specific source by name
$ akai-backup backup pi-scsi2
✓ pi-scsi2: 15 files synced (3.2 GB)

# Override with flags (config ignored)
$ akai-backup backup --source /Volumes/USB --device usb
✓ Synced from /Volumes/USB
```

## Architecture

### Configuration File Format

`~/.audiotools/backup-config.json`:

```json
{
  "version": "1.0",
  "backupRoot": "~/.audiotools/backup",
  "sources": [
    {
      "name": "pi-scsi2",
      "type": "remote",
      "source": "pi-scsi2.local:~/images/",
      "device": "images",
      "enabled": true
    },
    {
      "name": "s5k-gotek",
      "type": "local",
      "source": "/Volumes/GOTEK",
      "device": "floppy",
      "sampler": "s5k-studio",
      "enabled": true
    },
    {
      "name": "old-sampler",
      "type": "remote",
      "source": "old.local:~/data",
      "device": "scsi0",
      "enabled": false
    }
  ],
  "defaults": {
    "defaultSampler": "my-sampler"
  }
}
```

### File Structure

```
sampler-backup/src/
├── config/
│   ├── backup-config.ts       # Config loading/saving
│   ├── config-wizard.ts       # Interactive prompts
│   └── config-validator.ts    # Validation logic
├── cli/
│   ├── backup.ts              # Updated to support config
│   └── config.ts              # New config command
└── sources/
    ├── backup-source.ts       # Existing
    ├── remote-source.ts       # Existing
    └── local-source.ts        # Existing
```

## Implementation Plan

### Phase 1: Configuration Core (2-3 hours)

**1.1 Create `src/config/backup-config.ts`**

```typescript
export interface BackupSource {
  name: string;
  type: 'remote' | 'local';
  source: string;
  device: string;
  sampler?: string;
  enabled: boolean;
}

export interface BackupConfig {
  version: string;
  backupRoot: string;
  sources: BackupSource[];
  defaults?: {
    defaultSampler?: string;
  };
}

export const DEFAULT_CONFIG_PATH = join(homedir(), '.audiotools', 'backup-config.json');

export async function loadConfig(path?: string): Promise<BackupConfig>
export async function saveConfig(config: BackupConfig, path?: string): Promise<void>
export function getDefaultConfig(): BackupConfig
export function addSource(config: BackupConfig, source: BackupSource): BackupConfig
export function updateSource(config: BackupConfig, name: string, updates: Partial<BackupSource>): BackupConfig
export function removeSource(config: BackupConfig, name: string): BackupConfig
export function getEnabledSources(config: BackupConfig): BackupSource[]
export function toggleSource(config: BackupConfig, name: string): BackupConfig
```

**1.2 Create `src/config/config-validator.ts`**

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSource(source: BackupSource): ValidationResult
export function validateConfig(config: BackupConfig): ValidationResult
export async function testSourceConnection(source: BackupSource): Promise<boolean>
```

### Phase 2: Interactive Wizard (3-4 hours)

**2.1 Install `inquirer` dependency**

```bash
pnpm add inquirer @types/inquirer
```

**2.2 Create `src/config/backup-discovery.ts`**

Auto-discovery of existing backup structure:

```typescript
export interface DiscoveredBackup {
  sampler: string;           // Top-level directory name (e.g., "pi-scsi2")
  device: string;            // Sub-directory name (e.g., "images")
  path: string;              // Full path to device directory
  fileCount: number;         // Number of files in device directory
  totalSize: number;         // Total size in bytes
  lastModified: Date;        // Most recent file modification time
  inferredType: 'remote' | 'local';  // Inferred from directory naming
}

export async function discoverExistingBackups(
  backupRoot: string = DEFAULT_BACKUP_ROOT
): Promise<DiscoveredBackup[]>

export function inferBackupType(samplerName: string): 'remote' | 'local'

export async function importDiscoveredBackup(
  discovered: DiscoveredBackup
): Promise<BackupSource | null>
```

**Discovery Logic:**
- Scan `~/.audiotools/backup/` for `sampler/device/` structure
- Collect metadata (file count, size, modification time)
- Infer type from naming patterns:
  - Contains `.local`, `.lan`, or `@` → remote
  - Matches common sampler names (s5k, s3k, etc.) → local
  - Default → prompt user

**2.3 Create `src/config/config-wizard.ts`**

```typescript
import inquirer from 'inquirer';

export async function runConfigWizard(): Promise<void>
export async function addSourceWizard(config: BackupConfig): Promise<BackupSource>
export async function editSourceWizard(config: BackupConfig): Promise<void>
export async function removeSourceWizard(config: BackupConfig): Promise<void>
export async function toggleSourceWizard(config: BackupConfig): Promise<void>
export async function mainMenu(config: BackupConfig): Promise<void>
export async function importBackupsWizard(
  discovered: DiscoveredBackup[]
): Promise<BackupSource[]>
```

**Features:**
- Arrow key navigation
- Input validation
- Default value suggestions
- Colored output (enabled/disabled indicators)
- Connection testing before saving
- **Auto-discovery flow** on initial setup

### Phase 3: CLI Integration (2-3 hours)

**3.1 Create `src/cli/config.ts`**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { runConfigWizard } from '@/config/config-wizard.js';
import { loadConfig, saveConfig } from '@/config/backup-config.js';

const program = new Command();

program
  .name('akai-backup config')
  .description('Manage backup source configuration')
  .option('--list', 'List all configured sources')
  .option('--add', 'Add a new source')
  .option('--edit <name>', 'Edit a source')
  .option('--remove <name>', 'Remove a source')
  .option('--enable <name>', 'Enable a source')
  .option('--disable <name>', 'Disable a source')
  .option('--test <name>', 'Test source connection')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (options) => {
    // Handle options or run interactive wizard
  });

program.parse();
```

**3.2 Update `src/cli/backup.ts`**

Add config support to backup command:

```typescript
// Load config if no --source flag provided
if (!options.source) {
  const config = await loadConfig();
  const sources = getEnabledSources(config);

  if (sources.length === 0) {
    console.log('No backup sources configured.');
    console.log('Run: akai-backup config');
    process.exit(1);
  }

  // Backup all enabled sources
  for (const source of sources) {
    await backupSource(source);
  }
} else {
  // Use command-line flags (existing behavior)
}
```

**3.3 Update `package.json` bin entries**

```json
{
  "bin": {
    "akai-backup": "./dist/cli/backup.js",
    "akai-backup-config": "./dist/cli/config.js"
  }
}
```

### Phase 4: Testing (2 hours)

**4.1 Unit Tests**

```typescript
// test/unit/config/backup-config.test.ts
describe('BackupConfig', () => {
  it('should load default config if file does not exist')
  it('should save and load config')
  it('should add source to config')
  it('should update existing source')
  it('should remove source')
  it('should get enabled sources only')
  it('should toggle source enabled state')
})

// test/unit/config/config-validator.test.ts
describe('ConfigValidator', () => {
  it('should validate remote source')
  it('should validate local source')
  it('should reject invalid sources')
  it('should test SSH connection')
})
```

**4.2 Integration Tests**

```typescript
// test/integration/cli-config.test.ts
describe('CLI Config', () => {
  it('should create config file')
  it('should add source via CLI')
  it('should edit source via CLI')
  it('should remove source via CLI')
  it('should list sources')
})
```

### Phase 5: Documentation (1 hour)

**5.1 Update `sampler-backup/README.md`**

Add section:

```markdown
## Configuration

### Interactive Setup

Run the configuration wizard to set up your backup sources:

\`\`\`bash
akai-backup config
\`\`\`

This creates `~/.audiotools/backup-config.json` with your sources.

### One-Click Backups

After configuration, run backups without flags:

\`\`\`bash
# Backup all enabled sources
akai-backup backup

# Backup specific source
akai-backup backup pi-scsi2
\`\`\`

### Configuration File

The configuration is stored in `~/.audiotools/backup-config.json`:

\`\`\`json
{
  "version": "1.0",
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
}
\`\`\`
```

**5.2 Create `docs/1.0/sampler-backup/configuration.md`**

Detailed guide:
- Configuration file format
- Manual editing
- Source types and options
- Troubleshooting

## Command-Line Interface

### `akai-backup config`

Interactive wizard (no flags):
```bash
$ akai-backup config
```

### `akai-backup config --list`

List all sources:
```bash
$ akai-backup config --list

Backup Sources:
  1. [✓] pi-scsi2 (remote)
     Source: pi-scsi2.local:~/images/
     Device: images

  2. [✓] s5k-gotek (local)
     Source: /Volumes/GOTEK
     Device: floppy
     Sampler: s5k-studio

  3. [✗] old-sampler (remote) [DISABLED]
     Source: old.local:~/data
     Device: scsi0
```

### `akai-backup config --add`

Add source without wizard:
```bash
$ akai-backup config --add

# Interactive prompts for source details
```

### `akai-backup config --edit <name>`

Edit existing source:
```bash
$ akai-backup config --edit pi-scsi2

Editing source: pi-scsi2
? Source: (pi-scsi2.local:~/images/)
? Device: (images)
? Enabled: (Y/n) y
```

### `akai-backup config --remove <name>`

Remove source:
```bash
$ akai-backup config --remove old-sampler
? Are you sure you want to remove 'old-sampler'? (y/N) y
✓ Source removed
```

### `akai-backup config --test <name>`

Test connection:
```bash
$ akai-backup config --test pi-scsi2
Testing connection to pi-scsi2.local...
✓ Connection successful
✓ Source directory exists: ~/images/
✓ Found 15 disk images
```

### `akai-backup backup` (updated)

Run with config:
```bash
# Backup all enabled sources
$ akai-backup backup

# Backup specific configured source
$ akai-backup backup pi-scsi2

# Override config with flags
$ akai-backup backup --source /Volumes/USB --device usb
```

## Migration Path

### For New Users

1. Install: `npm install -g @oletizi/sampler-backup`
2. Configure: `akai-backup config`
3. Backup: `akai-backup backup`

### For Existing Users

Existing flag-based workflow continues to work:

```bash
# Still works (config not required)
$ akai-backup sync --source pi-scsi2.local:~/images/ --device images
```

Optionally migrate to config:

```bash
# Run config wizard
$ akai-backup config

# Convert existing commands to config sources
? Import existing backup as a source? (Y/n) y
? Source name: pi-scsi2
? Keep existing backups at ~/.audiotools/backup/pi-scsi2? (Y/n) y
✓ Source added
```

## Error Handling

### No Config File

```bash
$ akai-backup backup

No backup configuration found.

Run this to set up your sources:
  $ akai-backup config

Or use flags directly:
  $ akai-backup sync --source <path> --device <name>
```

### All Sources Disabled

```bash
$ akai-backup backup

All configured sources are disabled.

Enable sources:
  $ akai-backup config
```

### Source Connection Failed

```bash
$ akai-backup backup

✗ pi-scsi2: Connection failed (ssh: connect to host pi-scsi2.local port 22: Connection refused)
✓ s5k-gotek: 8 files synced

1 source failed, 1 succeeded
```

## Dependencies

New dependencies required:

```json
{
  "dependencies": {
    "inquirer": "^9.2.0"
  },
  "devDependencies": {
    "@types/inquirer": "^9.0.0"
  }
}
```

## Timeline

| Phase | Tasks | Time Estimate |
|-------|-------|---------------|
| 1 | Configuration core (loading, saving, CRUD) | 2-3 hours |
| 2 | Interactive wizard (inquirer integration) | 3-4 hours |
| 3 | CLI integration (commands, backup update) | 2-3 hours |
| 4 | Testing (unit + integration) | 2 hours |
| 5 | Documentation (README, guides) | 1 hour |
| **Total** | | **10-13 hours** |

## Success Criteria

- [ ] `akai-backup config` runs interactive wizard
- [ ] Config file created at `~/.audiotools/backup-config.json`
- [ ] **Auto-discovery**: Detects existing backups in `~/.audiotools/backup/`
- [ ] **Auto-import**: Offers to create config from discovered backups
- [ ] **Type inference**: Suggests remote vs. local based on directory names
- [ ] Can add/edit/remove sources via wizard
- [ ] Can enable/disable sources
- [ ] `akai-backup backup` with no flags backs up all enabled sources
- [ ] `akai-backup backup <name>` backs up specific source
- [ ] Flags still work (backward compatible)
- [ ] Connection testing works for SSH sources
- [ ] All tests pass
- [ ] Documentation complete

## Future Enhancements

### v1.1: Advanced Features

- **Scheduled backups**: `akai-backup config --schedule`
- **Backup profiles**: Different configs for different workflows
- **Notification hooks**: Webhook/email on completion
- **Dry-run mode**: Preview what would be backed up
- **Backup verification**: Hash checking after sync

### v1.2: Web UI

- Web-based configuration editor
- Real-time backup monitoring
- Backup history visualization

## Notes

- Config file uses JSON for easy manual editing
- Wizard uses `inquirer` for professional CLI UX
- Backward compatible - flags still work
- Source names must be unique
- Disabled sources stay in config but are skipped
- Connection testing is optional but recommended
