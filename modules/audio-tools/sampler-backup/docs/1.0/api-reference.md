## API Reference

### Types

#### `SamplerType`

```typescript
type SamplerType = "s5k" | "s3k";
```

Supported sampler types:
- `"s5k"`: Akai S5000/S6000 series
- `"s3k"`: Akai S3000/S3000XL series

#### `RsnapshotInterval`

```typescript
type RsnapshotInterval = "daily" | "weekly" | "monthly";
```

Backup intervals for rotation.

#### `SamplerConfig`

```typescript
interface SamplerConfig {
  /** Sampler type identifier */
  type: SamplerType;

  /** Remote host (e.g., "pi-scsi2.local") or "localhost" for local media */
  host: string;

  /** Remote source path to backup (e.g., "/home/pi/images/") */
  sourcePath: string;

  /** Local backup subdirectory name (e.g., "pi-scsi2") */
  backupSubdir: string;
}
```

#### `RsnapshotConfig`

```typescript
interface RsnapshotConfig {
  /** Root directory for snapshots */
  snapshotRoot: string;

  /** Retention policy: interval => count */
  retain: Record<RsnapshotInterval, number>;

  /** Samplers to backup */
  samplers: SamplerConfig[];

  /** Additional rsnapshot options */
  options?: {
    rsyncShortArgs?: string;
    rsyncLongArgs?: string;
    sshArgs?: string;
    verbose?: number;
  };
}
```

#### `BackupOptions`

```typescript
interface BackupOptions {
  /** Rsnapshot interval to run (default: "daily") */
  interval?: RsnapshotInterval;

  /** Config file path (default: ~/.audiotools/rsnapshot.conf) */
  configPath?: string;

  /** Generate config only, don't run backup */
  configOnly?: boolean;

  /** Test mode (rsnapshot configtest) */
  test?: boolean;
}
```

#### `BackupResult`

```typescript
interface BackupResult {
  /** Whether backup succeeded */
  success: boolean;

  /** Interval that was run */
  interval: RsnapshotInterval;

  /** Configuration file path used */
  configPath: string;

  /** Snapshot root path (if successful) */
  snapshotPath?: string;

  /** Error messages (if failed) */
  errors: string[];
}
```

### Functions

#### `getDefaultRsnapshotConfig()`

Get default rsnapshot configuration.

```typescript
function getDefaultRsnapshotConfig(): RsnapshotConfig;
```

**Returns:** Default configuration with 2 samplers (pi-scsi2, s3k)

**Example:**
```typescript
const config = getDefaultRsnapshotConfig();
console.log(config.snapshotRoot); // ~/.audiotools/backup
console.log(config.retain.daily); // 7
```

#### `generateRsnapshotConfig(config)`

Generate rsnapshot.conf file content from configuration object.

```typescript
function generateRsnapshotConfig(config: RsnapshotConfig): string;
```

**Parameters:**
- `config` - Configuration object

**Returns:** rsnapshot.conf file content as string

**Example:**
```typescript
const config = getDefaultRsnapshotConfig();
const content = generateRsnapshotConfig(config);
console.log(content); // Prints rsnapshot.conf content
```

#### `writeRsnapshotConfig(config, configPath)`

Write rsnapshot configuration to file.

```typescript
function writeRsnapshotConfig(config: RsnapshotConfig, configPath: string): void;
```

**Parameters:**
- `config` - Configuration object
- `configPath` - Destination file path

**Throws:** Error if write fails

**Example:**
```typescript
const config = getDefaultRsnapshotConfig();
writeRsnapshotConfig(config, '~/.audiotools/rsnapshot.conf');
```

#### `getDefaultConfigPath()`

Get default configuration file path.

```typescript
function getDefaultConfigPath(): string;
```

**Returns:** `~/.audiotools/rsnapshot.conf`

#### `testRsnapshotConfig(configPath)`

Test rsnapshot configuration validity.

```typescript
async function testRsnapshotConfig(
  configPath: string
): Promise<{ valid: boolean; error?: string }>;
```

**Parameters:**
- `configPath` - Configuration file to test

**Returns:** Promise with validation result

**Example:**
```typescript
const result = await testRsnapshotConfig('~/.audiotools/rsnapshot.conf');
if (result.valid) {
  console.log('✓ Configuration is valid');
} else {
  console.error(`✗ Invalid: ${result.error}`);
}
```

#### `runBackup(options)`

Run rsnapshot backup with smart rotation logic.

```typescript
async function runBackup(options?: BackupOptions): Promise<BackupResult>;
```

**Parameters:**
- `options` - Backup options (optional)

**Returns:** Promise with backup result

**Example:**
```typescript
const result = await runBackup({
  interval: 'daily',
  configPath: '~/.audiotools/rsnapshot.conf'
});

if (result.success) {
  console.log('Backup complete');
} else {
  console.error('Errors:', result.errors);
}
```

#### `getLatestSnapshotDir(snapshotRoot, interval)`

Get the latest snapshot directory for given interval.

```typescript
function getLatestSnapshotDir(
  snapshotRoot: string,
  interval?: RsnapshotInterval
): string;
```

**Parameters:**
- `snapshotRoot` - Snapshot root directory
- `interval` - Backup interval (default: "daily")

**Returns:** Path to latest snapshot (e.g., `~/.audiotools/backup/daily.0`)

**Example:**
```typescript
const latest = getLatestSnapshotDir('~/.audiotools/backup', 'daily');
console.log(latest); // ~/.audiotools/backup/daily.0
```

