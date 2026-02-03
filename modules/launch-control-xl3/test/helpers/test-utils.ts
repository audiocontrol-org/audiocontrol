/**
 * Test Utilities for Launch Control XL3
 *
 * Common utilities and helper functions for creating consistent,
 * deterministic tests across the test suite.
 *
 * @example
 * ```typescript
 * import { setupFakeTimers, createMockMidiBackend, assertMidiMessage } from '@/test/helpers/test-utils';
 *
 * describe('MyTest', () => {
 *   setupFakeTimers(); // Handles timer setup/teardown automatically
 *
 *   it('should send correct MIDI message', () => {
 *     const backend = createMockMidiBackend();
 *     // ... test logic
 *     assertMidiMessage(backend.getLastSentMessage(), [0xB0, 0x15, 0x7F]);
 *   });
 * });
 * ```
 */

import { beforeEach, afterEach, vi, expect } from 'vitest';
import type { MidiMessage } from '../../src/core/MidiInterface.js';
import { SyntheticClock } from '../utils/synthetic-clock.js';
import { DeterministicMidiBackend } from '../mocks/DeterministicMidiBackend.js';

// ===== Timer Management =====

/**
 * Set up fake timers with consistent configuration for all tests
 *
 * This function provides automatic setup and teardown of fake timers
 * with a deterministic starting time.
 *
 * @example
 * ```typescript
 * describe('Timer-dependent tests', () => {
 *   setupFakeTimers(); // All timer setup/teardown handled automatically
 *
 *   it('should handle timeout', async () => {
 *     const promise = someAsyncOperation();
 *     await vi.advanceTimersByTimeAsync(5000);
 *     await expect(promise).rejects.toThrow('timeout');
 *   });
 * });
 * ```
 */
export function setupFakeTimers(): void {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
}

/**
 * Set up fake timers with custom initial time
 * @param initialTime Initial time as Date or timestamp
 */
export function setupFakeTimersAt(initialTime: Date | number): void {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(initialTime);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
}

// ===== MIDI Backend Factories =====

/**
 * Create a deterministic MIDI backend for testing
 *
 * @param options Configuration options
 * @returns Configured DeterministicMidiBackend
 *
 * @example
 * ```typescript
 * const backend = createMockMidiBackend();
 * await backend.initialize();
 *
 * // Queue expected responses
 * backend.queueDeviceInquiryResponse();
 *
 * // Test your code
 * const ports = await backend.getOutputPorts();
 * expect(ports).toHaveLength(1);
 * ```
 */
export function createMockMidiBackend(options: {
  /** Custom timestamp function */
  timestampFn?: () => number;
  /** Whether to auto-initialize the backend */
  autoInitialize?: boolean;
  /** Custom port configurations */
  ports?: {
    inputs?: Array<{id: string, name: string, manufacturer?: string}>;
    outputs?: Array<{id: string, name: string, manufacturer?: string}>;
  };
} = {}): DeterministicMidiBackend {
  const {
    timestampFn = () => Date.now(),
    autoInitialize = false,
    ports
  } = options;

  const backend = new DeterministicMidiBackend(timestampFn);

  // Configure custom ports if provided
  if (ports) {
    const inputConfigs = ports.inputs?.map(p => ({
      id: p.id,
      name: p.name,
      manufacturer: p.manufacturer ?? 'Test'
    })) ?? [];

    const outputConfigs = ports.outputs?.map(p => ({
      id: p.id,
      name: p.name,
      manufacturer: p.manufacturer ?? 'Test'
    })) ?? [];

    backend.setPortConfigurations(inputConfigs, outputConfigs);
  }

  // Auto-initialize if requested (synchronous for deterministic tests)
  if (autoInitialize) {
    backend.initializeSync();
  }

  return backend;
}

/**
 * Create a mock MIDI backend with Launch Control XL3 configuration
 * @param timestampFn Custom timestamp function
 * @returns Pre-configured backend for Launch Control XL3
 */
export function createLaunchControlXL3Backend(timestampFn?: () => number): DeterministicMidiBackend {
  return DeterministicMidiBackend.createForLaunchControlXL3(timestampFn);
}

/**
 * Create a synthetic clock and backend combination
 * @returns Object with clock and backend instances
 *
 * @example
 * ```typescript
 * const { clock, backend } = createClockAndBackend();
 *
 * clock.advance(1000);
 * const message = { timestamp: clock.now(), data: [0xB0, 0x15, 0x7F] };
 * ```
 */
export function createClockAndBackend(): {
  clock: SyntheticClock;
  backend: DeterministicMidiBackend;
} {
  const clock = new SyntheticClock();
  const backend = createMockMidiBackend({
    timestampFn: clock.createTimestampFunction(),
    autoInitialize: true
  });

  return { clock, backend };
}

