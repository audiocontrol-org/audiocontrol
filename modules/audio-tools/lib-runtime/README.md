# @oletizi/lib-runtime

A lightweight TypeScript utility library for executing external processes with comprehensive callback support and error handling. Designed for audio-tools packages to run external binaries (mtools, akaitools, rsnapshot, etc.) with real-time output capture and robust error management.

## Installation

```bash
npm install @oletizi/lib-runtime
```

Or if using pnpm in a workspace:

```bash
pnpm add @oletizi/lib-runtime
```

## Quick Start

```typescript
import { execute } from '@oletizi/lib-runtime';

// Simple command execution
const result = await execute('echo', ['Hello, World!']);
console.log(`Exit code: ${result.code}`);
console.log(`Errors: ${result.errors.length}`);

// With real-time output capture
await execute('npm', ['install'], {
  onData: (buffer) => {
    process.stdout.write(buffer);
  }
});

// With process lifecycle hooks
await execute('long-running-process', ['--arg'], {
  onStart: (childProcess) => {
    console.log(`Started process with PID: ${childProcess.pid}`);
  },
  onData: (buffer, childProcess) => {
    console.log(`Output: ${buffer.toString()}`);
  }
});
```

## API Reference

### `execute(bin, args, opts?)`

Executes an external command with optional callbacks for process lifecycle events.

**Parameters:**

- **`bin`** (`string`) - The binary/command to execute (e.g., `'mcopy'`, `'rsnapshot'`, `'node'`)
- **`args`** (`readonly string[]`) - Array of command-line arguments
- **`opts`** (`object`, optional) - Execution options:
  - **`onStart?`** (`(child: ChildProcess) => void`) - Called when the process starts
  - **`onData?`** (`(buffer: Buffer, child: ChildProcess) => void`) - Called for each chunk of stdout data

**Returns:** `Promise<ExecutionResult>`

**Throws:** `Error` if the process terminates without an exit code or times out after 30 seconds

### `ExecutionResult`

The result object returned by `execute()`.

```typescript
interface ExecutionResult {
  code: number;      // Exit code from the process
  errors: Error[];   // Array of errors (from stderr or process errors)
}
```

**Fields:**

- **`code`** (`number`) - The exit code from the process
  - `0` typically indicates success
  - Non-zero values indicate errors (meaning varies by command)
  - `-1` if the process encountered an error before exiting

- **`errors`** (`Error[]`) - Array of errors collected during execution
  - Process spawn errors (e.g., command not found)
  - stderr output converted to Error objects
  - Empty array if no errors occurred

### ChildProcess

The `ChildProcess` object passed to callbacks is from Node.js `child_process` module. Useful properties:

- **`pid`** - Process ID
- **`kill(signal?)`** - Terminate the process
- **`stdin`** - Write to process input (if needed)

## Configuration

### Timeout

The default timeout is **30 seconds**. If a command runs longer than this, the promise will be rejected with a timeout error.

To modify the timeout, you'll need to fork the package and adjust this line in `src/index.ts`:

```typescript
setTimeout(() => reject(new Error(`Timout executing ${bin}.`)), 30 * 1000)
```

### Console Logging

The `execute()` function logs each command execution to console:

```
execute: echo Hello World
```

This is useful for debugging but may be verbose in production. Consider wrapping the function if you need to control logging.

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

## Use Cases

### Audio-Tools Ecosystem

This package is used throughout the audio-tools monorepo:

1. **sampler-export**: Running `mcopy` (mtools) to extract files from disk images
2. **sampler-backup**: Running `rsnapshot` for incremental sampler backups
3. **sampler-devices**: Running `akaitools` for Akai-specific disk operations
4. **Build scripts**: Running external tools during compilation/deployment

### Platform-Specific Binaries

Ideal for packages that bundle platform-specific binaries and need to execute them:

```typescript
import { execute } from '@oletizi/lib-runtime';
import { getPlatformBinary } from './platform-detection';

async function runBundledBinary(args: string[]): Promise<void> {
  const binaryPath = getPlatformBinary('darwin-arm64'); // or 'linux-x64', etc.
  const result = await execute(binaryPath, args);

  if (result.code !== 0) {
    throw new Error(`Binary execution failed with code ${result.code}`);
  }
}
```

### SSH Remote Commands

Execute commands on remote systems via SSH:

```typescript
import { execute } from '@oletizi/lib-runtime';

async function runRemoteCommand(
  host: string,
  command: string
): Promise<string> {
  let output = '';

  const result = await execute('ssh', [host, command], {
    onData: (buffer) => {
      output += buffer.toString();
    }
  });

  if (result.code !== 0) {
    throw new Error(`SSH command failed on ${host}`);
  }

  return output;
}

// Usage
const diskUsage = await runRemoteCommand(
  'sampler@raspberrypi.local',
  'df -h /scsi/akai'
);
```

