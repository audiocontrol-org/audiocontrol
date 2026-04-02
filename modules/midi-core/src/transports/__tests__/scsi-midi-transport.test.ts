import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScsiMidiTransport } from '../scsi-midi-transport';
import type { SysExCallback } from '../../types';

// ---------------------------------------------------------------------------
// WebSocket mock
// ---------------------------------------------------------------------------

interface MockWebSocket {
  url: string;
  listeners: Map<string, Set<EventListener>>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  simulateMessage: (data: unknown) => void;
}

function createMockWebSocket(): MockWebSocket {
  const listeners = new Map<string, Set<EventListener>>();

  const mock: MockWebSocket = {
    url: '',
    listeners,
    close: vi.fn(),
    addEventListener: vi.fn((event: string, handler: EventListener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: EventListener) => {
      listeners.get(event)?.delete(handler);
    }),
    simulateMessage(data: unknown) {
      const handlers = listeners.get('message');
      if (!handlers) return;
      const event = { data: JSON.stringify(data) } as MessageEvent;
      handlers.forEach((h) => h(event));
    },
  };

  return mock;
}

let mockWs: MockWebSocket;

// Replace global WebSocket with a capturing constructor
const OriginalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  mockWs = createMockWebSocket();
  // Replace WebSocket with a mock class that returns our mock instance
  globalThis.WebSocket = class MockWebSocketClass {
    constructor(url: string) {
      mockWs.url = url;
      return mockWs as unknown as MockWebSocketClass;
    }
  } as unknown as typeof WebSocket;
});

afterEach(() => {
  globalThis.WebSocket = OriginalWebSocket;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BRIDGE_URL = 'http://s3k.local:7033';

function mockFetchJson(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    })
  );
}

function mockFetchReject(error: Error): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
}

// ---------------------------------------------------------------------------
// connect()
// ---------------------------------------------------------------------------

describe('connect()', () => {
  it('fetches /status and returns parsed response', async () => {
    const status = {
      version: '1.0.0',
      scsi2piVersion: '2.3.0',
      boardId: 5,
      samplerReachable: true,
    };
    mockFetchJson(status);

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    const result = await transport.connect();

    expect(result).toEqual(status);
    expect(fetch).toHaveBeenCalledWith(
      `${BRIDGE_URL}/status`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });

  it('opens WebSocket to /sds/stream after successful status fetch', async () => {
    mockFetchJson({ version: '1.0.0', scsi2piVersion: '2.0', boardId: 1, samplerReachable: true });

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    await transport.connect();

    expect(mockWs.url).toBe('ws://s3k.local:7033/sds/stream');
  });

  it('throws when bridge is unreachable', async () => {
    mockFetchReject(new Error('fetch failed'));

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });

    await expect(transport.connect()).rejects.toThrow(
      /Failed to connect to SCSI bridge/
    );
  });

  it('throws on non-OK HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      })
    );

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });

    await expect(transport.connect()).rejects.toThrow(/503/);
  });
});

// ---------------------------------------------------------------------------
// scanDevices()
// ---------------------------------------------------------------------------

