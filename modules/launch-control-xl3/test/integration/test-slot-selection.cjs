#!/usr/bin/env node

/**
 * Simple Node.js test for Issue #36 slot selection fix
 * Tests that device ID 0x02 (not 0x11) allows slot selection to work
 *
 * Usage: node test/integration/test-slot-selection.js
 */

const midi = require('midi');

// Test configuration
const TEST_TIMEOUT = 10000; // 10 seconds
const HANDSHAKE_TIMEOUT = 5000; // 5 seconds per handshake step

// SysEx message helpers
const MANUFACTURER_ID = [0x00, 0x20, 0x29];
const DEVICE_ID = 0x02; // Launch Control XL 3

function buildNovationSyn() {
  return [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7];
}

function buildUniversalDeviceInquiry() {
  return [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];
}

function buildTemplateChange(slot) {
  return [0xF0, ...MANUFACTURER_ID, DEVICE_ID, 0x77, slot, 0xF7];
}

function buildCustomModeReadRequest(slot, page) {
  return [
    0xF0, ...MANUFACTURER_ID, DEVICE_ID, 0x15, 0x05, 0x00, 0x40,
    page === 0 ? 0x00 : 0x03, slot, 0xF7
  ];
}

// Main test function
async function runTest() {
  console.log('=== Issue #36 Slot Selection Test ===\n');

  // Create MIDI input and output
  const input = new midi.Input();
  const output = new midi.Output();

  try {
    // Find Launch Control XL 3 MIDI ports
    console.log('[1] Finding Launch Control XL 3 MIDI ports...');

    let inputPortIndex = -1;
    let outputPortIndex = -1;

    // Find input port (device's MIDI Out)
    const inputPortCount = input.getPortCount();
    for (let i = 0; i < inputPortCount; i++) {
      const portName = input.getPortName(i);
      if (portName.includes('LCXL3') && portName.includes('MIDI Out')) {
        inputPortIndex = i;
        console.log(`   ✓ Found input port: ${portName}`);
        break;
      }
    }

    // Find output port (device's MIDI In)
    const outputPortCount = output.getPortCount();
    for (let i = 0; i < outputPortCount; i++) {
      const portName = output.getPortName(i);
      if (portName.includes('LCXL3') && portName.includes('MIDI In')) {
        outputPortIndex = i;
        console.log(`   ✓ Found output port: ${portName}`);
        break;
      }
    }

    if (inputPortIndex === -1 || outputPortIndex === -1) {
      throw new Error('Launch Control XL 3 not found. Please connect the device.');
    }

    // Open ports
    input.openPort(inputPortIndex);
    output.openPort(outputPortIndex);

    // CRITICAL: Enable SysEx messages (disabled by default!)
    // Order: (Sysex, Timing, Active Sensing)
    input.ignoreTypes(false, false, false);

    console.log('   ✓ Ports opened\n');

    // Helper to wait for specific message (handles chunked SysEx)
    function waitForMessage(description, validator, timeout = HANDSHAKE_TIMEOUT) {
      return new Promise((resolve, reject) => {
        let handler = null;
        let buffer = [];
        let inSysEx = false;

        const timer = setTimeout(() => {
          if (handler) input.removeListener('message', handler);
          reject(new Error(`Timeout waiting for ${description}`));
        }, timeout);

        handler = (deltaTime, message) => {
          const bytes = Array.from(message);
          console.log(`   [RX] ${bytes.slice(0, 10).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}${bytes.length > 10 ? '...' : ''}`);

          // Start of SysEx message
          if (bytes[0] === 0xF0) {
            buffer = bytes;
            inSysEx = true;
          } else if (inSysEx) {
            // Continue building SysEx message
            buffer.push(...bytes);
          }

          // Check if we have a complete message
          if (buffer.length > 0 && buffer[buffer.length - 1] === 0xF7) {
            inSysEx = false;
            if (validator(buffer)) {
              clearTimeout(timer);
              input.removeListener('message', handler);
              resolve(buffer);
            }
            buffer = []; // Reset for next message
          }
        };

        input.on('message', handler);
      });
    }

    // Step 1: Device Handshake
    console.log('[2] Performing device handshake...');

    // Send Novation SYN
    const synMessage = buildNovationSyn();
    console.log(`   [TX] SYN: ${synMessage.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    output.sendMessage(synMessage);

    // Wait for SYN-ACK (22 bytes)
    await waitForMessage('SYN-ACK', (bytes) => {
      return bytes.length === 22 && bytes[0] === 0xF0 && bytes[5] === 0x42 && bytes[6] === 0x02;
    });
    console.log('   ✓ Received SYN-ACK\n');

    // Send Universal Device Inquiry
    const inquiryMessage = buildUniversalDeviceInquiry();
    console.log(`   [TX] Device Inquiry: ${inquiryMessage.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    output.sendMessage(inquiryMessage);

    // Wait for Device Response
    await waitForMessage('Device Inquiry Response', (bytes) => {
      return bytes[0] === 0xF0 && bytes[1] === 0x7E && bytes[3] === 0x06 && bytes[4] === 0x02;
    });
    console.log('   ✓ Device handshake complete\n');

    // Step 2: Read from slot 0 (active slot)
    console.log('[3] Reading from slot 0 (should work)...');
    const readSlot0 = buildCustomModeReadRequest(0, 0);
    console.log(`   [TX] Read slot 0: ${readSlot0.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    output.sendMessage(readSlot0);

    const slot0Response = await waitForMessage('Slot 0 response', (bytes) => {
      return bytes[0] === 0xF0 && bytes[8] === 0x10; // Custom mode response
    }, TEST_TIMEOUT);

    // Parse name from slot 0
    let slot0Name = 'Unknown';
    for (let i = 10; i < slot0Response.length - 3; i++) {
      if (slot0Response[i] === 0x06 && slot0Response[i + 1] === 0x20) {
        const length = slot0Response[i + 2];
        if (length > 0) {
          const nameBytes = slot0Response.slice(i + 3, i + 3 + length);
          slot0Name = String.fromCharCode(...nameBytes);
          break;
        }
      }
    }
    console.log(`   ✓ Slot 0: "${slot0Name}"\n`);

    // Step 3: Select slot 1 with device ID 0x02
    console.log('[4] Selecting slot 1 with device ID 0x02 (CRITICAL FIX)...');
    const selectSlot1 = buildTemplateChange(1);
    console.log(`   [TX] Select slot 1: ${selectSlot1.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    console.log(`   [VERIFY] Device ID byte: 0x${selectSlot1[4].toString(16).padStart(2, '0')} (should be 0x02, NOT 0x11)`);
    output.sendMessage(selectSlot1);

    // Wait for device to process slot selection
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('   ✓ Slot selection sent\n');

    // Step 4: Read from slot 1 (should work with correct device ID)
    console.log('[5] Reading from slot 1 (testing fix)...');
    const readSlot1 = buildCustomModeReadRequest(1, 0);
    console.log(`   [TX] Read slot 1: ${readSlot1.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    output.sendMessage(readSlot1);

    let receivedStatus9 = false;
    const slot1Response = await waitForMessage('Slot 1 response', (bytes) => {
      // Check for status 0x9 error
      if (bytes.length === 12 && bytes[8] === 0x15 && bytes[10] === 0x09) {
        receivedStatus9 = true;
        return true;
      }
      // Check for successful response
      return bytes[0] === 0xF0 && bytes[8] === 0x10;
    }, TEST_TIMEOUT);

    if (receivedStatus9) {
      console.log('   ✗ FAILED: Device rejected with status 0x9');
      console.log('   ✗ The fix did NOT work - device ID may still be wrong\n');
      process.exit(1);
    }

    // Parse name from slot 1
    let slot1Name = 'Unknown';
    for (let i = 10; i < slot1Response.length - 3; i++) {
      if (slot1Response[i] === 0x06 && slot1Response[i + 1] === 0x20) {
        const length = slot1Response[i + 2];
        if (length > 0) {
          const nameBytes = slot1Response.slice(i + 3, i + 3 + length);
          slot1Name = String.fromCharCode(...nameBytes);
          break;
        }
      }
    }
    console.log(`   ✓ Slot 1: "${slot1Name}"`);
    console.log('   ✓ No status 0x9 error - FIX VALIDATED!\n');

    // Success!
    console.log('=== TEST PASSED ===');
    console.log('✓ Device ID 0x02 works correctly');
    console.log('✓ Slot selection succeeded');
    console.log('✓ No status 0x9 rejection');
    console.log(`✓ Slot 0: "${slot0Name}"`);
    console.log(`✓ Slot 1: "${slot1Name}"\n`);

    process.exit(0);

  } catch (error) {
    console.error(`\n✗ Test failed: ${error.message}\n`);
    process.exit(1);
  } finally {
    // Clean up
    try {
      input.closePort();
      output.closePort();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Run the test
runTest();
