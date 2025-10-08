# CLI Config Command Implementation Workplan (sampler-export)

## Overview

Add an `akai-export config` command that provides an interactive wizard for managing extraction sources and conversion preferences, enabling "one-click" extraction workflows where users can run `akai-export extract` without any flags.

## Goals

1. **Zero-flag extractions**: `akai-export extract` runs all configured sources
2. **Interactive setup**: Guided wizard for adding/editing sources and preferences
3. **Persistent configuration**: JSON file at `~/.audiotools/export-config.json`
4. **Easy maintenance**: Add, edit, remove, enable/disable sources
5. **Conversion preferences**: Default output formats (SFZ, DecentSampler, both)
6. **Backward compatible**: Flags still work, config is optional

## User Experience

### Initial Setup

```bash
$ akai-export config

No configuration found. Let's set up your extraction sources!

? Add an extraction source? (Y/n) y

? Source type: (Use arrow keys)
❯ Backup directory (use existing backups)
  Single disk image
  Directory of disk images

? Source name: pi-scsi2-images
? Backup directory: ~/.audiotools/backup/pi-scsi2/images
? Output format: (Use arrow keys, Space to select, Enter when done)
  [X] SFZ
  [X] DecentSampler
  [ ] Raw extraction only

? Output directory: ~/.audiotools/sampler-export/extracted
? Enable this source? (Y/n) y

✓ Added source: pi-scsi2-images

? Add another source? (Y/n) y

? Source type: Single disk image
? Source name: s5k-gotek-disk
? Disk image path: ~/.audiotools/backup/s5k-studio/floppy/DSK0.img
? Output format: Both (SFZ + DecentSampler)
? Output directory: ~/.audiotools/sampler-export/extracted
? Enable this source? (Y/n) y

✓ Added source: s5k-gotek-disk

? Add another source? (Y/n) n

Configuration saved to ~/.audiotools/export-config.json

You can now run extractions without flags:
  $ akai-export extract        # Extract all enabled sources
  $ akai-export extract pi-scsi2-images   # Extract specific source
```

### Managing Existing Configuration

```bash
$ akai-export config

Current extraction sources:
  1. [✓] pi-scsi2-images (backup-dir: ~/.audiotools/backup/pi-scsi2/images)
     Format: SFZ + DecentSampler
  2. [✓] s5k-gotek-disk (disk-image: ~/.audiotools/backup/s5k-studio/floppy/DSK0.img)
     Format: SFZ + DecentSampler
  3. [✗] old-disk (disk-image: ~/old/HD0.hds) [DISABLED]
     Format: Raw only

? What would you like to do? (Use arrow keys)
❯ Add a new source
  Edit a source
  Remove a source
  Enable/disable a source
  Test a source (verify disk readable)
  View configuration
  Exit
```

### Running Extractions with Config

```bash
# Extract all enabled sources
$ akai-export extract
Extracting 2 sources...
✓ pi-scsi2-images: 15 disks, 243 programs converted (SFZ + DecentSampler)
✓ s5k-gotek-disk: 1 disk, 18 programs converted (SFZ + DecentSampler)

# Extract specific source by name
$ akai-export extract pi-scsi2-images
✓ pi-scsi2-images: 15 disks, 243 programs converted

# Override with flags (config ignored)
$ akai-export extract ~/custom.hds --output /tmp/test --format sfz
✓ Extracted from ~/custom.hds
```

## Architecture

### Configuration File Format

`~/.audiotools/export-config.json`:

```json
{
  "version": "1.0",
  "outputRoot": "~/.audiotools/sampler-export/extracted",
  "sources": [
    {
      "name": "pi-scsi2-images",
      "type": "backup-directory",
      "path": "~/.audiotools/backup/pi-scsi2/images",
      "formats": ["sfz", "decentsampler"],
      "outputDir": "~/.audiotools/sampler-export/extracted",
      "enabled": true
    },
    {
      "name": "s5k-gotek-disk",
      "type": "disk-image",
      "path": "~/.audiotools/backup/s5k-studio/floppy/DSK0.img",
      "formats": ["sfz", "decentsampler"],
      "outputDir": "~/.audiotools/sampler-export/extracted",
      "enabled": true
    },
    {
      "name": "batch-disks",
      "type": "directory",
      "path": "~/archives/disk-images",
      "formats": ["sfz"],
      "outputDir": "~/.audiotools/sampler-export/extracted",
      "enabled": false
    }
  ],
  "defaults": {
    "formats": ["sfz", "decentsampler"],
    "outputDir": "~/.audiotools/sampler-export/extracted",
    "skipUnchanged": true
  }
}
```

### File Structure

