## Examples

### Example 1: Running mtools mcopy

```typescript
import { execute } from '@oletizi/lib-runtime';

async function copyFileFromDiskImage(
  diskImage: string,
  sourcePath: string,
  destPath: string
): Promise<void> {
  const result = await execute('mcopy', [
    '-i', diskImage,
    sourcePath,
    destPath
  ]);

  if (result.code !== 0) {
    throw new Error(`mcopy failed with exit code ${result.code}`);
  }
}

// Usage
await copyFileFromDiskImage(
  '/path/to/disk.img',
  '::PROGRAMS/MYPROGRAM.AKP',
  './output/MYPROGRAM.AKP'
);
```

### Example 2: Capturing Output in Real-Time

```typescript
import { execute } from '@oletizi/lib-runtime';

async function runWithProgress(command: string, args: string[]): Promise<string> {
  let output = '';

  const result = await execute(command, args, {
    onStart: (child) => {
      console.log(`Started ${command} (PID: ${child.pid})`);
    },
    onData: (buffer) => {
      const text = buffer.toString();
      output += text;
      process.stdout.write(text); // Show real-time output
    }
  });

  if (result.code !== 0) {
    throw new Error(`Command failed: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return output;
}

// Usage
const output = await runWithProgress('npm', ['test']);
console.log('Test output:', output);
```

### Example 3: Running rsnapshot Backup

```typescript
import { execute } from '@oletizi/lib-runtime';

async function runBackup(configPath: string, interval: string): Promise<void> {
  console.log(`Starting rsnapshot ${interval} backup...`);

  const result = await execute('rsnapshot', ['-c', configPath, interval], {
    onData: (buffer) => {
      // Log backup progress
      console.log(buffer.toString().trim());
    }
  });

  if (result.code !== 0) {
    const errorMessages = result.errors.map(e => e.message).join('\n');
    throw new Error(`Backup failed:\n${errorMessages}`);
  }

  console.log('Backup completed successfully');
}

// Usage
await runBackup('/etc/rsnapshot.conf', 'hourly');
```

### Example 4: Handling Command Failures

```typescript
import { execute } from '@oletizi/lib-runtime';

async function safeExecute(
  bin: string,
  args: string[]
): Promise<{ success: boolean; output: string; errors: string[] }> {
  let output = '';

  const result = await execute(bin, args, {
    onData: (buffer) => {
      output += buffer.toString();
    }
  });

  return {
    success: result.code === 0,
    output: output.trim(),
    errors: result.errors.map(e => e.message)
  };
}

// Usage
const { success, output, errors } = await safeExecute('git', ['status']);

if (success) {
  console.log('Git status:', output);
} else {
  console.error('Git command failed:', errors);
}
```

### Example 5: Parallel Command Execution

```typescript
import { execute } from '@oletizi/lib-runtime';

async function processMultipleDiskImages(diskImages: string[]): Promise<void> {
  const promises = diskImages.map(async (diskImage, index) => {
    console.log(`Processing disk ${index + 1}/${diskImages.length}...`);

    const result = await execute('akaitools', ['list', diskImage], {
      onData: (buffer) => {
        console.log(`[Disk ${index + 1}] ${buffer.toString().trim()}`);
      }
    });

    if (result.code !== 0) {
      throw new Error(`Failed to process ${diskImage}`);
    }
  });

  await Promise.all(promises);
  console.log('All disk images processed');
}

// Usage
await processMultipleDiskImages([
  '/disks/disk1.img',
  '/disks/disk2.img',
  '/disks/disk3.img'
]);
```

