#!/usr/bin/env npx tsx

/**
 * Test slot selection using WebMidi in headless browser via Playwright
 * This avoids the EasyMidi backend crash with multiple ports
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function testWebMidiSlotSelection() {
  console.log('WebMidi Slot Selection Test');
  console.log('============================\n');

  const browser = await chromium.launch({
    headless: false, // Need non-headless for MIDI permissions
    args: ['--enable-web-midi']
  });

  const context = await browser.newContext({
    permissions: ['midi', 'midi-sysex']
  });

  const page = await context.newPage();

  // Create an HTML page with WebMidi test code
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>MIDI Test</title>
</head>
<body>
  <h1>WebMidi Slot Selection Test</h1>
  <pre id="log"></pre>
  <script>
    const log = document.getElementById('log');
    function addLog(msg) {
      console.log(msg);
      log.textContent += msg + '\\n';
    }

    async function runTest() {
      try {
        addLog('Requesting MIDI access with sysex...');
        const midi = await navigator.requestMIDIAccess({ sysex: true });

        addLog('\\nAvailable MIDI ports:');

        // List outputs
        let midiOutput = null;
        let dawOutput = null;
        let dawInput = null;

        for (const [id, output] of midi.outputs) {
          addLog(\`Output: \${output.name} (id: \${id})\`);
          if (output.name.includes('LCXL3 1 MIDI In')) {
            midiOutput = output;
          }
          if (output.name.includes('LCXL3 1 DAW In')) {
            dawOutput = output;
          }
        }

        // List inputs
        for (const [id, input] of midi.inputs) {
          addLog(\`Input: \${input.name} (id: \${id})\`);
          if (input.name.includes('LCXL3 1 DAW Out')) {
            dawInput = input;
          }
        }

        if (!midiOutput || !dawOutput || !dawInput) {
          addLog('\\nError: Required ports not found!');
          addLog(\`MIDI: \${midiOutput ? 'Found' : 'Missing'}\`);
          addLog(\`DAW Out: \${dawOutput ? 'Found' : 'Missing'}\`);
          addLog(\`DAW In: \${dawInput ? 'Found' : 'Missing'}\`);
          return;
        }

        addLog('\\n✓ Found all required ports');

        // Set up DAW input listener for responses
        dawInput.onmidimessage = (event) => {
          const bytes = Array.from(event.data).map(b => b.toString(16).padStart(2, '0').toUpperCase());
          addLog(\`[DAW Response] \${bytes.join(' ')}\`);
        };

        // Test slot selection protocol
        addLog('\\n=== Testing Slot 0 Selection ===');

        // Phase 1: Query current slot
        addLog('Phase 1: Querying current slot...');
        dawOutput.send([0x9F, 11, 127]); // Note On ch16
        await new Promise(r => setTimeout(r, 10));
        dawOutput.send([0xB7, 30, 0]); // CC ch8 query
        await new Promise(r => setTimeout(r, 50)); // Wait for response
        dawOutput.send([0x9F, 11, 0]); // Note Off ch16

        await new Promise(r => setTimeout(r, 100));

        // Phase 2: Set slot 0 (CC value 6)
        addLog('Phase 2: Setting slot 0 (CC value 6)...');
        dawOutput.send([0x9F, 11, 127]); // Note On ch16
        await new Promise(r => setTimeout(r, 10));
        dawOutput.send([0xB6, 30, 6]); // CC ch7, value 6 for slot 0
        await new Promise(r => setTimeout(r, 10));
        dawOutput.send([0x9F, 11, 0]); // Note Off ch16

        await new Promise(r => setTimeout(r, 100));

        // Send a test SysEx write with new encoding
        addLog('\\n=== Sending Test SysEx Write ===');
        const testSysEx = [
          0xF0, // SysEx start
          0x00, 0x20, 0x29, // Novation manufacturer
          0x02, // Device ID
          0x15, // Command
          0x05, // Sub-command
          0x00, // Reserved
          0x45, // Write operation
          0x00, // Slot byte (always 0x00)
          0x00, // Flag byte (0x00 for slot 0)
          // Minimal test data
          0x01, 0x20, 0x10, 0x2A, // Header
          0x54, 0x45, 0x53, 0x54, // "TEST" name
          0xF7 // SysEx end
        ];

        addLog(\`Sending SysEx: \${testSysEx.map(b => b.toString(16).padStart(2, '0')).join(' ')}\`);
        midiOutput.send(testSysEx);

        // Wait for response
        await new Promise(r => setTimeout(r, 500));

        // Try reading back
        addLog('\\n=== Reading Back Slot 0 ===');
        const readSysEx = [
          0xF0,
          0x00, 0x20, 0x29,
          0x02,
          0x15,
          0x05,
          0x00,
          0x40, // Read operation
          0x00, // Slot byte (always 0x00)
          0x00, // Flag byte (0x00 for slot 0)
          0xF7
        ];

        midiOutput.send(readSysEx);

        await new Promise(r => setTimeout(r, 1000));

        addLog('\\n=== Test Complete ===');

      } catch (error) {
        addLog(\`Error: \${error.message}\`);
      }
    }

    runTest();
  </script>
</body>
</html>
`;

  // Navigate to a data URL with our test page
  await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`);

  // Wait for test to complete
  await page.waitForTimeout(5000);

  // Get the log content
  const logContent = await page.textContent('#log');
  console.log(logContent);

  // Keep browser open for debugging
  // await browser.close();
}

// Run the test
testWebMidiSlotSelection().catch(console.error);