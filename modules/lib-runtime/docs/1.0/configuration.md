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

