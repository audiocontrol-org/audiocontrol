# @oletizi/lib-runtime

**Lightweight TypeScript utilities for executing external processes with comprehensive callback support and error handling.**

## Purpose

The `lib-runtime` package provides utilities for executing external binaries from Node.js applications with real-time output capture, structured error handling, and clean async/await APIs.

Audio-tools packages depend on external binaries (mtools, akaitools, rsnapshot, ffmpeg) for critical operations. Rather than each package reimplementing process execution with proper error handling, output capture, and callback management, they share this library for consistent, tested behavior.

## Philosophy

**Callbacks over polling.** Node's child_process provides low-level primitives (spawn, exec), but production applications need:

- **Real-time output capture**: Process stdout/stderr as it streams, not after completion
- **Structured error handling**: Distinguish exit codes, signals, and execution failures
- **Clean async APIs**: Promise-based execution with proper error propagation
- **Type safety**: Full TypeScript definitions for all options and return types

The library wraps child_process with these production concerns built-in, so applications focus on business logic rather than process management.

## Design Approach

### Callback-First Architecture

External processes produce output over time. Buffering entire output wastes memory and delays feedback. The `ExecuteOptions` interface provides:

- **onData(buffer)**: Raw output as it arrives (stdout + stderr mixed)
- **onStdout(data)**: Stdout only, line-buffered
- **onStderr(data)**: Stderr only, line-buffered
- **onExit(code, signal)**: Process termination notification

Applications attach callbacks to stream output to logs, UI, or progress monitors without blocking.

### Error Collection Strategy

Process execution can fail in multiple ways:

- **Non-zero exit codes**: Process ran but failed (e.g., file not found)
- **Signals**: Process killed (SIGTERM, SIGKILL)
- **Spawn errors**: Binary doesn't exist or isn't executable
- **Stream errors**: Stdout/stderr failures

The `ExecuteResult` interface captures all error modes:

```typescript
interface ExecuteResult {
  code: number;           // Exit code (0 = success)
  signal: string | null;  // Signal if killed
  errors: string[];       // Collected stderr lines
}
```

Applications check `code === 0` for success, inspect `errors[]` for diagnostics.

### Promise-Based Execution

Modern Node.js applications use async/await for control flow. The `execute()` function returns a Promise that resolves when the process completes:

```typescript
const result = await execute('command', ['arg1', 'arg2'], options);
if (result.code !== 0) {
  throw new Error(`Command failed: ${result.errors.join('\n')}`);
}
```

No callbacks for completion, no event emitters—just clean async code.

## Architecture

```
┌─────────────────────────────────────┐
│       Application Code              │
└──────────────┬──────────────────────┘
               │ calls
       ┌───────▼────────┐
       │  execute()     │  Promise-based API
       └───────┬────────┘
               │ wraps
       ┌───────▼────────┐
       │ child_process  │  Node.js spawn()
       │    .spawn()    │
       └───────┬────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐          ┌─────▼──────┐
│ stdout │          │  stderr    │
│ stream │          │  stream    │
└───┬────┘          └─────┬──────┘
    │                     │
    └─────────┬───────────┘
              ↓
       Callbacks (onData, onStdout, onStderr)
              ↓
       ExecuteResult
```

## Version 1.0

Version 1.0 provides process execution with comprehensive callback support and error handling.

**Key Features:**
- Promise-based `execute()` function
- Real-time output callbacks (onData, onStdout, onStderr)
- Structured error collection and reporting
- Exit code and signal handling
- TypeScript strict mode compliance
- Full type definitions for all options

**Supported Platforms:**
- macOS (darwin-arm64, darwin-x64)
- Linux (x64, ARM64)
- Windows (native Node.js or WSL2)

**Documentation:**

- 📦 [Installation Guide](./docs/1.0/installation.md)
- 🚀 [Quick Start](./docs/1.0/quick-start.md)
- 📚 [API Reference](./docs/1.0/api-reference.md)
- ⚙️ [Configuration](./docs/1.0/configuration.md)
- 💡 [Examples](./docs/1.0/examples.md)
- 🔧 [Troubleshooting](./docs/1.0/troubleshooting.md)
- 📖 [Complete v1.0 Documentation](./docs/1.0/README.md)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

**Development Setup:**
```bash
git clone https://github.com/yourusername/audio-tools.git
cd audio-tools/lib-runtime
pnpm install
pnpm run build
pnpm test
```

## License

Apache-2.0

## Credits

**Author:** Orion Letizi

**Related Projects:**
- [@oletizi/sampler-export](https://www.npmjs.com/package/@oletizi/sampler-export) - Uses lib-runtime for mtools execution
- [@oletizi/sampler-backup](https://www.npmjs.com/package/@oletizi/sampler-backup) - Uses lib-runtime for rsnapshot execution
- [@oletizi/sampler-devices](https://www.npmjs.com/package/@oletizi/sampler-devices) - Uses lib-runtime for akaitools execution

**External Dependencies:**
- Node.js built-in `child_process` module

---

**Need Help?**

- 📖 [Documentation](./docs/1.0/README.md)
- 🐛 [Report Issues](https://github.com/yourusername/audio-tools/issues)
- 💬 [Discussions](https://github.com/yourusername/audio-tools/discussions)