## Troubleshooting

### Command Not Found

**Problem:** `execute()` returns an error: "spawn ENOENT" or similar.

**Solution:** Verify the binary exists and is in the system PATH, or provide an absolute path:

```typescript
// ❌ May fail if not in PATH
await execute('mcopy', ['-V']);

// ✅ Use absolute path
await execute('/usr/local/bin/mcopy', ['-V']);

// ✅ Or check PATH first
import { execSync } from 'child_process';
const mcopyPath = execSync('which mcopy').toString().trim();
await execute(mcopyPath, ['-V']);
```

### Timeout Errors

**Problem:** Process times out after 30 seconds.

**Solution:**
1. Verify the command isn't hanging (waiting for input)
2. For long-running commands, consider forking this package and increasing the timeout
3. Use the `onData` callback to verify the process is actually running

```typescript
await execute('long-command', ['--args'], {
  onData: (buffer) => {
    console.log('Still running:', buffer.toString());
  }
});
```

### Missing Exit Code

**Problem:** Error "Process terminated without an exit code"

**Solution:** This happens when the process is killed or crashes. Check:
1. Does the command exist?
2. Are the arguments correct?
3. Is there a permission issue?

```typescript
// Add better error handling
try {
  await execute('my-command', ['arg']);
} catch (error) {
  console.error('Execution failed:', error.message);
  // Check if command exists, permissions, etc.
}
```

### stderr Output Confusion

**Problem:** Command succeeds (`code === 0`) but `errors` array is not empty.

**Explanation:** The `errors` array contains **all stderr output**, even from successful commands. Many programs write informational messages to stderr.

**Solution:** Check the exit code, not just the errors array:

```typescript
const result = await execute('npm', ['install']);

if (result.code !== 0) {
  // This is a real failure
  console.error('npm install failed:', result.errors);
} else {
  // Success! Ignore stderr warnings
  console.log('npm install succeeded');
}
```

### Handling Binary Data

**Problem:** Need to process binary output, not text.

**Solution:** The `onData` callback receives a `Buffer`, which you can process directly:

```typescript
const binaryChunks: Buffer[] = [];

await execute('binary-tool', ['--output-binary'], {
  onData: (buffer) => {
    binaryChunks.push(buffer);
  }
});

const fullBinaryOutput = Buffer.concat(binaryChunks);
// Process binary data...
```

## Error Handling

### Error Types

The `errors` array can contain:

1. **Spawn errors**: Command not found, permission denied
2. **stderr output**: Warnings or error messages from the command
3. **Process errors**: Unexpected termination, signals

### Best Practices

```typescript
import { execute, ExecutionResult } from '@oletizi/lib-runtime';

async function robustExecute(bin: string, args: string[]): Promise<void> {
  let result: ExecutionResult;

  try {
    result = await execute(bin, args);
  } catch (error) {
    // Timeout or process termination without exit code
    throw new Error(`Failed to execute ${bin}: ${error.message}`);
  }

  // Check exit code
  if (result.code !== 0) {
    const errorDetails = result.errors.length > 0
      ? result.errors.map(e => e.message).join('\n')
      : 'No error details available';

    throw new Error(
      `${bin} failed with exit code ${result.code}\n${errorDetails}`
    );
  }

  // Check for warnings (stderr output even on success)
  if (result.errors.length > 0) {
    console.warn(`${bin} warnings:`, result.errors.map(e => e.message));
  }
}
```

## Contributing

This package is part of the [audio-tools](https://github.com/oletizi/audio-tools) monorepo.

### Development Setup

```bash
# Clone the monorepo
git clone https://github.com/oletizi/audio-tools.git
cd audio-tools/lib-runtime

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# Build
pnpm build
```

### Testing

The package uses [Vitest](https://vitest.dev/) for testing with comprehensive test coverage (95%+).

Run the test suite:

```bash
pnpm test
```

View coverage report:

```bash
pnpm test:coverage
open coverage/index.html
```

### Code Quality

- **TypeScript strict mode** enabled
- **100% type safety** (no `any` types)
- **Dependency injection** pattern for testability
- **Comprehensive error handling**

### Pull Requests

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass (`pnpm test`)
5. Update this README if adding features
6. Submit a pull request

## License

Apache-2.0

## Author

Orion Letizi

## Related Packages

- **[@oletizi/sampler-export](../sampler-export)** - Disk image extraction using lib-runtime
- **[@oletizi/sampler-backup](../sampler-backup)** - rsnapshot wrapper using lib-runtime
- **[@oletizi/sampler-devices](../sampler-devices)** - Device utilities using lib-runtime

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for version history and migration guides.

---

**Note:** This is a utility package designed for the audio-tools ecosystem. While it can be used independently for executing external processes, it's optimized for running audio-related command-line tools (mtools, akaitools, rsnapshot, etc.).