```
sampler-export/src/
├── config/
│   ├── export-config.ts       # Config loading/saving
│   ├── config-wizard.ts       # Interactive prompts
│   └── config-validator.ts    # Validation logic
├── cli/
│   ├── extract.ts             # Updated to support config
│   └── config.ts              # New config command
└── extractor/
    ├── disk-extractor.ts      # Existing
    ├── batch-extractor.ts     # Existing
    └── config-extractor.ts    # New: Extract from config sources
```

## Implementation Plan

### Phase 1: Configuration Core (2-3 hours)

**1.1 Create `src/config/export-config.ts`**

```typescript
export interface ExtractionSource {
  name: string;
  type: 'backup-directory' | 'disk-image' | 'directory';
  path: string;
  formats: ('sfz' | 'decentsampler' | 'raw')[];
  outputDir: string;
  enabled: boolean;
}

export interface ExportConfig {
  version: string;
  outputRoot: string;
  sources: ExtractionSource[];
  defaults?: {
    formats?: ('sfz' | 'decentsampler' | 'raw')[];
    outputDir?: string;
    skipUnchanged?: boolean;
  };
}

export const DEFAULT_CONFIG_PATH = join(homedir(), '.audiotools', 'export-config.json');

export async function loadConfig(path?: string): Promise<ExportConfig>
export async function saveConfig(config: ExportConfig, path?: string): Promise<void>
export function getDefaultConfig(): ExportConfig
export function addSource(config: ExportConfig, source: ExtractionSource): ExportConfig
export function updateSource(config: ExportConfig, name: string, updates: Partial<ExtractionSource>): ExportConfig
export function removeSource(config: ExportConfig, name: string): ExportConfig
export function getEnabledSources(config: ExportConfig): ExtractionSource[]
export function toggleSource(config: ExportConfig, name: string): ExportConfig
```

**1.2 Create `src/config/config-validator.ts`**

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSource(source: ExtractionSource): ValidationResult
export function validateConfig(config: ExportConfig): ValidationResult
export async function testSourceReadable(source: ExtractionSource): Promise<boolean>
export async function detectSourceType(path: string): Promise<'backup-directory' | 'disk-image' | 'directory'>
```

### Phase 2: Interactive Wizard (3-4 hours)

**2.1 Install `inquirer` dependency**

```bash
pnpm add inquirer @types/inquirer
```

**2.2 Create `src/config/config-wizard.ts`**

```typescript
import inquirer from 'inquirer';

export async function runConfigWizard(): Promise<void>
export async function addSourceWizard(config: ExportConfig): Promise<ExtractionSource>
export async function editSourceWizard(config: ExportConfig): Promise<void>
export async function removeSourceWizard(config: ExportConfig): Promise<void>
export async function toggleSourceWizard(config: ExportConfig): Promise<void>
export async function mainMenu(config: ExportConfig): Promise<void>
```

**Features:**
- Arrow key navigation
- Multi-select for output formats
- Path validation (file/directory exists)
- Auto-detection of source type
- Colored output (enabled/disabled indicators)
- Disk readability testing before saving

### Phase 3: CLI Integration (2-3 hours)

**3.1 Create `src/cli/config.ts`**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { runConfigWizard } from '@/config/config-wizard.js';
import { loadConfig, saveConfig } from '@/config/export-config.js';

const program = new Command();

program
  .name('akai-export config')
  .description('Manage extraction source configuration')
  .option('--list', 'List all configured sources')
  .option('--add', 'Add a new source')
  .option('--edit <name>', 'Edit a source')
  .option('--remove <name>', 'Remove a source')
  .option('--enable <name>', 'Enable a source')
  .option('--disable <name>', 'Disable a source')
  .option('--test <name>', 'Test source readability')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (options) => {
    // Handle options or run interactive wizard
  });

program.parse();
```

**3.2 Create `src/extractor/config-extractor.ts`**

New module to handle extraction from configured sources:

```typescript
export interface ConfigExtractionResult {
  sourceName: string;
  success: boolean;
  disksProcessed: number;
  programsConverted: number;
  errors: string[];
}

export async function extractFromConfig(
  config: ExportConfig,
  sourceNames?: string[]
): Promise<ConfigExtractionResult[]>

export async function extractSource(
  source: ExtractionSource
): Promise<ConfigExtractionResult>
```

**3.3 Update `src/cli/extract.ts`**

Add config support to extract command:

