# Changelog

## 1.0.0-alpha.41

### Patch Changes

- Add automatic README version updates and one-click release workflow

## 1.0.0-alpha.40

### Patch Changes

- Restructure monorepo to modules/ directory and add changesets workflow

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [7.0.0] - 2025-10-04

### Added

- **Comprehensive test suite** - 23 unit tests with 95.23% coverage
  - Process execution tests (success, error, exit code propagation)
  - Stream handling tests (stdout, stderr)
  - Callback mechanism tests (onStart, onData)
  - Timeout handling tests
  - Binary execution tests
- **Comprehensive JSDoc/TSDoc documentation** for all public APIs (42e1be4, f5a95ae, 8b9ae6a)
- **Test framework setup** - vitest with @vitest/coverage-v8

### Changed

- **BREAKING: Made callbacks optional** - `onStart?` and `onData?` callbacks now properly optional
  - Uses optional chaining for callback invocation
  - No more "not a function" errors when callbacks not provided
- **BREAKING: Removed `shell: true`** from spawn() calls
  - Fixes exit code propagation (non-zero codes now properly returned)
  - Improves security (no shell injection risk)
  - More predictable process execution
- **Enhanced error handling** - Better error messages for process failures
- **Improved type safety** - Strict TypeScript compliance

### Removed

- **BREAKING: Removed unused `voidFunction()` helper**
- Removed mocha, chai, c8 dependencies (migrated to vitest)
- Removed `.mocharc.json` configuration

### Fixed

- **Exit code handling** - Non-zero exit codes now propagate correctly
- **Callback safety** - Optional callbacks handled safely with optional chaining
- **PostCSS loading errors** - Added `postcss.config.cjs` to prevent module errors
- **Test reliability** - Deterministic tests independent of environment

### Security

- **Strict TypeScript mode** - All modules comply with strict type checking
- **100% import pattern compliance** - All imports use `@/` pattern with `.js` extensions
- **No shell execution** - Direct process spawning without shell (prevents injection)
- **Input validation** - Proper validation of execution options

## Migration Guide

### Upgrading from 6.x to 7.0.0

#### Callback Changes

**Before (v6.x)**:

```typescript
import { execute } from "@oletizi/lib-runtime";

// Callbacks were required
const result = await execute("command", ["arg"], {
  onStart: (pid) => console.log(`Started: ${pid}`),
  onData: (data) => console.log(data),
});
```

**After (v7.0.0)**:

```typescript
import { execute } from "@oletizi/lib-runtime";

// Callbacks are now optional
const result = await execute("command", ["arg"], {
  onStart: (pid) => console.log(`Started: ${pid}`), // optional
  onData: (data) => console.log(data), // optional
});

// Can omit callbacks entirely
const result = await execute("command", ["arg"], {});
```

#### Exit Code Handling

**Before (v6.x)**:

```typescript
// Exit codes might not propagate correctly due to shell: true
const result = await execute("false", []); // Always code 0
```

**After (v7.0.0)**:

```typescript
// Exit codes now propagate correctly
const result = await execute("false", []); // code: 1 (actual exit code)
expect(result.code).toBe(1); // Works correctly
```

#### Testing Changes

**Before (v6.x - mocha+chai)**:

```typescript
import { expect } from "chai";

describe("test", () => {
  it("should execute", async () => {
    const result = await execute("echo", ["test"]);
    expect(result.code).to.equal(0);
  });
});
```

**After (v7.0.0 - vitest)**:

```typescript
import { describe, it, expect } from "vitest";

describe("test", () => {
  it("should execute", async () => {
    const result = await execute("echo", ["test"]);
    expect(result.code).toBe(0);
  });
});
```

## Package Features

### Process Execution

- **Async process execution** - Promise-based process spawning
- **Stream capture** - Capture stdout and stderr
- **Exit code propagation** - Accurate exit code reporting
- **Timeout support** - Configurable execution timeouts
- **Callback hooks** - Optional onStart and onData callbacks

### Execution Options

- **Working directory** - Specify process working directory
- **Environment variables** - Custom environment for processes
- **Timeout control** - Prevent runaway processes
- **Stream handling** - Real-time stdout/stderr capture

### Binary Execution

- **Platform detection** - Automatic platform-specific binary selection
- **Path resolution** - Resolve binary paths automatically
- **Error reporting** - Clear messages for missing binaries

## Installation

```bash
npm install @oletizi/lib-runtime
```

## Quick Start

```typescript
import { execute, ExecutionOptions } from "@oletizi/lib-runtime";

// Simple execution
const result = await execute("echo", ["Hello, World!"]);
console.log(result.stdout); // "Hello, World!\n"
console.log(result.code); // 0

// With callbacks
const result = await execute("long-running-command", ["--verbose"], {
  onStart: (pid) => console.log(`Process started: ${pid}`),
  onData: (data) => console.log(`Output: ${data}`),
  timeout: 30000, // 30 second timeout
});

// Error handling
try {
  const result = await execute("failing-command", []);
} catch (error) {
  console.error(`Execution failed: ${error.message}`);
}
```

See the [README](./README.md) for comprehensive documentation and examples.

## Coverage Details

```
File          | % Stmts | % Branch | % Funcs | % Lines
--------------|---------|----------|---------|--------
src/index.ts  |   95.23 |    83.33 |   95.23 |   95.23
```

**Coverage Achievements**:

- ✅ All execution paths tested
- ✅ Success and error cases covered
- ✅ Exit code scenarios verified
- ✅ Callback mechanisms validated
- ✅ Timeout handling tested

---

[7.0.0]: https://github.com/oletizi/audio-tools/releases/tag/lib-runtime-v7.0.0
