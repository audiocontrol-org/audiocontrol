#!/usr/bin/env tsx

import easymidi from 'easymidi';

console.log('===== Testing LCXL3 DAW Ports =====\n');

try {
  console.log('Opening input port: LCXL3 1 DAW Out...');
  const input = new easymidi.Input('LCXL3 1 DAW Out');
  console.log('✓ Input port opened successfully');

  console.log('Opening output port: LCXL3 1 DAW In...');
  const output = new easymidi.Output('LCXL3 1 DAW In');
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

    input.close();
    output.close();
    process.exit(0);
  }, 5000);

} catch (error: any) {
  console.error('✗ Error:', error.message);
  process.exit(1);
}