```typescript
// Load config if no input path provided
if (!options.input) {
  const config = await loadConfig();
  const sources = getEnabledSources(config);

  if (sources.length === 0) {
    console.log('No extraction sources configured.');
    console.log('Run: akai-export config');
    process.exit(1);
  }

  // Extract all enabled sources
  const results = await extractFromConfig(config);

  // Display summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n${successful} source(s) succeeded, ${failed} failed`);

} else {
  // Use command-line flags (existing behavior)
}
```

**3.4 Update `package.json` bin entries**

```json
{
  "bin": {
    "akai-export": "./dist/cli/extract.js",
    "akai-export-config": "./dist/cli/config.js"
  }
}
```

### Phase 4: Testing (2 hours)

**4.1 Unit Tests**

```typescript
// test/unit/config/export-config.test.ts
describe('ExportConfig', () => {
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
  it('should validate backup-directory source')
  it('should validate disk-image source')
  it('should validate directory source')
  it('should reject invalid sources')
  it('should detect source type from path')
})

// test/unit/extractor/config-extractor.test.ts
describe('ConfigExtractor', () => {
  it('should extract from backup-directory source')
  it('should extract from disk-image source')
  it('should extract from directory source')
  it('should skip disabled sources')
  it('should handle extraction errors gracefully')
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
  it('should extract using config')
})
```

### Phase 5: Documentation (1 hour)

**5.1 Update `sampler-export/README.md`**

Add section:

```markdown
## Configuration

### Interactive Setup

Run the configuration wizard to set up your extraction sources:

\`\`\`bash
akai-export config
\`\`\`

This creates `~/.audiotools/export-config.json` with your sources and preferences.

### One-Click Extractions

After configuration, run extractions without flags:

\`\`\`bash
# Extract all enabled sources
akai-export extract

# Extract specific source
akai-export extract pi-scsi2-images
\`\`\`

### Configuration File

The configuration is stored in `~/.audiotools/export-config.json`:

\`\`\`json
{
  "version": "1.0",
  "outputRoot": "~/.audiotools/sampler-export/extracted",
  "sources": [
    {
      "name": "pi-scsi2-images",
      "type": "backup-directory",
      "path": "~/.audiotools/backup/pi-scsi2/images",
      "formats": ["sfz", "decentsampler"],
      "enabled": true
    }
  ]
}
\`\`\`
```

**5.2 Create `docs/1.0/sampler-export/configuration.md`**

Detailed guide:
- Configuration file format
- Manual editing
- Source types and options
- Format selection
- Troubleshooting

## Command-Line Interface

### `akai-export config`

Interactive wizard (no flags):
```bash
$ akai-export config
```

### `akai-export config --list`

List all sources:
```bash
$ akai-export config --list

Extraction Sources:
  1. [✓] pi-scsi2-images (backup-directory)
     Path: ~/.audiotools/backup/pi-scsi2/images
     Formats: SFZ, DecentSampler
     Output: ~/.audiotools/sampler-export/extracted

  2. [✓] s5k-gotek-disk (disk-image)
     Path: ~/.audiotools/backup/s5k-studio/floppy/DSK0.img
     Formats: SFZ, DecentSampler
     Output: ~/.audiotools/sampler-export/extracted

  3. [✗] old-disk (disk-image) [DISABLED]
     Path: ~/old/HD0.hds
     Formats: Raw only
```

### `akai-export config --add`

Add source without wizard:
```bash
$ akai-export config --add

# Interactive prompts for source details
```

### `akai-export config --edit <name>`

Edit existing source:
```bash
$ akai-export config --edit pi-scsi2-images

Editing source: pi-scsi2-images
? Path: (~/.audiotools/backup/pi-scsi2/images)
? Formats: [X] SFZ [X] DecentSampler [ ] Raw only
? Enabled: (Y/n) y
```

### `akai-export config --remove <name>`

Remove source:
```bash
$ akai-export config --remove old-disk
? Are you sure you want to remove 'old-disk'? (y/N) y
✓ Source removed
```

### `akai-export config --test <name>`

Test source readability:
```bash
$ akai-export config --test pi-scsi2-images
Testing source: pi-scsi2-images
✓ Directory exists: ~/.audiotools/backup/pi-scsi2/images
✓ Found 15 disk images (.hds, .img)
✓ All disks readable
```

### `akai-export extract` (updated)

Run with config:
```bash
# Extract all enabled sources
$ akai-export extract

# Extract specific configured source
$ akai-export extract pi-scsi2-images

# Override config with flags
$ akai-export extract ~/custom.hds --format sfz --output /tmp
```

## Integration with Backup Config

### Unified Workflow

The backup and export configs can reference each other:

```bash
# 1. Configure backup
$ akai-backup config
# Add source: pi-scsi2

# 2. Configure export using backup directory
$ akai-export config
? Source type: Backup directory
? Backup directory: ~/.audiotools/backup/pi-scsi2/images  # From backup config
? Formats: SFZ + DecentSampler

# 3. One-click workflow
$ akai-backup backup      # Sync from hardware
$ akai-export extract     # Extract and convert
```

