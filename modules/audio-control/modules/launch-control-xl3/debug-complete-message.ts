#!/usr/bin/env tsx

/**
 * Debug complete SysEx message parsing with actual 434-byte response
 */

import { SysExParser } from '@/core/SysExParser';

// Create a complete test message with proper F0...F7 structure
// This simulates the actual 434-byte response from the device
const createTestMessage = () => {
  const message = [];

  // Start with the header we know from the debug output
  message.push(
    0xF0,       // SysEx start
    0x00, 0x20, 0x29,  // Manufacturer ID (Novation)
    0x02,       // Device ID (Launch Control XL 3)
    0x15,       // Command (Custom mode)
    0x05,       // Sub-command
    0x00,       // Reserved
    0x10,       // Operation (read response)
    0x00        // Slot
  );

  // Add the mode name pattern we saw: 06 20 0E "Digitakt mixer!"
  message.push(0x06, 0x20, 0x0E);
  const modeName = "Digitakt mixer!";
  for (let i = 0; i < modeName.length; i++) {
    message.push(modeName.charCodeAt(i));
  }

  // Add some control data (0x48 markers with control info)
  // Simulate a few controls
  for (let i = 0; i < 5; i++) {
    message.push(
      0x48,     // Control marker
      0x03 + i, // Control ID
      0x21,     // Def type
      0x21,     // Control type (encoder)
      0x00,     // Channel
      0x00,     // Param 1
      0x00,     // Param 2
      0x10 + i, // CC number
      0x7F      // Max value
    );
  }

  // Pad to approximately 434 bytes total
  while (message.length < 433) {
    message.push(0x00); // Padding
  }

  // End with SysEx terminator
  message.push(0xF7);

  return message;
};

const testMessage = createTestMessage();

console.log('🔍 Debug Complete SysEx Message Parsing\n');
console.log(`Message length: ${testMessage.length} bytes`);
console.log(`First 20 bytes: ${testMessage.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
console.log(`Last 10 bytes: ${testMessage.slice(-10).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

console.log('\nTesting complete message parsing...');
try {
  const parsed = SysExParser.parse(testMessage);
  console.log('✅ Parsing successful!');
  console.log(`Type: ${parsed.type}`);

  if (parsed.type === 'custom_mode_response') {
    const customMode = parsed as any;
    console.log(`📛 Mode Name: "${customMode.name || 'Unknown'}"`);
    console.log(`📍 Slot: ${customMode.slot}`);
    console.log(`🎛️  Controls: ${customMode.controls?.length || 0}`);
    console.log(`🌈 Colors: ${customMode.colors?.length || 0}`);
  }
} catch (error: any) {
  console.error('❌ Parsing failed:', error.message);
  console.error('Stack:', error.stack);
}

// Test isValidSysEx
console.log(`\nIs valid SysEx: ${SysExParser.isValidSysEx(testMessage)}`);

// Test manufacturer ID extraction
const manufacturerId = SysExParser.getManufacturerId(testMessage);
console.log(`Manufacturer ID: ${manufacturerId?.map(b => '0x' + b.toString(16)).join(' ')}`);