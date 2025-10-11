#!/usr/bin/env tsx
/**
 * Diagnostic tool to capture and analyze raw SysEx data from Jupiter 8 mode
 * This will help debug why our parser is getting wrong CC numbers and missing labels
 */

import { LaunchControlXL3, WebMidiBackend } from '../src/index.js';

async function diagnoseJupiter8() {
  console.log('='.repeat(80));
  console.log('Jupiter 8 Mode Diagnostic Tool');
  console.log('='.repeat(80));

  const backend = new WebMidiBackend();
  await backend.initialize();

  const device = new LaunchControlXL3(backend);

  console.log('\n[1] Connecting to device...');
  await device.connect();
  console.log('✓ Connected');

  console.log('\n[2] Fetching mode from slot 0 (Jupiter 8)...');

  // Capture raw SysEx messages
  const rawMessages: number[][] = [];

  // Temporarily hook into the backend to capture raw messages
  const originalOnSysEx = (backend as any).onSysExMessage;
  (backend as any).onSysExMessage = (data: number[]) => {
    rawMessages.push([...data]);
    if (originalOnSysEx) {
      originalOnSysEx.call(backend, data);
    }
  };

  const mode = await device.fetchCustomMode(0);

  console.log('\n[3] Raw SysEx messages captured:', rawMessages.length);

  for (let i = 0; i < rawMessages.length; i++) {
    const msg = rawMessages[i];
    if (msg) {
      console.log(`\nMessage ${i + 1}: ${msg.length} bytes`);
      console.log('First 20 bytes:', msg.slice(0, 20).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));

      // Check if this is a custom mode response
      if (msg.length > 10 && msg[4] === 0x02 && msg[5] === 0x15 && msg[6] === 0x05 && msg[7] === 0x00 && msg[8] === 0x10) {
        console.log('→ This is a CUSTOM MODE RESPONSE');
        console.log('  Slot:', msg[9]);
        console.log('  Data length:', msg.length - 11); // Excluding F0, manufacturer ID (3), header (5), slot (1), F7

        // Dump control section (look for 0x48 markers)
        console.log('\n  Looking for control definitions (0x48 markers):');
        let controlCount = 0;
        for (let j = 10; j < Math.min(msg.length - 10, 200); j++) {
          if (msg[j] === 0x48) {
            const controlId = msg[j + 1];
            const ccNumber = msg[j + 8];
            if (controlId !== undefined && ccNumber !== undefined) {
              controlCount++;
              console.log(`    Control ${controlCount}: ID=0x${controlId.toString(16).padStart(2, '0')} CC=${ccNumber} at byte ${j}`);
              if (controlCount >= 10) {
                console.log('    ... (showing first 10)');
                break;
              }
            }
          }
        }
      }
    }
  }

  console.log('\n[4] Parsed mode data:');
  console.log(`  Name: "${mode.name}"`);
  console.log(`  Controls: ${mode.controls.length}`);

  // Show first 10 controls
  console.log('\n  First 10 controls:');
  for (let i = 0; i < Math.min(10, mode.controls.length); i++) {
    const ctrl = mode.controls[i];
    if (ctrl) {
      const label = ctrl.name || `(no label)`;
      console.log(`    ${i + 1}. ID=0x${ctrl.controlId.toString(16).padStart(2, '0')} CC=${ctrl.ccNumber} CH=${ctrl.channel} "${label}"`);
    }
  }

  // Check specific problem controls
  console.log('\n[5] Checking specific problem controls:');

  const problemControls = [
    { id: 0x17, expected: { cc: 41, label: 'Encoder 8' } },
    { id: 0x18, expected: { cc: 21, label: 'Resonance' } },
    { id: 0x23, expected: { cc: 61, label: 'Osc 2 Shape' } },
    { id: 0x28, expected: { cc: 53, label: 'A' } },
    { id: 0x29, expected: { cc: 54, label: 'D' } },
  ];

  for (const prob of problemControls) {
    const found = mode.controls.find(c => c.controlId === prob.id);
    if (found) {
      const match = found.ccNumber === prob.expected.cc && found.name === prob.expected.label;
      const status = match ? '✓' : '✗';
      console.log(`  ${status} Control 0x${prob.id.toString(16)}: Expected CC ${prob.expected.cc}/"${prob.expected.label}", Got CC ${found.ccNumber}/"${found.name || '(none)'}"`);
    } else {
      console.log(`  ✗ Control 0x${prob.id.toString(16)}: NOT FOUND in parsed data`);
    }
  }

  console.log('\n[6] Disconnecting...');
  await device.disconnect();
  console.log('✓ Done');

  console.log('\n' + '='.repeat(80));
  console.log('Diagnostic complete');
  console.log('='.repeat(80));
}

diagnoseJupiter8().catch(console.error);
