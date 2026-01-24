/**
 * MIDI core module exports
 */

export * from './types';
export * from './WebMidiAdapter';
export * from './S330Client';

/**
 * Diagnostic function for testing Web MIDI in the browser console.
 *
 * Usage: Open browser console and run:
 *   await window.testS330Midi()
 *
 * This will:
 * 1. List available MIDI ports
 * 2. Connect to the first available input/output
 * 3. Send a simple identity request
 * 4. Log all incoming MIDI messages for 5 seconds
 */
export async function testS330MidiDiagnostic(): Promise<void> {
  console.log('=== S-330 MIDI Diagnostic ===');

  if (!navigator.requestMIDIAccess) {
    console.error('Web MIDI API not available');
    return;
  }

  const access = await navigator.requestMIDIAccess({ sysex: true });
  console.log('MIDI access granted, sysex:', access.sysexEnabled);

  console.log('\n--- Available Ports ---');
  console.log('Inputs:');
  access.inputs.forEach((port) => {
    console.log(`  [${port.id}] ${port.name} (${port.state})`);
  });
  console.log('Outputs:');
  access.outputs.forEach((port) => {
    console.log(`  [${port.id}] ${port.name} (${port.state})`);
  });

  // Find Volt 4 or first available port
  let input: MIDIInput | undefined;
  let output: MIDIOutput | undefined;

  access.inputs.forEach((port) => {
    if (!input && (port.name?.includes('Volt') || !input)) {
      input = port;
    }
  });
  access.outputs.forEach((port) => {
    if (!output && (port.name?.includes('Volt') || !output)) {
      output = port;
    }
  });

  if (!input || !output) {
    console.error('No MIDI ports found');
    return;
  }

  console.log(`\nUsing: ${input.name} / ${output.name}`);

  await input.open();
  await output.open();

  console.log('Ports opened');

  // Set up listener for ALL incoming messages
  const messageHandler = (e: MIDIMessageEvent) => {
    if (!e.data) return;
    const data = Array.from(e.data);
    const hex = data.map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`[RX] ${hex}`);
  };

  input.addEventListener('midimessage', messageHandler);
  console.log('Listener registered');

  // Send RQD for patch 0 name (8 bytes)
  // Address: 00 01 00 00, Size: 16 nibbles (8 bytes)
  const checksum = (128 - (0x00 + 0x01 + 0x00 + 0x00 + 0x00 + 0x00 + 0x00 + 0x10) % 128) % 128;
  const rqd = [
    0xF0, 0x41, 0x00, 0x1E, 0x41, // Header: SysEx, Roland, Device 0, S-330, RQD
    0x00, 0x01, 0x00, 0x00,       // Address: Patch 0
    0x00, 0x00, 0x00, 0x10,       // Size: 16 nibbles = 8 bytes
    checksum, 0xF7
  ];

  console.log('\nSending RQD for patch 0 name:');
  console.log('[TX]', rqd.map(b => b.toString(16).padStart(2, '0')).join(' '));
  output.send(new Uint8Array(rqd));

  console.log('\nListening for responses for 5 seconds...');

  await new Promise(resolve => setTimeout(resolve, 5000));

  input.removeEventListener('midimessage', messageHandler);
  console.log('\n=== Diagnostic complete ===');
}

// Expose on window for console access
if (typeof window !== 'undefined') {
  (window as unknown as { testS330Midi: typeof testS330MidiDiagnostic }).testS330Midi = testS330MidiDiagnostic;
}
