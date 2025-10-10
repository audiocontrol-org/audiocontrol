# lib-runtime v1.0 Documentation

## Overview

Version 1.0 provides process execution utilities with comprehensive callback support, error handling, and real-time output capture.

## Key Capabilities

- **Process Execution**: Execute external binaries with full control over stdin/stdout/stderr
- **Real-time Callbacks**: Capture output as it streams with `onData`, `onStdout`, `onStderr`
- **Error Handling**: Structured error capture with exit codes and signal handling
- **Promise-based API**: Async/await support for clean control flow
- **TypeScript Safety**: Full type definitions with strict mode compliance

## Documentation

1. **[Installation](./installation.md)** - Package installation
2. **[Quick Start](./quick-start.md)** - First execution in 2 minutes
3. **[API Reference](./api-reference.md)** - Complete API documentation
4. **[Configuration](./configuration.md)** - ExecuteOptions reference
5. **[Examples](./examples.md)** - Common patterns and use cases
6. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

## Common Use Cases

- **Binary Execution**: Run mtools, akaitools, rsnapshot, ffmpeg
- **Output Capture**: Log real-time output from long-running processes
- **Error Recovery**: Detect and handle process failures gracefully
- **Progress Monitoring**: Stream output to track operation progress
- **Testing**: Mock process execution with controllable results

## Getting Started

```bash
npm install @oletizi/lib-runtime
```

See [Quick Start](./quick-start.md) for your first process execution.

## Contributing

See main [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

Apache-2.0
