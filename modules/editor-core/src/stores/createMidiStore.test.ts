import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMidiStore } from './createMidiStore';
import type { MidiTransport } from '../transports';

const mockIsWebMidiSupported = vi.hoisted(() => vi.fn());
const mockGetBrowserCompatibility = vi.hoisted(() => vi.fn());
const mockRequestMidiAccess = vi.hoisted(() => vi.fn());
const mockCreateWebMidiAdapter = vi.hoisted(() => vi.fn());

vi.mock('@audiocontrol/shared-midi', () => ({
  isWebMidiSupported: mockIsWebMidiSupported,
  getBrowserCompatibility: mockGetBrowserCompatibility,
  requestMidiAccess: mockRequestMidiAccess,
  createWebMidiAdapter: mockCreateWebMidiAdapter,
}));

class LocalStorageMock {
  private readonly store = new Map<string, string>();

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

function createMidiInput(id: string): MIDIInput {
  return {
    id,
    type: 'input',
    name: `Input ${id}`,
    manufacturer: 'AC',
    state: 'connected',
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MIDIInput;
}

function createMidiOutput(id: string): MIDIOutput {
  return {
    id,
    type: 'output',
    name: `Output ${id}`,
    manufacturer: 'AC',
    state: 'connected',
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
  } as unknown as MIDIOutput;
}

function createMidiAccess(input: MIDIInput, output: MIDIOutput): MIDIAccess {
  return {
    inputs: new Map([[input.id, input]]),
    outputs: new Map([[output.id, output]]),
    sysexEnabled: true,
    onstatechange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MIDIAccess;
}

describe('createMidiStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(globalThis, 'localStorage', {
      value: new LocalStorageMock(),
      configurable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        requestMIDIAccess: vi.fn(),
        userAgent: 'Chrome',
      },
      configurable: true,
    });

