/**
 * WebMidiBackend Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebMidiBackend } from '@/core/backends/WebMidiBackend';
import type { MidiMessage } from '@/core/MidiInterface.js';

// Mock Web MIDI API types
interface MockMIDIPort {
  id: string;
  name: string;
  manufacturer?: string;
  version?: string;
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
  type: 'input' | 'output';
  open(): Promise<MockMIDIPort>;
  close(): Promise<MockMIDIPort>;
  onmidimessage?: ((event: MockMIDIMessageEvent) => void) | null;
  send?(data: number[] | Uint8Array, timestamp?: number): void;
}

interface MockMIDIMessageEvent {
  data: Uint8Array;
  timeStamp: number;
}

interface MockMIDIAccess {
  inputs: Map<string, MockMIDIPort>;
  outputs: Map<string, MockMIDIPort>;
  sysexEnabled: boolean;
  onstatechange?: ((event: MockMIDIConnectionEvent) => void) | null;
}

interface MockMIDIConnectionEvent {
  port: MockMIDIPort;
}

// Global navigator mock
const mockNavigator = {
  requestMIDIAccess: vi.fn()
};

// Mock MIDI port factory functions
function createMockMIDIInput(id: string, name: string = `Input ${id}`): MockMIDIPort {
  return {
    id,
    name,
    manufacturer: 'Mock Manufacturer',
    version: '1.0.0',
    state: 'connected',
    connection: 'closed',
    type: 'input',
    onmidimessage: null,
    open: vi.fn().mockResolvedValue(this),
    close: vi.fn().mockResolvedValue(this)
  };
}

function createMockMIDIOutput(id: string, name: string = `Output ${id}`): MockMIDIPort {
  return {
    id,
    name,
    manufacturer: 'Mock Manufacturer',
    version: '1.0.0',
    state: 'connected',
    connection: 'closed',
    type: 'output',
    send: vi.fn(),
    open: vi.fn().mockResolvedValue(this),
    close: vi.fn().mockResolvedValue(this)
  };
}

function createMockMIDIAccess(options: { sysexEnabled?: boolean } = {}): MockMIDIAccess {
  const inputPort1 = createMockMIDIInput('input-1', 'Launch Control XL3');
  const inputPort2 = createMockMIDIInput('input-2', 'USB MIDI Device');
  const outputPort1 = createMockMIDIOutput('output-1', 'Launch Control XL3');
  const outputPort2 = createMockMIDIOutput('output-2', 'USB MIDI Device');

  return {
    inputs: new Map([
      ['input-1', inputPort1],
      ['input-2', inputPort2]
    ]),
    outputs: new Map([
      ['output-1', outputPort1],
      ['output-2', outputPort2]
    ]),
    sysexEnabled: options.sysexEnabled ?? true,
    onstatechange: null
  };
}

describe('WebMidiBackend', () => {
  let mockMIDIAccess: MockMIDIAccess;
  let backend: WebMidiBackend;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock navigator globally
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
      configurable: true
    });

    mockMIDIAccess = createMockMIDIAccess();
    mockNavigator.requestMIDIAccess.mockResolvedValue(mockMIDIAccess);

    backend = new WebMidiBackend();
  });

  afterEach(async () => {
    // Clean up backend
    try {
      await backend.cleanup();
    } catch {
      // Ignore cleanup errors in tests
    }

    // Clean up global mocks
    delete (global as any).navigator;
  });

  describe('isAvailable', () => {
    it('should return true when Web MIDI API is available', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          requestMIDIAccess: vi.fn()
        },
        writable: true,
        configurable: true
      });

      expect(WebMidiBackend.isAvailable()).toBe(true);
    });

    it('should return false when navigator is undefined', () => {
      delete (global as any).navigator;
      expect(WebMidiBackend.isAvailable()).toBe(false);
    });

    it('should return false when requestMIDIAccess is not available', () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
        configurable: true
      });

      expect(WebMidiBackend.isAvailable()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with SysEx permission', async () => {
      await backend.initialize();

      expect(mockNavigator.requestMIDIAccess).toHaveBeenCalledWith({ sysex: true });
    });

    it('should not reinitialize if already initialized', async () => {
      await backend.initialize();
      await backend.initialize();

      expect(mockNavigator.requestMIDIAccess).toHaveBeenCalledTimes(1);
    });

    it('should throw error when Web MIDI API is not available', async () => {
      delete (global as any).navigator;

      await expect(backend.initialize()).rejects.toThrow(
        'Web MIDI API not available. Requires modern browser with MIDI support and HTTPS.'
      );
    });

    it('should throw error when requestMIDIAccess is not available', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
        configurable: true
      });

      await expect(backend.initialize()).rejects.toThrow(
        'Web MIDI API not available. Requires modern browser with MIDI support and HTTPS.'
      );
    });

    it('should handle SecurityError with descriptive message', async () => {
      const securityError = new Error('Permission denied');
      securityError.name = 'SecurityError';
      mockNavigator.requestMIDIAccess.mockRejectedValue(securityError);

      await expect(backend.initialize()).rejects.toThrow(
        'MIDI access denied. Web MIDI requires user permission and HTTPS in production.'
      );
    });

    it('should handle NotSupportedError with descriptive message', async () => {
      const notSupportedError = new Error('Not supported');
      notSupportedError.name = 'NotSupportedError';
      mockNavigator.requestMIDIAccess.mockRejectedValue(notSupportedError);

      await expect(backend.initialize()).rejects.toThrow(
        'Web MIDI API not supported in this browser.'
      );
    });

    it('should handle generic errors with descriptive message', async () => {
      const genericError = new Error('Something went wrong');
      mockNavigator.requestMIDIAccess.mockRejectedValue(genericError);

      await expect(backend.initialize()).rejects.toThrow(
        'Failed to initialize Web MIDI API: Something went wrong'
      );
    });

    it('should set up state change handler', async () => {
      await backend.initialize();

      expect(mockMIDIAccess.onstatechange).toBeDefined();
      expect(typeof mockMIDIAccess.onstatechange).toBe('function');
    });
  });

  describe('getInputPorts', () => {
    beforeEach(async () => {
      await backend.initialize();
    });

    it('should return list of available input ports', async () => {
      const ports = await backend.getInputPorts();

      expect(ports).toHaveLength(2);
      expect(ports[0]).toEqual({
        id: 'input-1',
        name: 'Launch Control XL3',
        manufacturer: 'Mock Manufacturer',
        version: '1.0.0'
      });
      expect(ports[1]).toEqual({
        id: 'input-2',
        name: 'USB MIDI Device',
        manufacturer: 'Mock Manufacturer',
        version: '1.0.0'
      });
    });

    it('should handle ports without manufacturer/version', async () => {
      const portWithoutExtras = createMockMIDIInput('input-minimal', 'Minimal Port');
      delete portWithoutExtras.manufacturer;
      delete portWithoutExtras.version;

      mockMIDIAccess.inputs.clear();
      mockMIDIAccess.inputs.set('input-minimal', portWithoutExtras);

      const ports = await backend.getInputPorts();

      expect(ports).toHaveLength(1);
      expect(ports[0]).toEqual({
        id: 'input-minimal',
        name: 'Minimal Port'
      });
    });

    it('should handle unnamed ports with fallback names', async () => {
      const unnamedPort = createMockMIDIInput('input-unnamed');
      unnamedPort.name = '';

      mockMIDIAccess.inputs.clear();
      mockMIDIAccess.inputs.set('input-unnamed', unnamedPort);

      const ports = await backend.getInputPorts();

      expect(ports[0].name).toBe('Input input-unnamed');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedBackend = new WebMidiBackend();

      await expect(uninitializedBackend.getInputPorts()).rejects.toThrow(
        'Backend not initialized'
      );
    });
  });

  describe('getOutputPorts', () => {
    beforeEach(async () => {
      await backend.initialize();
    });

    it('should return list of available output ports', async () => {
      const ports = await backend.getOutputPorts();

      expect(ports).toHaveLength(2);
      expect(ports[0]).toEqual({
        id: 'output-1',
        name: 'Launch Control XL3',
        manufacturer: 'Mock Manufacturer',
        version: '1.0.0'
      });
      expect(ports[1]).toEqual({
        id: 'output-2',
        name: 'USB MIDI Device',
        manufacturer: 'Mock Manufacturer',
        version: '1.0.0'
      });
    });

    it('should throw error if not initialized', async () => {
      const uninitializedBackend = new WebMidiBackend();

      await expect(uninitializedBackend.getOutputPorts()).rejects.toThrow(
        'Backend not initialized'
      );
    });
  });

  describe('openInput', () => {
    beforeEach(async () => {
      await backend.initialize();
    });

    it('should open input port successfully', async () => {
      const port = await backend.openInput('input-1');

      expect(port).toEqual({
        id: 'input-1',
        name: 'Launch Control XL3',
        type: 'input',
        close: expect.any(Function),
        onMessage: undefined
      });

      const mockPort = mockMIDIAccess.inputs.get('input-1')!;
      expect(mockPort.open).toHaveBeenCalled();
    });

    it('should set up message handler', async () => {
      const port = await backend.openInput('input-1');
      const mockPort = mockMIDIAccess.inputs.get('input-1')!;

      // Set onMessage callback
      const messageHandler = vi.fn();
      port.onMessage = messageHandler;

      // Simulate incoming MIDI message
      const mockEvent: MockMIDIMessageEvent = {
        data: new Uint8Array([0x90, 0x40, 0x7F]),
        timeStamp: 12345
      };

      mockPort.onmidimessage!(mockEvent);

      expect(messageHandler).toHaveBeenCalledWith({
        timestamp: 12345,
        data: [0x90, 0x40, 0x7F]
      });
    });

    it('should handle message when no handler is set', async () => {
      const port = await backend.openInput('input-1');
      const mockPort = mockMIDIAccess.inputs.get('input-1')!;

      // Simulate incoming MIDI message without handler
      const mockEvent: MockMIDIMessageEvent = {
        data: new Uint8Array([0x90, 0x40, 0x7F]),
        timeStamp: 12345
      };

      // Should not throw error
      expect(() => mockPort.onmidimessage!(mockEvent)).not.toThrow();
    });

    it('should close port properly', async () => {
      const port = await backend.openInput('input-1');
      const mockPort = mockMIDIAccess.inputs.get('input-1')!;

      // Mock connection state as open so close() will be called
      mockPort.connection = 'open';

      await port.close();

      expect(mockPort.close).toHaveBeenCalled();
    });

    it('should throw error for non-existent port', async () => {
      await expect(backend.openInput('non-existent')).rejects.toThrow(
        'Input port not found: non-existent'
      );
    });

    it('should throw error if port.open() fails', async () => {
      const mockPort = mockMIDIAccess.inputs.get('input-1')!;
      const openError = new Error('Failed to open port');
      mockPort.open = vi.fn().mockRejectedValue(openError);

      await expect(backend.openInput('input-1')).rejects.toThrow(
        'Failed to open input port input-1: Failed to open port'
      );
    });

    it('should throw error if not initialized', async () => {
      const uninitializedBackend = new WebMidiBackend();

      await expect(uninitializedBackend.openInput('input-1')).rejects.toThrow(
        'Backend not initialized'
      );
    });
  });

  describe('openOutput', () => {
    beforeEach(async () => {
      await backend.initialize();
    });

    it('should open output port successfully', async () => {
      const port = await backend.openOutput('output-1');

      expect(port).toEqual({
        id: 'output-1',
        name: 'Launch Control XL3',
        type: 'output',
        close: expect.any(Function)
      });

      const mockPort = mockMIDIAccess.outputs.get('output-1')!;
      expect(mockPort.open).toHaveBeenCalled();
    });

    it('should close port properly', async () => {
      const port = await backend.openOutput('output-1');
      const mockPort = mockMIDIAccess.outputs.get('output-1')!;

      // Mock connection state as open so close() will be called
      mockPort.connection = 'open';

      await port.close();

      expect(mockPort.close).toHaveBeenCalled();
    });

    it('should throw error for non-existent port', async () => {
      await expect(backend.openOutput('non-existent')).rejects.toThrow(
        'Output port not found: non-existent'
      );
    });

    it('should throw error if port.open() fails', async () => {
      const mockPort = mockMIDIAccess.outputs.get('output-1')!;
      const openError = new Error('Failed to open port');
      mockPort.open = vi.fn().mockRejectedValue(openError);

      await expect(backend.openOutput('output-1')).rejects.toThrow(
        'Failed to open output port output-1: Failed to open port'
      );
    });

    it('should throw error if not initialized', async () => {
      const uninitializedBackend = new WebMidiBackend();

      await expect(uninitializedBackend.openOutput('output-1')).rejects.toThrow(
        'Backend not initialized'
      );
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      await backend.initialize();
    });

    it('should send MIDI message successfully', async () => {
      const port = await backend.openOutput('output-1');
      const mockPort = mockMIDIAccess.outputs.get('output-1')!;

      const message: MidiMessage = {
        data: [0x90, 0x40, 0x7F]
      };

      await backend.sendMessage(port, message);

      expect(mockPort.send).toHaveBeenCalledWith([0x90, 0x40, 0x7F]);
    });

    it('should send MIDI message with timestamp', async () => {
      const port = await backend.openOutput('output-1');
      const mockPort = mockMIDIAccess.outputs.get('output-1')!;

      const message: MidiMessage = {
        data: [0x90, 0x40, 0x7F],
        timestamp: 12345
      };

      await backend.sendMessage(port, message);

      expect(mockPort.send).toHaveBeenCalledWith([0x90, 0x40, 0x7F], 12345);
    });

    it('should send SysEx message successfully', async () => {
      const port = await backend.openOutput('output-1');
      const mockPort = mockMIDIAccess.outputs.get('output-1')!;

      const sysexMessage: MidiMessage = {
        data: [0xF0, 0x00, 0x20, 0x29, 0x11, 0x70, 0x00, 0xF7]
      };

      await backend.sendMessage(port, sysexMessage);

      expect(mockPort.send).toHaveBeenCalledWith([0xF0, 0x00, 0x20, 0x29, 0x11, 0x70, 0x00, 0xF7]);
    });

    it('should handle Uint8Array message data', async () => {
      const port = await backend.openOutput('output-1');
      const mockPort = mockMIDIAccess.outputs.get('output-1')!;

      const message: MidiMessage = {
        data: new Uint8Array([0x90, 0x40, 0x7F])
      };

      await backend.sendMessage(port, message);

      expect(mockPort.send).toHaveBeenCalledWith([0x90, 0x40, 0x7F]);
    });

    it('should throw error for unopened port', async () => {
      const port = {
        id: 'output-1',
        name: 'Launch Control XL3',
        type: 'output' as const,
        close: vi.fn()
      };

      const message: MidiMessage = {
        data: [0x90, 0x40, 0x7F]
      };

      await expect(backend.sendMessage(port, message)).rejects.toThrow(
        'Output port not open: output-1'
      );
    });

    it('should throw error if send() fails', async () => {
      const port = await backend.openOutput('output-1');
      const mockPort = mockMIDIAccess.outputs.get('output-1')!;
      const sendError = new Error('Send failed');
      mockPort.send = vi.fn().mockImplementation(() => {
        throw sendError;
      });

      const message: MidiMessage = {
        data: [0x90, 0x40, 0x7F]
      };

      await expect(backend.sendMessage(port, message)).rejects.toThrow(
        'Failed to send message to port output-1: Send failed'
      );
    });
  });

  describe('closePort', () => {
    beforeEach(async () => {
      await backend.initialize();
    });

    it('should close input port', async () => {
      const port = await backend.openInput('input-1');
      const mockPort = mockMIDIAccess.inputs.get('input-1')!;

      // Mock connection state as open so close() will be called
      mockPort.connection = 'open';

      await backend.closePort(port);

      expect(mockPort.close).toHaveBeenCalled();
    });

    it('should close output port', async () => {
      const port = await backend.openOutput('output-1');
      const mockPort = mockMIDIAccess.outputs.get('output-1')!;

      // Mock connection state as open so close() will be called
      mockPort.connection = 'open';

      await backend.closePort(port);

      expect(mockPort.close).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await backend.initialize();
    });

    it('should close all open ports and reset state', async () => {
      // Open some ports
      const inputPort = await backend.openInput('input-1');
      const outputPort = await backend.openOutput('output-1');

      const mockInputPort = mockMIDIAccess.inputs.get('input-1')!;
      const mockOutputPort = mockMIDIAccess.outputs.get('output-1')!;

      // Mock connection state
      mockInputPort.connection = 'open';
      mockOutputPort.connection = 'open';

      await backend.cleanup();

      expect(mockInputPort.close).toHaveBeenCalled();
      expect(mockOutputPort.close).toHaveBeenCalled();
      expect(mockMIDIAccess.onstatechange).toBeNull();
    });

    it('should handle port close errors gracefully', async () => {
      const inputPort = await backend.openInput('input-1');
      const mockInputPort = mockMIDIAccess.inputs.get('input-1')!;

      // Mock close to throw error
      mockInputPort.close = vi.fn().mockRejectedValue(new Error('Close failed'));
      mockInputPort.connection = 'open';

      // Should not throw error
      await expect(backend.cleanup()).resolves.not.toThrow();
    });

    it('should skip closing already closed ports', async () => {
      const inputPort = await backend.openInput('input-1');
      const mockInputPort = mockMIDIAccess.inputs.get('input-1')!;

      // Mock port as already closed
      mockInputPort.connection = 'closed';
      const closeSpy = vi.spyOn(mockInputPort, 'close');

      await backend.cleanup();

      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('should reset initialization state', async () => {
      await backend.cleanup();

      // Should be able to initialize again
      await expect(backend.initialize()).resolves.not.toThrow();
      expect(mockNavigator.requestMIDIAccess).toHaveBeenCalledTimes(2);
    });
  });

  describe('isSysExEnabled', () => {
    it('should return true when SysEx is enabled', async () => {
      mockMIDIAccess.sysexEnabled = true;
      await backend.initialize();

      expect(backend.isSysExEnabled()).toBe(true);
    });

    it('should return false when SysEx is disabled', async () => {
      mockMIDIAccess.sysexEnabled = false;
      await backend.initialize();

      expect(backend.isSysExEnabled()).toBe(false);
    });

    it('should return false when not initialized', () => {
      expect(backend.isSysExEnabled()).toBe(false);
    });
  });

  describe('state change events', () => {
    beforeEach(async () => {
      await backend.initialize();
    });

    it('should handle port state changes', () => {
      const mockPort = createMockMIDIInput('test-port', 'Test Port');
      const stateChangeEvent: MockMIDIConnectionEvent = {
        port: mockPort
      };

      // Mock console.debug to verify it's called
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // Trigger state change
      mockMIDIAccess.onstatechange!(stateChangeEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        'MIDI port state changed:',
        'Test Port',
        'connected'
      );

      consoleSpy.mockRestore();
    });

    it('should handle state change with undefined port', () => {
      const stateChangeEvent = {} as MockMIDIConnectionEvent;

      // Should not throw error
      expect(() => {
        mockMIDIAccess.onstatechange!(stateChangeEvent);
      }).not.toThrow();
    });
  });
});