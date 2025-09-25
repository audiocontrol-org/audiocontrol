/**
 * Tests for utility helper functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createOperationResult,
  delay,
  retryWithBackoff,
  withTimeout,
  clamp,
  mapRange,
  validateSlotNumber,
  validateMidiChannel,
  validateCCNumber,
  validateMidiValue,
  generateOperationId,
  calculateChecksum,
  verifyChecksum,
  formatDuration,
  debounce,
  throttle,
  safeJsonParse,
} from '@/utils/helpers.js';

// Mock timers for testing timing functions
vi.useFakeTimers();

describe('helpers', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  describe('createOperationResult', () => {
    it('should create successful operation result', () => {
      const startTime = Date.now() - 100;
      const result = createOperationResult(true, 'test data', undefined, startTime);

      expect(result.success).toBe(true);
      expect(result.data).toBe('test data');
      expect(result.duration).toBeGreaterThanOrEqual(100);
      expect(result.timestamp).toBeTypeOf('number');
      expect(result.error).toBeUndefined();
    });

    it('should create failed operation result', () => {
      const error = new Error('Test error');
      const result = createOperationResult(false, undefined, error);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Test error');
      expect(result.error?.code).toBe('PROTOCOL_ERROR');
      expect(result.error?.originalError).toBe(error);
    });

    it('should handle undefined data correctly', () => {
      const result = createOperationResult(true);
      expect('data' in result).toBe(false);
    });
  });

  describe('delay', () => {
    it('should resolve after specified time', async () => {
      const promise = delay(1000);
      vi.advanceTimersByTime(999);
      // Should not have resolved yet
      let resolved = false;
      promise.then(() => { resolved = true; });
      await vi.runOnlyPendingTimersAsync();
      expect(resolved).toBe(false);

      vi.advanceTimersByTime(1);
      await vi.runOnlyPendingTimersAsync();
      expect(resolved).toBe(true);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(operation, 3);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(operation, 3, 100);

      // Let the first attempt fail
      await vi.runOnlyPendingTimersAsync();

      // Advance time for first retry delay
      vi.advanceTimersByTime(100);
      await vi.runOnlyPendingTimersAsync();

      // Advance time for second retry delay
      vi.advanceTimersByTime(100);
      await vi.runOnlyPendingTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff when enabled', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(operation, 3, 100, true);

      await vi.runOnlyPendingTimersAsync();
      vi.advanceTimersByTime(100); // First delay: 100ms
      await vi.runOnlyPendingTimersAsync();
      vi.advanceTimersByTime(200); // Second delay: 200ms (exponential)
      await vi.runOnlyPendingTimersAsync();

      await expect(promise).resolves.toBe('success');
    });

    it('should throw after max retries exceeded', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      await expect(retryWithBackoff(operation, 2, 0)).rejects.toThrow('Always fails');
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('withTimeout', () => {
    it('should resolve when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('should reject when timeout is exceeded', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 2000));
      const timeoutPromise = withTimeout(promise, 1000);

      vi.advanceTimersByTime(1000);
      await expect(timeoutPromise).rejects.toThrow('Operation timed out after 1000ms');
    });
  });

  describe('mathematical utilities', () => {
    describe('clamp', () => {
      it('should clamp values within range', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(15, 0, 10)).toBe(10);
        expect(clamp(0, 0, 10)).toBe(0);
        expect(clamp(10, 0, 10)).toBe(10);
      });
    });

    describe('mapRange', () => {
      it('should map values between ranges', () => {
        expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
        expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
        expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
        expect(mapRange(0, 0, 127, -1, 1)).toBe(-1);
        expect(mapRange(127, 0, 127, -1, 1)).toBe(1);
        expect(mapRange(63.5, 0, 127, -1, 1)).toBe(0);
      });

      it('should handle zero-width source range', () => {
        expect(mapRange(5, 10, 10, 0, 100)).toBe(0);
      });
    });
  });

  describe('MIDI validation functions', () => {
    describe('validateSlotNumber', () => {
      it('should validate correct slot numbers', () => {
        expect(validateSlotNumber(1)).toBe(1);
        expect(validateSlotNumber(8)).toBe(8);
        expect(validateSlotNumber(4)).toBe(4);
        expect(validateSlotNumber('3')).toBe(3);
      });

      it('should reject invalid slot numbers', () => {
        expect(() => validateSlotNumber(0)).toThrow('Invalid slot number');
        expect(() => validateSlotNumber(9)).toThrow('Invalid slot number');
        expect(() => validateSlotNumber(-1)).toThrow('Invalid slot number');
        expect(() => validateSlotNumber(1.5)).toThrow('Invalid slot number');
        expect(() => validateSlotNumber('invalid')).toThrow('Invalid slot number');
      });
    });

    describe('validateMidiChannel', () => {
      it('should validate correct MIDI channels', () => {
        expect(validateMidiChannel(1)).toBe(1);
        expect(validateMidiChannel(16)).toBe(16);
        expect(validateMidiChannel('8')).toBe(8);
      });

      it('should reject invalid MIDI channels', () => {
        expect(() => validateMidiChannel(0)).toThrow('Invalid MIDI channel');
        expect(() => validateMidiChannel(17)).toThrow('Invalid MIDI channel');
        expect(() => validateMidiChannel(-1)).toThrow('Invalid MIDI channel');
        expect(() => validateMidiChannel(1.5)).toThrow('Invalid MIDI channel');
      });
    });

    describe('validateCCNumber', () => {
      it('should validate correct CC numbers', () => {
        expect(validateCCNumber(0)).toBe(0);
        expect(validateCCNumber(127)).toBe(127);
        expect(validateCCNumber('64')).toBe(64);
      });

      it('should reject invalid CC numbers', () => {
        expect(() => validateCCNumber(-1)).toThrow('Invalid CC number');
        expect(() => validateCCNumber(128)).toThrow('Invalid CC number');
        expect(() => validateCCNumber(1.5)).toThrow('Invalid CC number');
      });
    });

    describe('validateMidiValue', () => {
      it('should validate correct MIDI values', () => {
        expect(validateMidiValue(0)).toBe(0);
        expect(validateMidiValue(127)).toBe(127);
        expect(validateMidiValue('64')).toBe(64);
      });

      it('should reject invalid MIDI values', () => {
        expect(() => validateMidiValue(-1)).toThrow('Invalid MIDI value');
        expect(() => validateMidiValue(128)).toThrow('Invalid MIDI value');
        expect(() => validateMidiValue(1.5)).toThrow('Invalid MIDI value');
      });
    });
  });

  describe('utility functions', () => {
    describe('generateOperationId', () => {
      it('should generate unique IDs', () => {
        const id1 = generateOperationId();
        const id2 = generateOperationId();

        expect(id1).toMatch(/^\d+-[a-z0-9]+$/);
        expect(id2).toMatch(/^\d+-[a-z0-9]+$/);
        expect(id1).not.toBe(id2);
      });
    });

    describe('checksum functions', () => {
      describe('calculateChecksum', () => {
        it('should calculate checksum correctly', () => {
          expect(calculateChecksum([1, 2, 3])).toBe(6);
          expect(calculateChecksum([127, 1])).toBe(0); // (127 + 1) & 0x7F = 0
          expect(calculateChecksum([])).toBe(0);
        });
      });

      describe('verifyChecksum', () => {
        it('should verify checksums correctly', () => {
          expect(verifyChecksum([1, 2, 3], 6)).toBe(true);
          expect(verifyChecksum([1, 2, 3], 5)).toBe(false);
          expect(verifyChecksum([], 0)).toBe(true);
        });
      });
    });

    describe('formatDuration', () => {
      it('should format durations correctly', () => {
        expect(formatDuration(500)).toBe('500ms');
        expect(formatDuration(1000)).toBe('1.0s');
        expect(formatDuration(1500)).toBe('1.5s');
        expect(formatDuration(60000)).toBe('1m 0.0s');
        expect(formatDuration(90500)).toBe('1m 30.5s');
      });
    });
  });

  describe('function utilities', () => {
    describe('debounce', () => {
      it('should debounce function calls', async () => {
        const fn = vi.fn();
        const debouncedFn = debounce(fn, 100);

        debouncedFn('a');
        debouncedFn('b');
        debouncedFn('c');

        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        await vi.runOnlyPendingTimersAsync();

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('c');
      });

      it('should reset timer on subsequent calls', async () => {
        const fn = vi.fn();
        const debouncedFn = debounce(fn, 100);

        debouncedFn('a');
        vi.advanceTimersByTime(50);
        debouncedFn('b'); // Should reset the timer

        vi.advanceTimersByTime(50); // Total 100ms from first call, but only 50ms from second
        await vi.runOnlyPendingTimersAsync();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50); // 100ms from second call
        await vi.runOnlyPendingTimersAsync();
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('b');
      });
    });

    describe('throttle', () => {
      it('should throttle function calls', () => {
        const fn = vi.fn();
        const throttledFn = throttle(fn, 100);

        throttledFn('a');
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('a');

        throttledFn('b'); // Should be ignored
        throttledFn('c'); // Should be ignored
        expect(fn).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        throttledFn('d'); // Should execute
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenCalledWith('d');
      });
    });

    describe('safeJsonParse', () => {
      it('should parse valid JSON', () => {
        const result = safeJsonParse('{"test": 123}');
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ test: 123 });
        expect(result.error).toBeUndefined();
      });

      it('should handle invalid JSON', () => {
        const result = safeJsonParse('invalid json');
        expect(result.success).toBe(false);
        expect(result.data).toBeUndefined();
        expect(result.error).toContain('Unexpected token');
      });

      it('should handle empty string', () => {
        const result = safeJsonParse('');
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });
});