/**
 * Test utilities for mocking MIDI interfaces and creating test data
 */

import { vi } from 'vitest';
import type { MidiChannel, CCNumber, MidiValue } from '@/types/midi.js';
import type { SlotNumber } from '@/types/device.js';

// MIDI Interface Mocks
export interface MockMidiInput {
  getPortCount: ReturnType<typeof vi.fn>;
  getPortName: ReturnType<typeof vi.fn>;
  openPort: ReturnType<typeof vi.fn>;
  closePort: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  ignoreTypes: ReturnType<typeof vi.fn>;
}

export interface MockMidiOutput {
  getPortCount: ReturnType<typeof vi.fn>;
  getPortName: ReturnType<typeof vi.fn>;
  openPort: ReturnType<typeof vi.fn>;
  closePort: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock MIDI input with consistent behavior
 */
export function createMockMidiInput(): MockMidiInput {
  const mockInput = {
    getPortCount: vi.fn(() => 2),
    getPortName: vi.fn((index: number) => {
      if (index === 0) return 'Launch Control XL 3 MIDI In';
      if (index === 1) return 'Other MIDI Device';
      return '';
    }),
    openPort: vi.fn(),
    closePort: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    ignoreTypes: vi.fn(),
  };

  return mockInput;
}

/**
 * Create a mock MIDI output with consistent behavior
 */
export function createMockMidiOutput(): MockMidiOutput {
  const mockOutput = {
    getPortCount: vi.fn(() => 2),
    getPortName: vi.fn((index: number) => {
      if (index === 0) return 'Launch Control XL 3 MIDI Out';
      if (index === 1) return 'Other MIDI Device';
      return '';
    }),
    openPort: vi.fn(),
    closePort: vi.fn(),
    sendMessage: vi.fn(),
  };

  return mockOutput;
}

// Test Data Factories

/**
 * Create a test control configuration
 */
export function createTestControlConfig(overrides: any = {}) {
  return {
    id: { type: 'knob' as const, position: 1, row: 1 },
    midiChannel: 1 as MidiChannel,
    ccNumber: 21 as CCNumber,
    controlType: { type: 'knob' as const, behavior: 'absolute' as const },
    name: 'Test Knob',
    ...overrides,
  };
}

/**
 * Create a test custom mode
 */
export function createTestCustomMode(overrides: any = {}) {
  return {
    slot: 1 as SlotNumber,
    name: 'Test Mode',
    controls: [createTestControlConfig()],
    globalChannel: 1 as MidiChannel,
    description: 'Test mode for unit testing',
    createdAt: new Date(),
    modifiedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a test SysEx message
 */
export function createTestSysExMessage(overrides: any = {}) {
  return {
    manufacturerId: [0x00, 0x20, 0x29],
    deviceId: [0x02, 0x0D],
    data: [0x45, 0x01, 0x00],
    ...overrides,
  };
}

/**
 * Create a test Control Change message
 */
export function createTestCCMessage(overrides: any = {}) {
  return {
    type: 'controlChange' as const,
    channel: 1 as MidiChannel,
    cc: 21 as CCNumber,
    value: 64 as MidiValue,
    timestamp: Date.now(),
    data: [0xB0, 21, 64],
    ...overrides,
  };
}

/**
 * Create a test Note message
 */
export function createTestNoteMessage(overrides: any = {}) {
  return {
    type: 'noteOn' as const,
    channel: 1 as MidiChannel,
    note: 60,
    velocity: 127,
    timestamp: Date.now(),
    data: [0x90, 60, 127],
    ...overrides,
  };
}

/**
 * Create test device options
 */
export function createTestDeviceOptions(overrides: any = {}) {
  return {
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 1000,
      exponentialBackoff: true,
    },
    heartbeat: {
      intervalMs: 5000,
      timeoutMs: 2000,
      enabled: true,
    },
    errorRecovery: {
      autoReconnect: true,
      reconnectDelayMs: 2000,
      maxReconnectAttempts: 5,
    },
    timeout: {
      connectionMs: 5000,
      commandMs: 2000,
      sysexMs: 3000,
    },
    ...overrides,
  };
}

// MIDI Message Builders

/**
 * Build a SysEx message byte array
 */
export function buildSysExMessage(
  manufacturerId: number[],
  deviceId: number[] = [],
  opcode: number,
  data: number[] = []
): number[] {
  return [
    0xF0, // SysEx start
    ...manufacturerId,
    ...deviceId,
    opcode,
    ...data,
    0xF7, // SysEx end
  ];
}

/**
 * Build a Control Change message byte array
 */
export function buildCCMessage(
  channel: number,
  ccNumber: number,
  value: number
): number[] {
  return [
    0xB0 + (channel - 1), // CC status byte (channel 1-16 -> 0-15)
    ccNumber,
    value,
  ];
}

/**
 * Build a Note On message byte array
 */
export function buildNoteOnMessage(
  channel: number,
  note: number,
  velocity: number
): number[] {
  return [
    0x90 + (channel - 1), // Note On status byte
    note,
    velocity,
  ];
}

/**
 * Build a Note Off message byte array
 */
export function buildNoteOffMessage(
  channel: number,
  note: number,
  velocity: number = 0
): number[] {
  return [
    0x80 + (channel - 1), // Note Off status byte
    note,
    velocity,
  ];
}

// Test Assertion Helpers

/**
 * Assert that a MIDI message has the correct format
 */
export function assertMidiMessage(
  message: number[],
  expectedType: 'cc' | 'noteOn' | 'noteOff' | 'sysex'
): void {
  if (expectedType === 'sysex') {
    if (message[0] !== 0xF0 || message[message.length - 1] !== 0xF7) {
      throw new Error('Invalid SysEx message format');
    }
  } else if (expectedType === 'cc') {
    if ((message[0] & 0xF0) !== 0xB0) {
      throw new Error('Invalid Control Change message format');
    }
  } else if (expectedType === 'noteOn') {
    if ((message[0] & 0xF0) !== 0x90) {
      throw new Error('Invalid Note On message format');
    }
  } else if (expectedType === 'noteOff') {
    if ((message[0] & 0xF0) !== 0x80) {
      throw new Error('Invalid Note Off message format');
    }
  }
}

/**
 * Simulate MIDI input callback
 */
export function simulateMidiInput(
  mockInput: MockMidiInput,
  message: number[],
  deltaTime: number = 0
): void {
  const messageCallback = mockInput.on.mock.calls.find(
    call => call[0] === 'message'
  )?.[1];

  if (messageCallback) {
    messageCallback(deltaTime, message);
  }
}

/**
 * Wait for async operations in tests
 */
export function waitForAsync(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Constants for testing
export const TEST_CONSTANTS = {
  NOVATION_MANUFACTURER_ID: [0x00, 0x20, 0x29],
  XL3_DEVICE_ID: [0x02, 0x0D],
  DEFAULT_TIMEOUT: 5000,
  MOCK_DEVICE_NAMES: {
    INPUT: 'Launch Control XL 3 MIDI In',
    OUTPUT: 'Launch Control XL 3 MIDI Out',
  },
} as const;