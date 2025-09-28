#!/usr/bin/env tsx

import easymidi from 'easymidi';

console.log('===== EasyMIDI Port Diagnostic =====\n');

console.log('Available Input Ports:');
const inputs = easymidi.getInputs();
inputs.forEach((port, i) => {
  console.log(`  ${i + 1}. ${port}`);
});

console.log('\nAvailable Output Ports:');
const outputs = easymidi.getOutputs();
outputs.forEach((port, i) => {
  console.log(`  ${i + 1}. ${port}`);
});

console.log('\n===== Testing LCXL3 Ports =====\n');

try {
  console.log('Opening input port: LCXL3 1 MIDI Out...');
  const input = new easymidi.Input('LCXL3 1 MIDI Out');
  console.log('✓ Input port opened successfully');

  console.log('Opening output port: LCXL3 1 MIDI In...');
  const output = new easymidi.Output('LCXL3 1 MIDI In');
  console.log('✓ Output port opened successfully');

  console.log('\nSetting up message listeners...');

  input.on('sysex', (bytes: number[]) => {
    console.log('✓ Received SysEx:', bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  });

  input.on('cc', (msg: any) => {
    console.log('✓ Received CC:', msg);
  });

  input.on('noteon', (msg: any) => {
    console.log('✓ Received Note On:', msg);
  });

  input.on('noteoff', (msg: any) => {
    console.log('✓ Received Note Off:', msg);
  });

  console.log('Listeners set up. Sending Universal Device Inquiry...\n');

  const inquiry = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
  console.log('Sending:', inquiry.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  output.send('sysex', inquiry);

  console.log('\nWaiting 5 seconds for response...');
  console.log('(Try moving a knob or pressing a button on the device)\n');

  setTimeout(() => {
    console.log('\n===== Test Complete =====');
    console.log('If you saw no "Received" messages above, the device is not responding.');
    console.log('This could mean:');
    console.log('  1. Device is in the wrong mode');
    console.log('  2. Ports are not correctly selected');
    console.log('  3. Device firmware issue');
    console.log('  4. Another application is using the device');

    input.close();
    output.close();
    process.exit(0);
  }, 5000);

} catch (error: any) {
  console.error('✗ Error:', error.message);
  process.exit(1);
}