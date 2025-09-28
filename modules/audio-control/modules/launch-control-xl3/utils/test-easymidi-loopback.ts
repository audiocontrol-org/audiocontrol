#!/usr/bin/env tsx

import easymidi from 'easymidi';

console.log('===== EasyMIDI Loopback Test =====\n');

const testMessages = [
  { name: 'Universal Device Inquiry', data: [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7] },
  { name: 'Simple SysEx', data: [0xF0, 0x7E, 0x7F, 0x06, 0x02, 0xF7] },
  { name: 'Long SysEx', data: [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0A, 0x77, 0x01, 0x02, 0x03, 0x04, 0x05, 0xF7] }
];

let receivedCount = 0;
let sentCount = 0;

try {
  console.log('Creating virtual MIDI ports...');
  const virtualName = 'EasyMIDI-Loopback-Test';

  // Create virtual output (we'll send to this)
  const output = new easymidi.Output(virtualName, true);
  console.log(`✓ Created virtual output: ${virtualName}`);

  // Create virtual input (we'll receive from this)
  const input = new easymidi.Input(virtualName, true);
  console.log(`✓ Created virtual input: ${virtualName}`);

  console.log('\nSetting up message listener...');

  input.on('sysex', (bytes: number[]) => {
    receivedCount++;
    console.log(`✓ Received SysEx #${receivedCount}:`, bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    console.log(`  Length: ${bytes.length} bytes`);
  });

  console.log('Listener ready.\n');
  console.log('Sending test messages...\n');

  // Send test messages with delays
  for (const test of testMessages) {
    sentCount++;
    console.log(`Sending #${sentCount}: ${test.name}`);
    console.log(`  Data: ${test.data.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    console.log(`  Length: ${test.data.length} bytes`);

    try {
      output.send('sysex', test.data);
      console.log('  ✓ Sent successfully\n');
    } catch (err: any) {
      console.log(`  ✗ Send failed: ${err.message}\n`);
    }

    // Wait a bit between messages
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('Waiting 1 second for any delayed messages...\n');

  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('===== Test Results =====');
  console.log(`Sent: ${sentCount} messages`);
  console.log(`Received: ${receivedCount} messages`);

  if (receivedCount === sentCount) {
    console.log('✓ SUCCESS: All messages received!');
  } else {
    console.log(`✗ FAILURE: ${sentCount - receivedCount} messages lost`);
  }

  input.close();
  output.close();

  process.exit(receivedCount === sentCount ? 0 : 1);

} catch (error: any) {
  console.error('✗ Test Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}