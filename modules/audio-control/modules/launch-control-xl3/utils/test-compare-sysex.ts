#!/usr/bin/env npx tsx
/**
 * Compare our generated SysEx with known-good data from web editor
 * This helps identify exactly what's different
 */

import { LaunchControlXL3 } from '../src/index.js';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';
import { SysExParser } from '../src/core/SysExParser.js';

// Exact data captured from web editor for slot 0 (342 bytes)
const KNOWN_GOOD_DATA_SLOT_0 = Buffer.from([
  0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x45, 0x00, 0x01, 0x20, 0x10, 0x2A, 0x4E, 0x65,
  0x77, 0x20, 0x43, 0x75, 0x73, 0x74, 0x6F, 0x6D, 0x20, 0x4D, 0x6F, 0x64, 0x65, 0x49, 0x10, 0x02,
  0x05, 0x00, 0x01, 0x40, 0x00, 0x0D, 0x7F, 0x00, 0x49, 0x11, 0x02, 0x05, 0x00, 0x01, 0x40, 0x00,
  0x0E, 0x7F, 0x00, 0x49, 0x12, 0x02, 0x05, 0x00, 0x01, 0x40, 0x00, 0x0F, 0x7F, 0x00, 0x49, 0x13,
  0x02, 0x05, 0x00, 0x01, 0x40, 0x00, 0x10, 0x7F, 0x00, 0x49, 0x14, 0x02, 0x05, 0x00, 0x01, 0x40,
  0x00, 0x11, 0x7F, 0x00, 0x49, 0x15, 0x02, 0x05, 0x00, 0x01, 0x40, 0x00, 0x12, 0x7F, 0x00, 0x49,
  0x16, 0x02, 0x05, 0x00, 0x01, 0x40, 0x00, 0x13, 0x7F, 0x00, 0x49, 0x17, 0x02, 0x05, 0x00, 0x01,
  0x40, 0x00, 0x14, 0x7F, 0x00, 0x49, 0x18, 0x02, 0x09, 0x00, 0x01, 0x40, 0x00, 0x15, 0x7F, 0x00,
  0x49, 0x19, 0x02, 0x09, 0x00, 0x01, 0x40, 0x00, 0x16, 0x7F, 0x00, 0x49, 0x1A, 0x02, 0x09, 0x00,
  0x01, 0x40, 0x00, 0x17, 0x7F, 0x00, 0x49, 0x1B, 0x02, 0x09, 0x00, 0x01, 0x40, 0x00, 0x18, 0x7F,
  0x00, 0x49, 0x1C, 0x02, 0x09, 0x00, 0x01, 0x40, 0x00, 0x19, 0x7F, 0x00, 0x49, 0x1D, 0x02, 0x09,
  0x00, 0x01, 0x40, 0x00, 0x1A, 0x7F, 0x00, 0x49, 0x1E, 0x02, 0x09, 0x00, 0x01, 0x40, 0x00, 0x1B,
  0x7F, 0x00, 0x49, 0x1F, 0x02, 0x09, 0x00, 0x01, 0x40, 0x00, 0x1C, 0x7F, 0x00, 0x49, 0x20, 0x02,
  0x0D, 0x00, 0x01, 0x40, 0x00, 0x1D, 0x7F, 0x00, 0x49, 0x21, 0x02, 0x0D, 0x00, 0x01, 0x40, 0x00,
  0x1E, 0x7F, 0x00, 0x49, 0x22, 0x02, 0x0D, 0x00, 0x01, 0x40, 0x00, 0x1F, 0x7F, 0x00, 0x49, 0x23,
  0x02, 0x0D, 0x00, 0x01, 0x40, 0x00, 0x20, 0x7F, 0x00, 0x49, 0x24, 0x02, 0x0D, 0x00, 0x01, 0x40,
  0x00, 0x21, 0x7F, 0x00, 0x49, 0x25, 0x02, 0x0D, 0x00, 0x01, 0x40, 0x00, 0x22, 0x7F, 0x00, 0x49,
  0x26, 0x02, 0x0D, 0x00, 0x01, 0x40, 0x00, 0x23, 0x7F, 0x00, 0x49, 0x27, 0x02, 0x0D, 0x00, 0x01,
  0x40, 0x00, 0x24, 0x7F, 0x00, 0x60, 0x10, 0x60, 0x11, 0x60, 0x12, 0x60, 0x13, 0x60, 0x14, 0x60,
  0x15, 0x60, 0x16, 0x60, 0x17, 0x60, 0x18, 0x60, 0x19, 0x60, 0x1A, 0x60, 0x1B, 0x60, 0x1C, 0x60,
  0x1D, 0x60, 0x1E, 0x60, 0x1F, 0x60, 0x20, 0x60, 0x21, 0x60, 0x22, 0x60, 0x23, 0x60, 0x24, 0x60,
  0x25, 0x60, 0x26, 0x60, 0x27, 0xF7
]);

