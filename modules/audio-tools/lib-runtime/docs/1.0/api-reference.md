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

