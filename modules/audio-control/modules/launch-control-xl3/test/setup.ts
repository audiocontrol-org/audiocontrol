/**
 * Test setup and global configuration for vitest
 */

import { vi } from 'vitest';

// Mock MIDI interfaces since they require native modules
vi.mock('midi', () => ({
  Input: vi.fn().mockImplementation(() => ({
    getPortCount: vi.fn(() => 2),
    getPortName: vi.fn((index: number) => `Test Port ${index}`),
    openPort: vi.fn(),
    closePort: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    ignoreTypes: vi.fn(),
  })),
  Output: vi.fn().mockImplementation(() => ({
    getPortCount: vi.fn(() => 2),
    getPortName: vi.fn((index: number) => `Test Port ${index}`),
    openPort: vi.fn(),
    closePort: vi.fn(),
    sendMessage: vi.fn(),
  })),
}));

// Global test timeout
export const DEFAULT_TEST_TIMEOUT = 5000;

// Test utilities for consistent mocking
export function createMockMidiInput() {
  return {
    getPortCount: vi.fn(() => 2),
    getPortName: vi.fn((index: number) => `Mock Input ${index}`),
    openPort: vi.fn(),
    closePort: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    ignoreTypes: vi.fn(),
  };
}

export function createMockMidiOutput() {
  return {
    getPortCount: vi.fn(() => 2),
    getPortName: vi.fn((index: number) => `Mock Output ${index}`),
    openPort: vi.fn(),
    closePort: vi.fn(),
    sendMessage: vi.fn(),
  };
}