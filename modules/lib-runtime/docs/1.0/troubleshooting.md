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