// ===== MIDI Message Assertions =====

/**
 * Assert that a MIDI message matches expected data
 *
 * @param actual Actual MIDI message (can be undefined)
 * @param expectedData Expected message data array
 * @param message Optional assertion message
 *
 * @example
 * ```typescript
 * const lastMessage = backend.getLastSentMessage();
 * assertMidiMessage(lastMessage, [0xB0, 0x15, 0x7F], 'Should send CC message');
 * ```
 */
export function assertMidiMessage(
  actual: MidiMessage | undefined,
  expectedData: number[],
  message?: string
): void {
  expect(actual, message).toBeDefined();
  expect(actual!.data, message).toEqual(expectedData);
}

/**
 * Assert that a MIDI message has specific properties
 * @param actual Actual MIDI message
 * @param expected Expected properties
 * @param message Optional assertion message
 */
export function assertMidiMessageProperties(
  actual: MidiMessage | undefined,
  expected: Partial<MidiMessage>,
  message?: string
): void {
  expect(actual, message).toBeDefined();

  if (expected.timestamp !== undefined) {
    expect(actual!.timestamp, `${message} - timestamp`).toBe(expected.timestamp);
  }

  if (expected.data !== undefined) {
    expect(actual!.data, `${message} - data`).toEqual(expected.data);
  }

  if (expected.type !== undefined) {
    expect(actual!.type, `${message} - type`).toBe(expected.type);
  }

  if (expected.channel !== undefined) {
    expect(actual!.channel, `${message} - channel`).toBe(expected.channel);
  }

  if (expected.controller !== undefined) {
    expect(actual!.controller, `${message} - controller`).toBe(expected.controller);
  }

  if (expected.value !== undefined) {
    expect(actual!.value, `${message} - value`).toBe(expected.value);
  }
}

/**
 * Assert that a SysEx message is properly formatted
 * @param actual Actual MIDI message
 * @param expectedContent Expected content between F0 and F7
 * @param message Optional assertion message
 */
export function assertSysExMessage(
  actual: MidiMessage | undefined,
  expectedContent: number[],
  message?: string
): void {
  expect(actual, message).toBeDefined();
  expect(actual!.data[0], `${message} - should start with F0`).toBe(0xF0);
  expect(actual!.data[actual!.data.length - 1], `${message} - should end with F7`).toBe(0xF7);

  const content = actual!.data.slice(1, -1);
  expect(content, `${message} - content`).toEqual(expectedContent);
}

/**
 * Assert that multiple messages were sent in order
 * @param messages Array of sent messages
 * @param expectedMessages Array of expected message data
 * @param message Optional assertion message
 */
export function assertMidiMessageSequence(
  messages: readonly MidiMessage[],
  expectedMessages: number[][],
  message?: string
): void {
  expect(messages, message).toHaveLength(expectedMessages.length);

  expectedMessages.forEach((expectedData, index) => {
    expect(messages[index]?.data, `${message} - message ${index}`).toEqual(expectedData);
  });
}

// ===== Control Change Helpers =====

/**
 * Create a Control Change MIDI message
 * @param channel MIDI channel (0-15)
 * @param controller Controller number (0-127)
 * @param value Controller value (0-127)
 * @param timestamp Message timestamp
 * @returns MIDI message object
 */
export function createControlChangeMessage(
  channel: number,
  controller: number,
  value: number,
  timestamp: number = Date.now()
): MidiMessage {
  return {
    timestamp,
    data: [0xB0 | (channel & 0x0F), controller & 0x7F, value & 0x7F],
    type: 'controlchange',
    channel,
    controller,
    value
  };
}

/**
 * Create a Note On MIDI message
 * @param channel MIDI channel (0-15)
 * @param note Note number (0-127)
 * @param velocity Note velocity (0-127)
 * @param timestamp Message timestamp
 * @returns MIDI message object
 */
export function createNoteOnMessage(
  channel: number,
  note: number,
  velocity: number,
  timestamp: number = Date.now()
): MidiMessage {
  return {
    timestamp,
    data: [0x90 | (channel & 0x0F), note & 0x7F, velocity & 0x7F],
    type: 'noteon',
    channel,
    note,
    velocity
  };
}

/**
 * Create a SysEx MIDI message
 * @param content Message content (without F0/F7 framing)
 * @param timestamp Message timestamp
 * @returns MIDI message object
 */
export function createSysExMessage(
  content: number[],
  timestamp: number = Date.now()
): MidiMessage {
  return {
    timestamp,
    data: [0xF0, ...content, 0xF7],
    type: 'sysex'
  };
}

// ===== Test Scenario Helpers =====

