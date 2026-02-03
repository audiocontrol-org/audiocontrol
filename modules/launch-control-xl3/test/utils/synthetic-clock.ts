/**
 * Synthetic Clock for Deterministic Testing
 *
 * Provides complete control over time in tests, eliminating non-determinism
 * from real-time operations and Date.now() dependencies.
 *
 * @example
 * ```typescript
 * describe('Timer tests', () => {
 *   let clock: SyntheticClock;
 *
 *   beforeEach(() => {
 *     clock = new SyntheticClock();
 *     vi.useFakeTimers();
 *     vi.setSystemTime(clock.now());
 *   });
 *
 *   it('should handle timeout correctly', () => {
 *     const startTime = clock.now();
 *
 *     // Advance time by 1000ms
 *     clock.advance(1000);
 *     vi.setSystemTime(clock.now());
 *
 *     expect(clock.now()).toBe(startTime + 1000);
 *   });
 * });
 * ```
 */

/**
 * A deterministic clock implementation for testing
 *
 * Unlike Date.now(), this clock provides complete control over time progression,
 * making tests deterministic and fast.
 */
export class SyntheticClock {
  private currentTime: number;

  /**
   * Create a new synthetic clock
   * @param initialTime Initial timestamp (defaults to 2024-01-01T00:00:00Z)
   */
  constructor(initialTime: number = new Date('2024-01-01T00:00:00Z').getTime()) {
    this.currentTime = initialTime;
  }

  /**
   * Get the current synthetic time
   * @returns Current timestamp in milliseconds
   */
  now(): number {
    return this.currentTime;
  }

  /**
   * Advance the clock by the specified amount
   * @param milliseconds Amount to advance in milliseconds
   */
  advance(milliseconds: number): void {
    if (milliseconds < 0) {
      throw new Error('Cannot advance time backwards');
    }
    this.currentTime += milliseconds;
  }

  /**
   * Set the clock to a specific time
   * @param timestamp Target timestamp in milliseconds
   */
  setTime(timestamp: number): void {
    this.currentTime = timestamp;
  }

  /**
   * Reset the clock to its initial time
   * @param newInitialTime Optional new initial time (defaults to constructor value)
   */
  reset(newInitialTime?: number): void {
    this.currentTime = newInitialTime ?? new Date('2024-01-01T00:00:00Z').getTime();
  }

  /**
   * Get elapsed time since clock creation or last reset
   * @returns Elapsed milliseconds
   */
  elapsed(): number {
    return this.currentTime - new Date('2024-01-01T00:00:00Z').getTime();
  }

  /**
   * Create a Date object representing the current synthetic time
   * @returns Date object at current synthetic time
   */
  toDate(): Date {
    return new Date(this.currentTime);
  }

  /**
   * Create a timestamp function bound to this clock
   * @returns Function that returns current synthetic time
   *
   * @example
   * ```typescript
   * const clock = new SyntheticClock();
   * const timestampFn = clock.createTimestampFunction();
   *
   * // Use as replacement for Date.now
   * const message = { timestamp: timestampFn(), data: [...] };
   * ```
   */
  createTimestampFunction(): () => number {
    return () => this.now();
  }

  /**
   * Create a mock Date constructor that uses synthetic time
   * @returns Mock Date constructor
   *
   * @example
   * ```typescript
   * const clock = new SyntheticClock();
   * const MockDate = clock.createMockDate();
   *
   * vi.stubGlobal('Date', MockDate);
   * // Now new Date() and Date.now() use synthetic time
   * ```
   */
  createMockDate(): any {
    const clock = this;

    function MockDate(...args: any[]): Date {
      if (args.length === 0) {
        return new Date(clock.now());
      }
      return new Date(...(args as []));
    }

    MockDate.now = () => clock.now();
    MockDate.parse = Date.parse;
    MockDate.UTC = Date.UTC;
    MockDate.prototype = Date.prototype;

    return MockDate as any;
  }

  /**
   * Utility method for testing async operations with timeouts
   * @param operation Async operation to execute
   * @param timeoutMs Timeout in milliseconds
   * @param advanceTime Whether to advance synthetic time during timeout
   * @returns Promise that resolves/rejects based on operation and timeout
   *
   * @example
   * ```typescript
   * const clock = new SyntheticClock();
   *
   * await clock.runWithTimeout(
   *   () => deviceConnection.handshake(),
   *   5000,
   *   true // Advance synthetic time to trigger timeout
   * );
   * ```
   */
  async runWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    advanceTime: boolean = false
  ): Promise<T> {
    const startTime = this.now();

    if (advanceTime) {
      // Schedule time advancement
      setTimeout(() => {
        this.advance(timeoutMs);
      }, 0);
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }
}

/**
 * Factory function for creating pre-configured synthetic clocks
 */
export class SyntheticClockFactory {
  /**
   * Create a clock starting at a specific date
   */
  static createAt(dateString: string): SyntheticClock {
    return new SyntheticClock(new Date(dateString).getTime());
  }

  /**
   * Create a clock for MIDI testing (starts at epoch for easy calculations)
   */
  static createForMidi(): SyntheticClock {
    return new SyntheticClock(0);
  }

  /**
   * Create a clock for performance testing
   */
  static createForPerformance(): SyntheticClock {
    return new SyntheticClock(performance.timeOrigin);
  }
}