function compareBuffers(a: Buffer, b: Buffer, name1: string, name2: string) {
  console.log(`\n=== Comparing ${name1} vs ${name2} ===`);
  console.log(`${name1} length: ${a.length} bytes`);
  console.log(`${name2} length: ${b.length} bytes`);

  if (a.length !== b.length) {
    console.log(`⚠️ LENGTH MISMATCH: ${Math.abs(a.length - b.length)} bytes difference`);
  }

  // Find first difference
  let firstDiff = -1;
  let diffCount = 0;
  const maxDiffsToShow = 20;

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const valA = i < a.length ? a[i] : undefined;
    const valB = i < b.length ? b[i] : undefined;

    if (valA !== valB) {
      if (firstDiff === -1) firstDiff = i;
      diffCount++;

      if (diffCount <= maxDiffsToShow) {
        const hexA = valA !== undefined ? `0x${valA.toString(16).padStart(2, '0').toUpperCase()}` : 'MISSING';
        const hexB = valB !== undefined ? `0x${valB.toString(16).padStart(2, '0').toUpperCase()}` : 'MISSING';
        console.log(`  Byte ${i}: ${hexA} != ${hexB}`);
      }
    }
  }

  if (diffCount === 0) {
    console.log('✅ IDENTICAL: Buffers match exactly!');
  } else {
    console.log(`\n❌ DIFFERENT: ${diffCount} bytes differ (first at position ${firstDiff})`);
    if (diffCount > maxDiffsToShow) {
      console.log(`  (showing first ${maxDiffsToShow} differences)`);
    }
  }

  // Show context around first difference
  if (firstDiff >= 0 && firstDiff < Math.min(a.length, b.length)) {
    console.log('\nContext around first difference:');
    const start = Math.max(0, firstDiff - 5);
    const end = Math.min(Math.max(a.length, b.length), firstDiff + 10);

    console.log(`${name1}:`);
    console.log('  ' + Array.from(a.slice(start, Math.min(end, a.length)))
      .map((b, i) => {
        const hex = b.toString(16).padStart(2, '0').toUpperCase();
        return (start + i === firstDiff) ? `[${hex}]` : hex;
      }).join(' '));

    console.log(`${name2}:`);
    console.log('  ' + Array.from(b.slice(start, Math.min(end, b.length)))
      .map((b, i) => {
        const hex = b.toString(16).padStart(2, '0').toUpperCase();
        return (start + i === firstDiff) ? `[${hex}]` : hex;
      }).join(' '));
  }

  return diffCount === 0;
}

async function testSysExComparison() {
  console.log('SysEx Message Comparison Test');
  console.log('==============================\n');

  let device: LaunchControlXL3 | null = null;
  let capturedMessages: number[][] = [];

  try {
    // Initialize MIDI backend with message capture
    const midiBackend = new EasyMidiBackend();
    await midiBackend.initialize();

    // Monkey-patch to capture outgoing messages
    const originalSend = midiBackend.sendMessage.bind(midiBackend);
    midiBackend.sendMessage = async (port: any, message: any) => {
      console.log(`📤 Capturing outgoing message: ${message.length} bytes`);
      if (message[0] === 0xF0) { // SysEx
        capturedMessages.push(message);
      }
      return originalSend(port, message);
    };

    // Create device with custom modes enabled
    device = new LaunchControlXL3({
      midiBackend: midiBackend,
      enableLedControl: false,
      enableCustomModes: true
    });

    console.log('→ Connecting to device...');
    await device.connect();
    console.log('✓ Connected\n');

    // Create test mode matching the web editor's data
    const testMode = {
      name: 'New Custom Mode',
      controls: [],
      colors: []
    };

    // Add 24 encoders (just the first 24 controls from web editor)
    for (let i = 0; i < 24; i++) {
      const controlId = 0x10 + i;
      testMode.controls.push({
        id: controlId,
        controlId: controlId,
        type: 'encoder',
        index: i,
        cc: 0x0D + i, // Starting at CC 13 (0x0D)
        channel: 1,
        minValue: 0,
        maxValue: 127,
        color: 0 // Default color
      });
      testMode.colors.push(0); // Add color to colors array
    }

    // Clear captured messages
    capturedMessages = [];

    console.log('→ Writing custom mode to slot 0...');
    await device.writeCustomMode(0, testMode);
    console.log('✓ Write completed\n');

    // Find the write SysEx message (should be command 0x45)
    const writeSysEx = capturedMessages.find(msg =>
      msg.length > 10 && msg[8] === 0x45 // Write command
    );

    if (writeSysEx) {
      console.log(`📤 Captured write SysEx: ${writeSysEx.length} bytes`);
      const ourBuffer = Buffer.from(writeSysEx);

      // Compare with known good
      compareBuffers(ourBuffer, KNOWN_GOOD_DATA_SLOT_0, 'Our SysEx', 'Web Editor SysEx');

      // Also generate using SysExParser directly for comparison
      console.log('\n=== Testing SysExParser directly ===');
      const directEncoded = SysExParser.encodeCustomModeData(testMode, 0);
      const directBuffer = Buffer.from(directEncoded);

      compareBuffers(directBuffer, KNOWN_GOOD_DATA_SLOT_0, 'Direct Parser', 'Web Editor SysEx');
      compareBuffers(ourBuffer, directBuffer, 'Captured', 'Direct Parser');

      // Show hex dumps of key sections
      console.log('\n=== Key Sections ===');
      console.log('\nHeader (first 30 bytes):');
      console.log('Our:    ' + Array.from(ourBuffer.slice(0, 30)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
      console.log('Known:  ' + Array.from(KNOWN_GOOD_DATA_SLOT_0.slice(0, 30)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));

      console.log('\nFirst control definition (bytes 30-40):');
      console.log('Our:    ' + Array.from(ourBuffer.slice(30, 40)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
      console.log('Known:  ' + Array.from(KNOWN_GOOD_DATA_SLOT_0.slice(30, 40)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));

    } else {
      console.log('❌ No write SysEx captured!');
    }

  } catch (error) {
    console.error('\n✗ Test failed:', error instanceof Error ? error.message : String(error));
  } finally {
    if (device) {
      console.log('\n→ Disconnecting...');
      await device.disconnect();
      console.log('✓ Disconnected');
    }
  }
}

// Run the test
testSysExComparison().catch(console.error);