### Auto-Discovery

The export config wizard could auto-discover backup directories:

```bash
$ akai-export config --add

? Source type: Backup directory (use existing backups)

Found existing backups:
  1. pi-scsi2/images (15 disks)
  2. s5k-studio/floppy (8 disks)
  3. s3k-zulu/scsi0 (3 disks)

? Select backup to use: (Use arrow keys)
❯ pi-scsi2/images
  s5k-studio/floppy
  s3k-zulu/scsi0
  Enter path manually
```

## Migration Path

### For New Users

1. Install: `npm install -g @oletizi/sampler-export`
2. Configure: `akai-export config`
3. Extract: `akai-export extract`

### For Existing Users

Existing flag-based workflow continues to work:

```bash
# Still works (config not required)
$ akai-export extract ~/.audiotools/backup/pi-scsi2/images/HD0.hds --format sfz
```

Optionally migrate to config:

```bash
# Run config wizard
$ akai-export config

# Import existing extraction as a source
? Add an extraction source? (Y/n) y
? Source name: pi-scsi2-images
? Source type: Backup directory
? Path: ~/.audiotools/backup/pi-scsi2/images
✓ Source added
```

## Error Handling

### No Config File

```bash
$ akai-export extract

No extraction configuration found.

Run this to set up your sources:
  $ akai-export config

Or use flags directly:
  $ akai-export extract <disk-image> --format sfz
```

### All Sources Disabled

```bash
$ akai-export extract

All configured sources are disabled.

Enable sources:
  $ akai-export config
```

### Source Path Not Found

```bash
$ akai-export extract

✗ pi-scsi2-images: Path not found: ~/.audiotools/backup/pi-scsi2/images
✓ s5k-gotek-disk: 1 disk, 18 programs converted

1 source failed, 1 succeeded
```

### Disk Read Failed

```bash
$ akai-export extract pi-scsi2-images

Processing pi-scsi2-images...
✓ HD0.hds: 24 programs converted
✗ HD1.hds: Failed to read disk (corrupt boot sector)
✓ HD2.hds: 15 programs converted

Completed with 1 error
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
| 3 | CLI integration (commands, extract update, config-extractor) | 2-3 hours |
| 4 | Testing (unit + integration) | 2 hours |
| 5 | Documentation (README, guides) | 1 hour |
| **Total** | | **10-13 hours** |

## Success Criteria

- [ ] `akai-export config` runs interactive wizard
- [ ] Config file created at `~/.audiotools/export-config.json`
- [ ] Can add/edit/remove sources via wizard
- [ ] Can enable/disable sources
- [ ] Can configure output formats per source
- [ ] `akai-export extract` with no flags extracts all enabled sources
- [ ] `akai-export extract <name>` extracts specific source
- [ ] Flags still work (backward compatible)
- [ ] Source readability testing works
- [ ] Auto-discovery of backup directories works
- [ ] All tests pass
- [ ] Documentation complete

## Future Enhancements

### v1.1: Advanced Features

- **Scheduled extractions**: `akai-export config --schedule`
- **Extraction profiles**: Different configs for different workflows
- **Notification hooks**: Webhook/email on completion
- **Dry-run mode**: Preview what would be extracted
- **Incremental extraction**: Only extract changed/new programs
- **Format-specific options**: SFZ velocity curves, DecentSampler UI settings

### v1.2: Integration Features

- **Backup integration**: Automatically configure export sources from backup config
- **Watch mode**: Auto-extract when new backups appear
- **Conflict resolution**: Handle duplicate program names across disks
- **Metadata preservation**: Track original disk/partition for each program

### v1.3: Web UI

- Web-based configuration editor
- Real-time extraction monitoring
- Program browser and preview
- Batch conversion status visualization

## Notes

- Config file uses JSON for easy manual editing
- Wizard uses `inquirer` for professional CLI UX
- Backward compatible - flags still work
- Source names must be unique
- Disabled sources stay in config but are skipped
- Format selection supports multiple outputs per source
- Integration with backup config enables seamless workflow
- Auto-discovery makes setup easier for users with existing backups

## Relationship to Backup Config

The extraction config is designed to complement the backup config:

**Backup Config** (`~/.audiotools/backup-config.json`):
- Manages backup sources (remote/local)
- Handles syncing from hardware

**Export Config** (`~/.audiotools/export-config.json`):
- Manages extraction sources (backup-dir/disk/directory)
- Handles conversion to modern formats

**Unified Workflow**:
```bash
akai-backup backup && akai-export extract
```

This separates concerns while enabling a seamless end-to-end workflow.
