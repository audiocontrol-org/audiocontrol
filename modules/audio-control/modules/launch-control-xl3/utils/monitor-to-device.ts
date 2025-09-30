#!/usr/bin/env npx tsx
/**
 * Monitor MIDI messages being sent TO the device through JUCE server
 * This captures what the library is actually sending to identify garbage messages
 */

import { exec } from 'child_process';

// Monitor JUCE server directly with verbose logging
async function monitorJuceServer() {
  console.log('🎹 Monitoring MIDI messages TO device (via JUCE server)...\n');

  // Create a test script that sends messages to see what appears
  const testScript = `
    import { JuceMidiBackend } from '../src/backends/JuceMidiBackend.js';
    import { MidiInterface } from '../src/core/MidiInterface.js';

    async function test() {
      const backend = new JuceMidiBackend({ host: 'localhost', port: 7777 });
      const midi = new MidiInterface(backend);

      await midi.initialize();
      await midi.openOutput('LCXL3 1 MIDI In');

      // Send a simple SysEx
      const testSysEx = [
        0xF0,  // Start
        0x00, 0x20, 0x29, // Novation manufacturer ID
        0x02, 0x15,       // Device/model
        0x01,             // Simple test byte
        0xF7              // End
      ];

      console.log('Sending SysEx:', testSysEx.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      await midi.sendMessage(testSysEx);

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      await midi.close();
    }

    test().catch(console.error);
  `;

  // Write and run the test script
  const fs = await import('fs/promises');
  await fs.writeFile('/tmp/test-send.ts', testScript);

  // Run it and capture output
  exec('cd /Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3 && npx tsx /tmp/test-send.ts',
    (error, stdout, stderr) => {
      console.log('Test script output:');
      console.log(stdout);
      if (stderr) console.error('Errors:', stderr);
      if (error) console.error('Exec error:', error);
    });
}

// Also monitor with curl to see raw HTTP traffic
async function monitorHttpTraffic() {
  console.log('\n🌐 Monitoring HTTP traffic to JUCE server...\n');

  // Send a test message and capture with verbose curl
  exec(`curl -v -X POST http://localhost:7777/send -H "Content-Type: application/json" -d '{"port": "LCXL3 1 MIDI In", "message": [240, 0, 32, 41, 2, 21, 1, 247]}' 2>&1`,
    (error, stdout, stderr) => {
      console.log('HTTP Response:');
      console.log(stdout);
    });
}

// Run both monitors
Promise.all([
  monitorJuceServer(),
  new Promise(resolve => setTimeout(resolve, 1000)).then(() => monitorHttpTraffic())
]).catch(console.error);