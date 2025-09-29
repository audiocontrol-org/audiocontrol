#!/usr/bin/env tsx
/**
 * Test to compare our SysEx format with the web editor's format
 */

import { SysExParser } from '../src/core/SysExParser.js';

console.log('SysEx Format Comparison Test');
console.log('============================\n');

// Known working messages from web editor
const webEditorMessages = {
  slot1Write: [0xf0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x00, 0x06, 0xf7],
  slot4Write: [0xf0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x03, 0x06, 0xf7],
};

console.log('Web Editor Format (slot 1):');
console.log(webEditorMessages.slot1Write.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
console.log('\nWeb Editor Format (slot 4):');
console.log(webEditorMessages.slot4Write.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

// Create a minimal custom mode
const testMode = {
  name: 'Test',
  controls: [
    {
      controlId: 0x0d,
      name: 'TestVolume1',
      cc: 13,
      channel: 0
    }
  ],
  colors: [
    {
      controlId: 0x0d,
      color: 0x0F  // Red
    }
  ]
};

console.log('\n\nOur SysExParser Output:');
console.log('=======================');

try {
  // Generate message for slot 0
  const ourMessage = SysExParser.buildCustomModeWriteRequest(0, testMode);
  console.log('\nSlot 0 Write:');
  console.log(ourMessage.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  console.log(`Length: ${ourMessage.length} bytes`);

  // Show just the header for comparison
  console.log('\nOur header (first 12 bytes):');
  console.log(ourMessage.slice(0, 12).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

  console.log('\nWeb editor header:');
  console.log(webEditorMessages.slot1Write.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

  console.log('\n\nDifferences Found:');
  console.log('==================');
  console.log('Position | Web Editor | Our Parser');
  console.log('---------|------------|------------');
  for (let i = 0; i < Math.min(12, ourMessage.length); i++) {
    const webByte = webEditorMessages.slot1Write[i];
    const ourByte = ourMessage[i];
    if (webByte !== ourByte) {
      console.log(`${i.toString().padStart(8)} | 0x${webByte?.toString(16).padStart(2, '0') ?? '??'}       | 0x${ourByte.toString(16).padStart(2, '0')}       ${i === 8 ? '← Key difference!' : ''}`);
    }
  }

  console.log('\n\nAnalysis:');
  console.log('=========');
  console.log('1. Web editor uses simpler format with just 12 bytes total');
  console.log('2. Our parser generates a much longer message with full control data');
  console.log('3. Key byte at position 8:');
  console.log('   - Web editor: 0x15 (unknown meaning)');
  console.log('   - Our parser: 0x45 (assumed write operation)');
  console.log('4. Web editor appears to use a simplified protocol for writes');

} catch (error) {
  console.error('Error:', error);
}

console.log('\n\nConclusion:');
console.log('===========');
console.log('The web editor uses a much simpler SysEx format than what we generate.');
console.log('It appears to be a "command" message rather than a full data dump.');
console.log('The actual custom mode data might be sent separately or in a different way.');