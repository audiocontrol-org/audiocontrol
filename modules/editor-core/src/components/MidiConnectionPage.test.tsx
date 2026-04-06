import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MidiConnectionPage, type MidiConnectionPageConfig, type MidiConnectionPageStore } from './MidiConnectionPage';

const baseConfig: MidiConnectionPageConfig = {
  deviceName: 'Test Device',
  inputLabel: 'Input',
  outputLabel: 'Output',
  deviceIdLabel: 'Device ID',
  deviceIdHelpText: 'Help text',
  continueLabel: 'Continue',
  helpItems: ['Help item'],
};

const baseStore: MidiConnectionPageStore = {
  isSupported: true,
  browserInfo: { browser: 'Chrome', notes: 'ok' },
  sysExEnabled: true,
  status: 'disconnected',
  error: null,
  inputs: [{ id: 'in-1', name: 'Input 1', state: 'connected' }],
  outputs: [{ id: 'out-1', name: 'Output 1', state: 'connected' }],
  selectedInputId: 'in-1',
  selectedOutputId: 'out-1',
  deviceId: 5,
  setSelectedInputId: vi.fn(),
  setSelectedOutputId: vi.fn(),
  setDeviceId: vi.fn(),
  refresh: vi.fn(async () => undefined),
  reconnect: vi.fn(async () => undefined),
  connect: vi.fn(async () => undefined),
  disconnect: vi.fn(async () => undefined),
};

describe('MidiConnectionPage', () => {
  it('renders unsupported browser with transport selector', () => {
    const html = renderToStaticMarkup(
      <MidiConnectionPage
        config={baseConfig}
        store={{ ...baseStore, isSupported: false }}
        deviceIdRange={{ min: 0, max: 127 }}
        onContinue={() => undefined}
      />
    );

    expect(html).toContain('Connect to Test Device');
    expect(html).toContain('not available in Chrome');
    expect(html).toContain('MIDI Transport');
  });

  it('renders secure-context warning with transport selector', () => {
    const html = renderToStaticMarkup(
      <MidiConnectionPage
        config={{
          ...baseConfig,
          secureContextTitle: 'Secure Context Needed',
        }}
        store={{
          ...baseStore,
          isSupported: false,
          browserInfo: { browser: 'Chrome', notes: 'secure', requiresSecureContext: true },
        }}
        deviceIdRange={{ min: 0, max: 127 }}
        onContinue={() => undefined}
      />
    );

    expect(html).toContain('Secure Context Needed');
    expect(html).toContain('MIDI Transport');
  });

  it('renders connect flow and device range', () => {
    const html = renderToStaticMarkup(
      <MidiConnectionPage
        config={baseConfig}
        store={baseStore}
        deviceIdRange={{ min: 0, max: 127 }}
        onContinue={() => undefined}
      />
    );

    expect(html).toContain('Connect to Test Device');
    expect(html).toContain('Connect');
    expect(html).toContain('(0-127)');
  });

  it('renders continue button when connected', () => {
    const html = renderToStaticMarkup(
      <MidiConnectionPage
        config={baseConfig}
        store={{ ...baseStore, status: 'connected' }}
        deviceIdRange={{ min: 0, max: 127 }}
        onContinue={() => undefined}
      />
    );

    expect(html).toContain('Disconnect');
    expect(html).toContain('Continue');
  });
});
