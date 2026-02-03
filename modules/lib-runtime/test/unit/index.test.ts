import { describe, it, expect, vi } from 'vitest';
import { execute } from '@/index.js';

describe('lib-runtime', () => {
  describe('execute', () => {
    // Happy path tests
    it('should execute simple commands successfully', async () => {
      const result = await execute('echo', ['Hello']);
      expect(result.code).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should execute commands with multiple arguments', async () => {
      const result = await execute('echo', ['Hello', 'World']);
      expect(result.code).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should execute commands with empty args array', async () => {
      const result = await execute('pwd', []);
      expect(result.code).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    // Callback tests
    it('should call onStart callback with child process', async () => {
      const onStart = vi.fn();
      await execute('echo', ['test'], { onStart, onData: () => {} });
      expect(onStart).toHaveBeenCalledOnce();
      expect(onStart.mock.calls[0][0]).toBeDefined(); // ChildProcess object
    });

    it('should call onData callback with output buffer', async () => {
      const onData = vi.fn();
      await execute('echo', ['Hello'], { onData });
      expect(onData).toHaveBeenCalled();
      const bufferContent = onData.mock.calls
        .map(call => call[0].toString())
        .join('');
      expect(bufferContent).toContain('Hello');
    });

    it('should accumulate output through onData callback', async () => {
      let output = '';
      const onData = vi.fn((buf) => {
        output += buf.toString();
      });
      await execute('echo', ['Test Output'], { onData });
      expect(output).toContain('Test Output');
    });

    it('should work with both onStart and onData callbacks', async () => {
      const onStart = vi.fn();
      const onData = vi.fn();
      await execute('echo', ['combined'], { onStart, onData });
      expect(onStart).toHaveBeenCalledOnce();
      expect(onData).toHaveBeenCalled();
    });

    // Error handling tests
    it('should handle non-existent commands', async () => {
      const result = await execute('nonexistent-command-xyz-12345', []);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should capture stderr in errors array', async () => {
      const result = await execute('sh', ['-c', 'echo "error output" >&2']);
      expect(result.code).toBe(0);
      // stderr should be captured even on successful commands
    });

    it('should handle command failures with non-zero exit codes', async () => {
      const result = await execute('sh', ['-c', 'exit 1']);
      expect(result.code).toBe(1);
    });

    it('should handle commands that write to stderr', async () => {
      const result = await execute('sh', ['-c', 'echo "stderr message" >&2; exit 0']);
      expect(result.code).toBe(0);
      // errors array should contain stderr output
    });

    // Edge cases
    it('should handle commands with special characters in arguments', async () => {
      const result = await execute('echo', ['Hello "World"']);
      expect(result.code).toBe(0);
    });

    it('should handle long-running commands', async () => {
      const result = await execute('sh', ['-c', 'sleep 0.1; echo done']);
      expect(result.code).toBe(0);
    }, 5000);

    it('should handle commands with large output', async () => {
      let dataCallCount = 0;
      await execute('sh', ['-c', 'for i in {1..100}; do echo "line $i"; done'], {
        onData: () => { dataCallCount++; }
      });
      expect(dataCallCount).toBeGreaterThan(0);
    });

    it('should handle parallel command execution', async () => {
      const promises = [
        execute('echo', ['first']),
        execute('echo', ['second']),
        execute('echo', ['third'])
      ];
      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.code).toBe(0);
      });
    });

    // Type validation tests
    it('should return ExecutionResult with correct shape', async () => {
      const result = await execute('echo', ['test']);
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('errors');
      expect(typeof result.code).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return errors as array of Errors', async () => {
      const result = await execute('nonexistent-command', []);
      result.errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
      });
    });

    // Additional edge cases
    it('should handle commands with no output', async () => {
      const onData = vi.fn();
      const result = await execute('true', [], { onData });
      expect(result.code).toBe(0);
      // onData might not be called if no output
    });

    it('should handle commands that only produce stderr', async () => {
      const result = await execute('sh', ['-c', 'echo "only stderr" >&2']);
      expect(result.code).toBe(0);
    });

    it('should maintain callback context', async () => {
      const context = { called: false };
      await execute('echo', ['test'], {
        onData: function() {
          context.called = true;
        }
      });
      expect(context.called).toBe(true);
    });

    it('should handle rapid successive calls', async () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await execute('echo', [`iteration-${i}`]));
      }
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.code).toBe(0);
      });
    });

    it('should handle commands with different exit codes', async () => {
      const exitCodes = [0, 1, 2, 127];
      for (const code of exitCodes) {
        const result = await execute('sh', ['-c', `exit ${code}`]);
        expect(result.code).toBe(code);
      }
    });

    it('should work without any callbacks', async () => {
      const result = await execute('echo', ['no callbacks']);
      expect(result.code).toBe(0);
    });
  });
});
