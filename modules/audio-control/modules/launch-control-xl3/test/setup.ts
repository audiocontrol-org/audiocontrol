/**
 * Test setup and global configuration for vitest
 * Optimized for fast parallel execution with minimal overhead
 */

import { vi, beforeEach, afterEach } from 'vitest';

// Performance optimization: Pre-create mock factory functions
const createMidiInputMock = () => ({
  getPortCount: vi.fn(() => 2),
  getPortName: vi.fn((index: number) => `Test Port ${index}`),
  openPort: vi.fn(),
  closePort: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
  ignoreTypes: vi.fn(),
});

const createMidiOutputMock = () => ({
  getPortCount: vi.fn(() => 2),
  getPortName: vi.fn((index: number) => `Test Port ${index}`),
  openPort: vi.fn(),
  closePort: vi.fn(),
  sendMessage: vi.fn(),
});

// Mock MIDI interfaces once for all tests (hoisted)
vi.mock('midi', () => ({
  Input: vi.fn().mockImplementation(createMidiInputMock),
  Output: vi.fn().mockImplementation(createMidiOutputMock),
}));

// Mock optional peer dependencies that might not be available
vi.mock('easymidi', () => ({
  Input: vi.fn().mockImplementation(createMidiInputMock),
  Output: vi.fn().mockImplementation(createMidiOutputMock),
}), { virtual: true });

vi.mock('jzz', () => ({
  default: {
    openMidiIn: vi.fn(),
    openMidiOut: vi.fn(),
    info: vi.fn(() => ({
      inputs: ['Test Input'],
      outputs: ['Test Output'],
    })),
  },
}), { virtual: true });

// Performance optimization: Disable console logs during tests unless explicitly needed
if (!process.env.VITEST_VERBOSE) {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  // Only mock console methods that aren't needed for debugging
  console.log = vi.fn();
  console.debug = vi.fn();
  console.warn = vi.fn();
  // Keep console.error for important test failures
}

// Global test configuration constants
export const DEFAULT_TEST_TIMEOUT = 3000; // Reduced for faster tests
export const ASYNC_OPERATION_TIMEOUT = 1000; // For async operations
export const TIMER_ADVANCE_STEP = 100; // For timer-based tests

// Pre-computed test data for performance
export const TEST_MIDI_MESSAGES = {
  DEVICE_INQUIRY: [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7],
  SYN_MESSAGE: [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7],
  DEVICE_RESPONSE: [
    0xF0, 0x7E, 0x00, 0x06, 0x02,
    0x00, 0x20, 0x29,
    0x48, 0x01,
    0x00, 0x00,
    0x01, 0x00, 0x0A, 0x54,
    0xF7
  ],
} as const;

// Fast utility functions for test performance
export function createMockMidiInput() {
  return createMidiInputMock();
}

export function createMockMidiOutput() {
  return createMidiOutputMock();
}

// Performance-optimized mock logger that reuses the same instance
let _cachedMockLogger: any = null;
export function createMockLogger() {
  if (!_cachedMockLogger) {
    _cachedMockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  }
  return _cachedMockLogger;
}

// Global setup for consistent test environment
beforeEach(() => {
  // Reset only the cached logger mocks, not recreate
  if (_cachedMockLogger) {
    vi.clearAllMocks();
  }
});

// Global cleanup to prevent memory leaks
afterEach(() => {
  // Clear timers to prevent interference between tests
  vi.clearAllTimers();
});