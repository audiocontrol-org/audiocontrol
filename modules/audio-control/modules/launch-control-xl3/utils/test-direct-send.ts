#!/usr/bin/env npx tsx
/**
 * Test direct HTTP sends to JUCE server to identify garbage
 */

async function testDirectSend() {
  console.log('Testing direct MIDI send via HTTP...\n');

  // First open the port
  const openResponse = await fetch('http://localhost:7777/port/LCXL3 1 MIDI In', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'LCXL3 1 MIDI In',
      type: 'output'
    })
  });
  const openData = await openResponse.json();
  console.log('Port open response:', openData);

  // Send a test SysEx
  const testSysEx = [
    0xF0,  // Start
    0x00, 0x20, 0x29, // Novation manufacturer ID
    0x02, 0x15,       // Device/model
    0x01,             // Simple test byte
    0xF7              // End
  ];

  console.log('\nSending SysEx:', testSysEx.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

  const sendResponse = await fetch('http://localhost:7777/port/LCXL3 1 MIDI In/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: testSysEx
    })
  });

  const sendData = await sendResponse.text();
  console.log('Send response:', sendData);

  // Also try with the /send endpoint directly
  console.log('\nTrying /send endpoint directly...');
  const directResponse = await fetch('http://localhost:7777/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      port: 'LCXL3 1 MIDI In',
      message: testSysEx
    })
  });

  const directData = await directResponse.text();
  console.log('Direct send response:', directData);

  // Close the port
  await fetch('http://localhost:7777/port/LCXL3 1 MIDI In', {
    method: 'DELETE'
  });
  console.log('\nPort closed');
}

testDirectSend().catch(console.error);