/**
 * Retry utilities with exponential backoff
 *
 * Implements retry best practices for distributed systems:
 * - Exponential backoff with configurable base and max delay
 * - Jitter to prevent thundering herd
 * - Configurable retry conditions
 * - Comprehensive error handling
 *
 * @see https://blog.bytebytego.com/p/a-guide-to-retry-pattern-in-distributed
 */

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (not including the initial attempt)
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before the first retry
   * @default 100
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds between retries
   * @default 10000
   */
  maxDelayMs?: number;

  /**
   * Multiplier for exponential backoff (delay = initialDelay * multiplier^attempt)
   * @default 2
   */
  multiplier?: number;

  /**
   * Jitter factor (0-1) to randomize delay and prevent thundering herd
   * 0 = no jitter, 1 = full jitter (delay can be anywhere from 0 to calculated delay)
   * @default 0.5
   */
  jitter?: number;

  /**
   * Optional function to determine if an error is retryable
   * Returns true if the operation should be retried
   * @default () => true (all errors are retryable)
   */
  isRetryable?: (error: unknown) => boolean;

  /**
   * Optional callback invoked before each retry attempt
   * Useful for logging or metrics
   */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;

  /**
   * Optional timeout for each individual attempt in milliseconds
   * If not specified, no timeout is applied
   */
  attemptTimeoutMs?: number;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The result value if successful */
  value?: T;
  /** The last error if failed */
  error?: unknown;
  /** Number of attempts made (1 = succeeded on first try) */
  attempts: number;
  /** Total time elapsed in milliseconds */
  elapsedMs: number;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  multiplier: number,
  jitter: number
): number {
  // Exponential backoff: delay = initialDelay * multiplier^attempt
  const exponentialDelay = initialDelayMs * Math.pow(multiplier, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Apply jitter: randomize between (1-jitter)*delay and delay
  // This uses "decorrelated jitter" approach
  const jitterRange = cappedDelay * jitter;
  const jitteredDelay = cappedDelay - jitterRange + Math.random() * jitterRange;

  return Math.floor(jitteredDelay);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Execute an async operation with retry and exponential backoff
 *
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result or rejecting with the last error
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3 }
 * );
 *
 * // With custom retry condition
 * const result = await withRetry(
 *   () => sendMidiCommand(),
 *   {
 *     maxRetries: 5,
 *     initialDelayMs: 100,
 *     isRetryable: (err) => err.message.includes('timeout'),
 *     onRetry: (attempt, err, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${err}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 10000,
    multiplier = 2,
    jitter = 0.5,
    isRetryable = () => true,
    onRetry,
    attemptTimeoutMs,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute the operation, optionally with timeout
      const result = attemptTimeoutMs
        ? await withTimeout(operation(), attemptTimeoutMs)
        : await operation();

      return result;
    } catch (error) {
      lastError = error;

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryable(error)) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delayMs = calculateDelay(
        attempt,
        initialDelayMs,
        maxDelayMs,
        multiplier,
        jitter
      );

      // Invoke retry callback if provided
      onRetry?.(attempt + 1, error, delayMs);

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // All retries exhausted, throw the last error
  throw lastError;
}

/**
 * Execute an async operation with retry, returning a detailed result object
 * instead of throwing on failure
 *
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to a result object with success status and details
 *
 * @example
 * ```typescript
 * const result = await withRetryResult(
 *   () => sendData(),
 *   { maxRetries: 3 }
 * );
 *
 * if (result.success) {
 *   console.log('Data sent:', result.value);
 * } else {
 *   console.log(`Failed after ${result.attempts} attempts:`, result.error);
 * }
 * ```
 */
export async function withRetryResult<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  const trackingOptions: RetryOptions = {
    ...options,
    onRetry: (attempt, error, delayMs) => {
      attempts = attempt;
      options.onRetry?.(attempt, error, delayMs);
    },
  };

  try {
    const value = await withRetry(operation, trackingOptions);
    return {
      success: true,
      value,
      attempts: attempts + 1,
      elapsedMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error,
      attempts: (options.maxRetries ?? 3) + 1,
      elapsedMs: Date.now() - startTime,
    };
  }
}

/**
 * Create a retry wrapper with pre-configured options
 *
 * Useful for creating domain-specific retry functions with consistent settings
 *
 * @param defaultOptions - Default retry options to use
 * @returns A configured retry function
 *
 * @example
 * ```typescript
 * // Create a MIDI-specific retry function
 * const midiRetry = createRetryWrapper({
 *   maxRetries: 5,
 *   initialDelayMs: 50,
 *   maxDelayMs: 2000,
 *   isRetryable: (err) => err.message.includes('timeout'),
 * });
 *
 * // Use it for MIDI operations
 * const result = await midiRetry(() => sendSysEx(data));
 * ```
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return function <T>(
    operation: () => Promise<T>,
    overrideOptions: RetryOptions = {}
  ): Promise<T> {
    return withRetry(operation, { ...defaultOptions, ...overrideOptions });
  };
}