    mockGetBrowserCompatibility.mockReturnValue({
      supported: true,
      browser: 'Chrome',
      notes: 'Full support with SysEx',
    });
  });

  it('sets error state when Web MIDI is not supported', async () => {
    mockIsWebMidiSupported.mockReturnValue(false);

    const useStore = createMidiStore({
      deviceName: 'test-device',
      defaultDeviceId: 4,
      deviceIdRange: { min: 0, max: 16 },
    });

    await useStore.getState().initialize();

    const state = useStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toContain('Web MIDI API not supported');
  });

  it('initializes and auto-connects using stored ports', async () => {
    mockIsWebMidiSupported.mockReturnValue(true);

    localStorage.setItem('test-device-midi-input', 'in-1');
    localStorage.setItem('test-device-midi-output', 'out-1');
    localStorage.setItem('test-device-device-id', '7');

    const input = createMidiInput('in-1');
    const output = createMidiOutput('out-1');
    const access = createMidiAccess(input, output);

    mockRequestMidiAccess.mockResolvedValue({
      inputs: [{ id: 'in-1', name: 'Input in-1', manufacturer: 'AC', state: 'connected' }],
      outputs: [{ id: 'out-1', name: 'Output out-1', manufacturer: 'AC', state: 'connected' }],
      sysExEnabled: true,
    });
    vi.mocked(navigator.requestMIDIAccess).mockResolvedValue(access);

    const adapter = {
      send: vi.fn(),
      onSysEx: vi.fn(),
      removeSysExListener: vi.fn(),
    };
    mockCreateWebMidiAdapter.mockReturnValue(adapter);

    const useStore = createMidiStore({
      deviceName: 'test-device',
      defaultDeviceId: 0,
      deviceIdRange: { min: 0, max: 16 },
    });

    await useStore.getState().initialize();

    const state = useStore.getState();
    expect(state.deviceId).toBe(7);
    expect(state.status).toBe('connected');
    expect(state.selectedInputId).toBe('in-1');
    expect(state.selectedOutputId).toBe('out-1');
    expect(state.adapter).toBe(adapter);
  });

  it('creates and destroys client, sends panic, and disconnects', async () => {
    mockIsWebMidiSupported.mockReturnValue(true);

    const input = createMidiInput('in-2');
    const output = createMidiOutput('out-2');
    const access = createMidiAccess(input, output);
    mockRequestMidiAccess.mockResolvedValue({
      inputs: [{ id: 'in-2', name: 'Input in-2', manufacturer: 'AC', state: 'connected' }],
      outputs: [{ id: 'out-2', name: 'Output out-2', manufacturer: 'AC', state: 'connected' }],
      sysExEnabled: true,
    });
    vi.mocked(navigator.requestMIDIAccess).mockResolvedValue(access);

    const send = vi.fn();
    const adapter = {
      send,
      onSysEx: vi.fn(),
      removeSysExListener: vi.fn(),
    };
    mockCreateWebMidiAdapter.mockReturnValue(adapter);

    const destroyClient = vi.fn();
    const createClient = vi.fn().mockImplementation((_, deviceId: number) => ({ deviceId }));

    const useStore = createMidiStore({
      deviceName: 'test-device',
      defaultDeviceId: 3,
      deviceIdRange: { min: 0, max: 16 },
      createClient,
      destroyClient,
    });

    await useStore.getState().initialize();
    await useStore.getState().connect('in-2', 'out-2');
    useStore.getState().sendPanic();
    await useStore.getState().disconnect();

    expect(createClient).toHaveBeenCalledWith(adapter, 3);
    expect(send).toHaveBeenCalledTimes(32);
    expect(destroyClient).toHaveBeenCalledTimes(1);
    expect(useStore.getState().status).toBe('disconnected');
    expect(useStore.getState().client).toBeNull();
  });

  it('recreates client when device ID changes in range', async () => {
    mockIsWebMidiSupported.mockReturnValue(true);

    const input = createMidiInput('in-3');
    const output = createMidiOutput('out-3');
    const access = createMidiAccess(input, output);
    mockRequestMidiAccess.mockResolvedValue({
      inputs: [{ id: 'in-3', name: 'Input in-3', manufacturer: 'AC', state: 'connected' }],
      outputs: [{ id: 'out-3', name: 'Output out-3', manufacturer: 'AC', state: 'connected' }],
      sysExEnabled: true,
    });
    vi.mocked(navigator.requestMIDIAccess).mockResolvedValue(access);

    const adapter = {
      send: vi.fn(),
      onSysEx: vi.fn(),
      removeSysExListener: vi.fn(),
    };
    mockCreateWebMidiAdapter.mockReturnValue(adapter);

    const destroyClient = vi.fn();
    const createClient = vi.fn().mockImplementation((_, deviceId: number) => ({ deviceId }));

    const useStore = createMidiStore({
      deviceName: 'test-device',
      defaultDeviceId: 1,
      deviceIdRange: { min: 1, max: 4 },
      createClient,
      destroyClient,
    });

    await useStore.getState().initialize();
    await useStore.getState().connect('in-3', 'out-3');

    useStore.getState().setDeviceId(0);
    expect(useStore.getState().deviceId).toBe(1);

    useStore.getState().setDeviceId(4);
    expect(useStore.getState().deviceId).toBe(4);
    expect(useStore.getState().client).toEqual({ deviceId: 4 });
    expect(destroyClient).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('test-device-device-id')).toBe('4');
  });

  it('supports injected transport implementations', async () => {
    const adapter = {
      send: vi.fn(),
      onSysEx: vi.fn(),
      removeSysExListener: vi.fn(),
    };
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const onStateChange = vi.fn();
    const initialize = vi.fn().mockResolvedValue({
      inputs: [{ id: 'mock-in', name: 'Mock Input', state: 'connected' }],
      outputs: [{ id: 'mock-out', name: 'Mock Output', state: 'connected' }],
      sysExEnabled: true,
    });
    const refresh = vi.fn().mockResolvedValue({
      inputs: [{ id: 'mock-in', name: 'Mock Input', state: 'connected' }],
      outputs: [{ id: 'mock-out', name: 'Mock Output', state: 'connected' }],
      sysExEnabled: true,
    });
    const connect = vi.fn().mockResolvedValue({
      adapter,
      inputInfo: { id: 'mock-in', name: 'Mock Input', state: 'connected' },
      outputInfo: { id: 'mock-out', name: 'Mock Output', state: 'connected' },
      disconnect,
    });

    const transport: MidiTransport = {
      kind: 'mock-test',
      isSupported: () => true,
      getBrowserInfo: () => ({ supported: true, browser: 'Mock', notes: 'Test transport' }),
      initialize,
      refresh,
      onStateChange,
      connect,
    };

    const useStore = createMidiStore({
      deviceName: 'test-device',
      defaultDeviceId: 0,
      deviceIdRange: { min: 0, max: 16 },
      transport,
    });

    await useStore.getState().initialize();
    await useStore.getState().connect('mock-in', 'mock-out');
    await useStore.getState().disconnect();

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith('mock-in', 'mock-out');
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(useStore.getState().status).toBe('disconnected');
  });
});
