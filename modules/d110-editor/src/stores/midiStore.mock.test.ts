import { beforeEach, describe, expect, it, vi } from 'vitest';

class LocalStorageMock {
  private readonly store = new Map<string, string>();

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

describe('D-110 MIDI store mock mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', {
      value: new LocalStorageMock(),
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '?midi=mock' } },
      configurable: true,
    });
  });

  it('auto-connects deterministically in mock mode', async () => {
    const { useMidiStore } = await import('./midiStore');
    await useMidiStore.getState().initialize();

    const state = useMidiStore.getState();
    expect(state.status).toBe('connected');
    expect(state.selectedInputId).toBe('d110-mock-in');
    expect(state.selectedOutputId).toBe('d110-mock-out');
    expect(state.client).toBeTruthy();
  });
});
