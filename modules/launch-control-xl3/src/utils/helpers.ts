/**
 * Utility functions with overloads for common operations
 */

import type { SlotNumber, DeviceOperationResult } from '@/types/device.js';
import type { CCNumber, MidiChannel, MidiValue } from '@/types/midi.js';

/**
 * Create a DeviceOperationResult with timing information
 */
export function createOperationResult<T = void>(
  success: boolean,
  data?: T,
  error?: Error,
  startTime: number = Date.now()
): DeviceOperationResult<T> {
  const timestamp = Date.now();
  const duration = timestamp - startTime;

  const result: DeviceOperationResult<T> = {
    success,
    timestamp,
    duration,
  };

  if (data !== undefined) {
    (result as any).data = data;
  }

  if (error !== undefined) {
    (result as any).error = {
      code: 'PROTOCOL_ERROR' as const,
      message: error.message,
      originalError: error,
    };
  }

  return result;
}

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  exponential: boolean = true
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      const delayMs = exponential
        ? baseDelayMs * Math.pow(2, attempt)
        : baseDelayMs;

      await delay(delayMs);
    }
  }

  throw lastError || new Error('Maximum retry attempts exceeded');
}

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Clamp a number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Map a value from one range to another
 */
export function mapRange(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
): number {
  if (fromMin === fromMax) {
    return toMin;
  }

  const normalized = (value - fromMin) / (fromMax - fromMin);
  return toMin + normalized * (toMax - toMin);
}

/**
 * Validate slot number (overloaded for type safety)
 */
export function validateSlotNumber(slot: number): SlotNumber;
export function validateSlotNumber(slot: unknown): SlotNumber;
export function validateSlotNumber(slot: unknown): SlotNumber {
  const num = typeof slot === 'number' ? slot : Number(slot);

  if (!Number.isInteger(num) || num < 1 || num > 8) {
    throw new Error(`Invalid slot number: ${slot}. Must be 1-8.`);
  }

  return num as SlotNumber;
}

/**
 * Validate MIDI channel (overloaded for type safety)
 */
export function validateMidiChannel(channel: number): MidiChannel;
export function validateMidiChannel(channel: unknown): MidiChannel;
export function validateMidiChannel(channel: unknown): MidiChannel {
  const num = typeof channel === 'number' ? channel : Number(channel);

  if (!Number.isInteger(num) || num < 1 || num > 16) {
    throw new Error(`Invalid MIDI channel: ${channel}. Must be 1-16.`);
  }

  return num as MidiChannel;
}

/**
 * Validate CC number (overloaded for type safety)
 */
export function validateCCNumber(cc: number): CCNumber;
export function validateCCNumber(cc: unknown): CCNumber;
export function validateCCNumber(cc: unknown): CCNumber {
  const num = typeof cc === 'number' ? cc : Number(cc);

  if (!Number.isInteger(num) || num < 0 || num > 127) {
    throw new Error(`Invalid CC number: ${cc}. Must be 0-127.`);
  }

  return num as CCNumber;
}

/**
 * Validate MIDI value (overloaded for type safety)
 */
export function validateMidiValue(value: number): MidiValue;
export function validateMidiValue(value: unknown): MidiValue;
export function validateMidiValue(value: unknown): MidiValue {
  const num = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(num) || num < 0 || num > 127) {
    throw new Error(`Invalid MIDI value: ${value}. Must be 0-127.`);
  }

  return num as MidiValue;
}

/**
 * Generate a unique ID for tracking operations
 */
export function generateOperationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate checksum for data integrity
 */
export function calculateChecksum(data: readonly number[]): number {
  return data.reduce((sum, byte) => (sum + byte) & 0x7F, 0);
}

/**
 * Verify checksum matches expected value
 */
export function verifyChecksum(data: readonly number[], expectedChecksum: number): boolean {
  return calculateChecksum(data) === expectedChecksum;
}

/**
 * Convert milliseconds to human-readable duration string
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  }

  const minutes = Math.floor(milliseconds / 60000);
  const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

/**
 * Create a debounced function that delays execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, delayMs);
  };
}

/**
 * Create a throttled function that limits execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let lastExecution = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastExecution >= delayMs) {
      lastExecution = now;
      func(...args);
    }
  };
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T = unknown>(json: string): { success: boolean; data?: T; error?: string } {
  try {
    return { success: true, data: JSON.parse(json) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}