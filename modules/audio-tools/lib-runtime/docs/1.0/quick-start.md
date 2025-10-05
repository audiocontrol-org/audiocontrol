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