/**
 * Create a complete handshake test scenario
 * @param backend Backend to configure
 * @returns Object with helper methods for handshake testing
 *
 * @example
 * ```typescript
 * const scenario = createHandshakeScenario(backend);
 * scenario.queueSuccessfulHandshake();
 *
 * const result = await device.performHandshake();
 * scenario.verifyHandshakeCompleted();
 * ```
 */
export function createHandshakeScenario(backend: DeterministicMidiBackend) {
  return {
    /**
     * Queue a successful device handshake sequence
     */
    queueSuccessfulHandshake(): void {
      backend.queueDeviceInquiryResponse();
      backend.queueAckResponse();
    },

    /**
     * Queue a failed handshake (no response)
     */
    queueFailedHandshake(): void {
      // Don't queue any responses - will timeout
    },

    /**
     * Verify that handshake messages were sent
     */
    verifyHandshakeInitiated(): void {
      const messages = backend.getSentMessages();
      expect(messages.length).toBeGreaterThan(0);

      // Check for device inquiry
      const inquiry = messages.find(m =>
        m.data[0] === 0xF0 &&
        m.data[1] === 0x7E &&
        m.data[3] === 0x06 &&
        m.data[4] === 0x01
      );
      expect(inquiry, 'Should send device inquiry').toBeDefined();
    },

    /**
     * Verify handshake completed successfully
     */
    verifyHandshakeCompleted(): void {
      this.verifyHandshakeInitiated();
      const received = backend.getReceivedMessages();
      expect(received.length).toBeGreaterThan(0);
    }
  };
}

/**
 * Create a test scenario for custom mode operations
 * @param backend Backend to configure
 * @returns Object with helper methods for custom mode testing
 */
export function createCustomModeScenario(backend: DeterministicMidiBackend) {
  return {
    /**
     * Queue a successful custom mode read response
     * @param modeData Mock mode data
     */
    queueCustomModeResponse(modeData: number[]): void {
      backend.queueCustomModeResponse(modeData);
    },

    /**
     * Simulate control changes from the device
     * @param controls Array of {cc, value} pairs
     */
    simulateControlChanges(controls: Array<{cc: number, value: number}>): void {
      backend.queueControlChangeMessages(controls);
    },

    /**
     * Verify custom mode request was sent
     */
    verifyCustomModeRequested(): void {
      const messages = backend.getSentMessages();
      const customModeRequest = messages.find(m =>
        m.data[0] === 0xF0 &&
        m.data[1] === 0x00 &&
        m.data[2] === 0x20 &&
        m.data[3] === 0x29 // Novation
      );
      expect(customModeRequest, 'Should send custom mode request').toBeDefined();
    }
  };
}

// ===== Mock Cleanup Helpers =====

/**
 * Set up automatic mock cleanup for tests
 * @param mocks Array of objects with cleanup methods
 *
 * @example
 * ```typescript
 * describe('Tests with mocks', () => {
 *   const backend = createMockMidiBackend();
 *   const device = createMockDevice();
 *
 *   setupMockCleanup([backend, device]);
 *
 *   // Tests run here - cleanup happens automatically
 * });
 * ```
 */
export function setupMockCleanup(mocks: Array<{ cleanup?: () => void | Promise<void> }>): void {
  afterEach(async () => {
    for (const mock of mocks) {
      if (mock.cleanup) {
        await mock.cleanup();
      }
    }
  });
}

/**
 * Create a complete test environment with all utilities configured
 * @param options Configuration options
 * @returns Configured test environment
 *
 * @example
 * ```typescript
 * describe('Integration tests', () => {
 *   const env = createTestEnvironment();
 *
 *   it('should work end-to-end', async () => {
 *     const device = new LaunchControlXL3(env.backend);
 *     env.clock.advance(1000);
 *     // ... test logic
 *   });
 * });
 * ```
 */
export function createTestEnvironment(options: {
  /** Whether to set up fake timers */
  useFakeTimers?: boolean;
  /** Custom initial time */
  initialTime?: Date | number;
  /** Backend configuration */
  backendOptions?: Parameters<typeof createMockMidiBackend>[0];
} = {}) {
  const {
    useFakeTimers = true,
    initialTime = new Date('2024-01-01T00:00:00Z'),
    backendOptions = {}
  } = options;

  const clock = new SyntheticClock(
    typeof initialTime === 'number' ? initialTime : initialTime.getTime()
  );

  const backend = createMockMidiBackend({
    timestampFn: clock.createTimestampFunction(),
    autoInitialize: true,
    ...backendOptions
  });

  // Set up timers if requested
  if (useFakeTimers) {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(clock.toDate());
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });
  }

  // Set up automatic cleanup
  setupMockCleanup([backend]);

  return {
    clock,
    backend,
    createHandshakeScenario: () => createHandshakeScenario(backend),
    createCustomModeScenario: () => createCustomModeScenario(backend)
  };
}