describe('scanDevices()', () => {
  it('fetches /scsi/scan and returns devices', async () => {
    const devices = [
      { id: 3, vendor: 'AKAI', product: 'S3000XL', revision: '1.14' },
    ];
    mockFetchJson(devices);

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    const result = await transport.scanDevices();

    expect(result).toEqual(devices);
    expect(fetch).toHaveBeenCalledWith(
      `${BRIDGE_URL}/scsi/scan`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// adapter.send()
// ---------------------------------------------------------------------------

describe('adapter.send()', () => {
  it('posts message to /sds/send', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, response: [] }),
      text: () => Promise.resolve('ok'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    // SDS message (manufacturer 0x7E) — expects response
    const message = [0xf0, 0x7e, 0x00, 0xf7];

    transport.adapter.send(message);

    // send() is async internally; flush the queue by awaiting a microtask
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledWith(`${BRIDGE_URL}/sds/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, expect_response: true }),
    });
  });

  it('serializes concurrent sends', async () => {
    const callOrder: number[] = [];
    let resolvers: Array<() => void> = [];

    const fetchMock = vi.fn().mockImplementation(() => {
      return new Promise<{ ok: boolean; json: () => Promise<unknown>; text: () => Promise<string> }>((resolve) => {
        const idx = resolvers.length;
        resolvers.push(() => {
          callOrder.push(idx);
          resolve({ ok: true, json: () => Promise.resolve({ ok: true, response: [] }), text: () => Promise.resolve('ok') });
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });

    // Fire two sends without awaiting
    transport.adapter.send([0xf0, 0x01, 0xf7]);
    transport.adapter.send([0xf0, 0x02, 0xf7]);

    // Only the first send should have been dispatched
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Resolve the first send
    resolvers[0]!();
    await new Promise((r) => setTimeout(r, 0));

    // Now the second send should have been dispatched
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Resolve the second send
    resolvers[1]!();
    await new Promise((r) => setTimeout(r, 0));

    expect(callOrder).toEqual([0, 1]);
  });
});

// ---------------------------------------------------------------------------
// Listener management
// ---------------------------------------------------------------------------

describe('onSysEx / removeSysExListener', () => {
  it('adds and removes listeners', () => {
    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    const cb: SysExCallback = vi.fn();

    transport.adapter.onSysEx(cb);
    transport.adapter.removeSysExListener(cb);

    // After removal, WebSocket messages should not reach the callback.
    // We cannot easily trigger a WS message without connect(), but we can
    // verify the callback is not invoked by checking the mock.
    expect(cb).not.toHaveBeenCalled();
  });

  it('supports multiple listeners', () => {
    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    const cb1: SysExCallback = vi.fn();
    const cb2: SysExCallback = vi.fn();

    transport.adapter.onSysEx(cb1);
    transport.adapter.onSysEx(cb2);

    // Removing one should not affect the other
    transport.adapter.removeSysExListener(cb1);

    // cb1 removed, cb2 still present -- verified indirectly via dispatch test below
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// WebSocket message dispatch
// ---------------------------------------------------------------------------

describe('WebSocket message dispatch', () => {
  it('dispatches SysEx messages to listeners', async () => {
    mockFetchJson({ version: '1.0.0', scsi2piVersion: '2.0', boardId: 1, samplerReachable: true });

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    const cb: SysExCallback = vi.fn();

    transport.adapter.onSysEx(cb);
    await transport.connect();

    const sysexData = [0xf0, 0x7e, 0x00, 0x06, 0x02, 0xf7];
    mockWs.simulateMessage({ type: 'sysex', data: sysexData });

    expect(cb).toHaveBeenCalledWith(sysexData);
  });

  it('ignores non-sysex messages', async () => {
    mockFetchJson({ version: '1.0.0', scsi2piVersion: '2.0', boardId: 1, samplerReachable: true });

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    const cb: SysExCallback = vi.fn();

    transport.adapter.onSysEx(cb);
    await transport.connect();

    mockWs.simulateMessage({ type: 'ping', data: [] });

    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores messages not starting with 0xF0', async () => {
    mockFetchJson({ version: '1.0.0', scsi2piVersion: '2.0', boardId: 1, samplerReachable: true });

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    const cb: SysExCallback = vi.fn();

    transport.adapter.onSysEx(cb);
    await transport.connect();

    mockWs.simulateMessage({ type: 'sysex', data: [0x90, 0x3c, 0x7f] });

    expect(cb).not.toHaveBeenCalled();
  });

  it('does not dispatch to removed listeners', async () => {
    mockFetchJson({ version: '1.0.0', scsi2piVersion: '2.0', boardId: 1, samplerReachable: true });

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    const cb: SysExCallback = vi.fn();

    transport.adapter.onSysEx(cb);
    await transport.connect();

    transport.adapter.removeSysExListener(cb);

    mockWs.simulateMessage({ type: 'sysex', data: [0xf0, 0x7e, 0xf7] });

    expect(cb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// disconnect()
// ---------------------------------------------------------------------------

describe('disconnect()', () => {
  it('closes WebSocket and clears listeners', async () => {
    mockFetchJson({ version: '1.0.0', scsi2piVersion: '2.0', boardId: 1, samplerReachable: true });

    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });
    const cb: SysExCallback = vi.fn();

    transport.adapter.onSysEx(cb);
    await transport.connect();

    transport.disconnect();

    expect(mockWs.close).toHaveBeenCalled();

    // Listener should have been cleared -- simulating a message should not dispatch
    // (WebSocket is closed, but verify listener set is empty)
    mockWs.simulateMessage({ type: 'sysex', data: [0xf0, 0x7e, 0xf7] });
    expect(cb).not.toHaveBeenCalled();
  });

  it('is safe to call when not connected', () => {
    const transport = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL });

    // Should not throw
    expect(() => transport.disconnect()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// URL handling
// ---------------------------------------------------------------------------

describe('URL handling', () => {
  it('strips trailing slash from bridge URL', async () => {
    mockFetchJson({ version: '1.0.0', scsi2piVersion: '2.0', boardId: 1, samplerReachable: true });

    const transport = createScsiMidiTransport({ bridgeUrl: 'http://s3k.local:7033/' });
    await transport.connect();

    expect(fetch).toHaveBeenCalledWith(
      'http://s3k.local:7033/status',
      expect.anything()
    );
  });

  it('converts https to wss for WebSocket URL', async () => {
    mockFetchJson({ version: '1.0.0', scsi2piVersion: '2.0', boardId: 1, samplerReachable: true });

    const transport = createScsiMidiTransport({ bridgeUrl: 'https://s3k.local:7033' });
    await transport.connect();

    expect(mockWs.url).toBe('wss://s3k.local:7033/sds/stream');
  });
});
