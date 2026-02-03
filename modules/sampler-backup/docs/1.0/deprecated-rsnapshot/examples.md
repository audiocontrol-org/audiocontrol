## Examples

### Example 1: Basic Daily Backup

```bash
# One-time setup
akai-backup config --test

# Daily backup (run via cron, launchd, or manually)
akai-backup batch
```

### Example 2: Multiple Samplers with Custom Retention

```typescript
import {
  getDefaultRsnapshotConfig,
  writeRsnapshotConfig,
  runBackup
} from '@audiocontrol/sampler-backup';

// Custom configuration
const config = getDefaultRsnapshotConfig();

// Override defaults
config.snapshotRoot = '/Volumes/Backup/samplers';
config.retain.daily = 14;    // 2 weeks
config.retain.weekly = 8;    // 2 months
config.retain.monthly = 24;  // 2 years

// Multiple samplers
config.samplers = [
  {
    type: "s5k",
    host: "s5000.local",
    sourcePath: "/home/pi/scsi/",
    backupSubdir: "akai-s5000"
  },
  {
    type: "s3k",
    host: "s3000xl.local",
    sourcePath: "/home/pi/scsi/",
    backupSubdir: "akai-s3000xl"
  }
];

// Write configuration
const configPath = '/Users/me/.audiotools/custom-backup.conf';
writeRsnapshotConfig(config, configPath);

// Run backup
const result = await runBackup({
  interval: 'daily',
  configPath
});

if (result.success) {
  console.log(`Backup complete: ${result.snapshotPath}/daily.0`);
}
```

### Example 3: Programmatic Backup with Error Handling

```typescript
import { runBackup, getLatestSnapshotDir } from '@audiocontrol/sampler-backup';

async function backupWithNotification() {
  const result = await runBackup({
    interval: 'daily',
    configPath: '~/.audiotools/rsnapshot.conf'
  });

  if (result.success) {
    console.log('✓ Backup completed successfully');

    // Get latest snapshot path for further processing
    const latestSnapshot = getLatestSnapshotDir(
      result.snapshotPath!,
      'daily'
    );

    console.log(`Latest snapshot: ${latestSnapshot}`);

    // Could now extract disk images with @audiocontrol/sampler-export
    // extractDiskImages(latestSnapshot);
  } else {
    console.error('✗ Backup failed:');
    result.errors.forEach(err => console.error(`  - ${err}`));

    // Send notification, alert, etc.
    sendAlert('Backup failed', result.errors);
    process.exit(1);
  }
}

backupWithNotification();
```

### Example 4: Integration with sampler-export

Combined backup and extraction workflow:

```bash
#!/bin/bash
# backup-and-extract.sh

# 1. Backup samplers
echo "Starting backup..."
akai-backup batch

if [ $? -ne 0 ]; then
  echo "Backup failed!"
  exit 1
fi

# 2. Extract latest backup
echo "Extracting disk images..."
akai-extract batch --source ~/.audiotools/backup/daily.0

if [ $? -eq 0 ]; then
  echo "✓ Backup and extraction complete!"
else
  echo "✗ Extraction failed"
  exit 1
fi
```

### Example 5: Local Media Backup (SD Card, USB)

```typescript
import { getDefaultRsnapshotConfig, writeRsnapshotConfig } from '@audiocontrol/sampler-backup';

const config = getDefaultRsnapshotConfig();

// Add local SD card as backup source
config.samplers.push({
  type: "s5k",
  host: "localhost",  // Local, no SSH needed
  sourcePath: "/Volumes/AKAI-SD/",
  backupSubdir: "sd-card"
});

// Add USB drive
config.samplers.push({
  type: "s3k",
  host: "localhost",
  sourcePath: "/Volumes/USB-SCSI/",
  backupSubdir: "usb-drive"
});

writeRsnapshotConfig(config, '~/.audiotools/rsnapshot.conf');
```

