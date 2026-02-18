import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntimeMidiTransport, isMockMidiMode } from './runtimeTransport';

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

describe('runtimeTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'localStorage', {
      value: new LocalStorageMock(),
      configurable: true,
    });
  });

  it('detects mock mode from query params', () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '?midi=mock' } },
      configurable: true,
    });
    expect(isMockMidiMode()).toBe(true);
  });

  it('defaults to web transport when mock mode is not active', () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '' } },
      configurable: true,
    });
    const result = createRuntimeMidiTransport({
      deviceName: 's330',
      mock: {
        inputs: [{ id: 'mock-in', name: 'Mock In', state: 'connected' }],
        outputs: [{ id: 'mock-out', name: 'Mock Out', state: 'connected' }],
      },
    });
    expect(result.mode).toBe('web');
  });

  it('creates mock transport and seeds localStorage when mock mode is active', () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '?midi=mock' } },
      configurable: true,
    });
    const result = createRuntimeMidiTransport({
      deviceName: 's330',
      mock: {
        inputs: [{ id: 's330-mock-in', name: 'Mock S-330 In', state: 'connected' }],
        outputs: [{ id: 's330-mock-out', name: 'Mock S-330 Out', state: 'connected' }],
      },
    });
    expect(result.mode).toBe('mock');
    expect(localStorage.getItem('s330-midi-input')).toBe('s330-mock-in');
    expect(localStorage.getItem('s330-midi-output')).toBe('s330-mock-out');
  });

  it('supports explicit mock enable without query params', () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '' } },
      configurable: true,
    });
    const result = createRuntimeMidiTransport({
      deviceName: 'jv1080',
      mock: {
        enabled: true,
        inputs: [{ id: 'jv-mock-in', name: 'Mock JV In', state: 'connected' }],
        outputs: [{ id: 'jv-mock-out', name: 'Mock JV Out', state: 'connected' }],
      },
    });
    expect(result.mode).toBe('mock');
  });
});
