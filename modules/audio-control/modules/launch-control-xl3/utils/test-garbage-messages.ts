#!/usr/bin/env npx tsx
/**
 * Test to isolate garbage 1-byte MIDI messages
 * Monitors raw HTTP requests to JUCE server to see what's being sent
 */

async function testGarbageMessages() {
  console.log('🔍 Testing for garbage MIDI messages...\n');

  const portId = 'LCXL3 1 MIDI In';

  // First open the port
  console.log('1. Opening port...');
  const openResponse = await fetch(`http://localhost:7777/port/${encodeURIComponent(portId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: portId,
      type: 'output'
    })
  });
  console.log(`   Status: ${openResponse.status}`);
  const openData = await openResponse.json();
  console.log(`   Response:`, openData);

  // Test 1: Send a valid SysEx
  console.log('\n2. Sending valid SysEx...');
  const validSysEx = [
    0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x01, 0xF7
  ];
  console.log(`   Message: [${validSysEx.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);

  const sysexResponse = await fetch(`http://localhost:7777/port/${encodeURIComponent(portId)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: validSysEx
    })
  });
  console.log(`   Status: ${sysexResponse.status}`);
  const sysexData = await sysexResponse.json();
  console.log(`   Response:`, sysexData);

  // Test 2: Try sending an empty array (should be rejected)
  console.log('\n3. Testing empty message (should fail)...');
  const emptyResponse = await fetch(`http://localhost:7777/port/${encodeURIComponent(portId)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: []
    })
  });
  console.log(`   Status: ${emptyResponse.status}`);
  const emptyData = await emptyResponse.json();
  console.log(`   Response:`, emptyData);

  // Test 3: Try sending a single byte (should work for status bytes)
  console.log('\n4. Testing single byte 0xF0 (incomplete SysEx start)...');
  const singleF0Response = await fetch(`http://localhost:7777/port/${encodeURIComponent(portId)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: [0xF0]
    })
  });
  console.log(`   Status: ${singleF0Response.status}`);
  const singleF0Data = await singleF0Response.json();
  console.log(`   Response:`, singleF0Data);

  // Test 4: Valid single byte status (like timing clock)
  console.log('\n5. Testing valid single byte 0xF8 (timing clock)...');
  const timingClockResponse = await fetch(`http://localhost:7777/port/${encodeURIComponent(portId)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: [0xF8]
    })
  });
  console.log(`   Status: ${timingClockResponse.status}`);
  const timingClockData = await timingClockResponse.json();
  console.log(`   Response:`, timingClockData);

  // Close the port
  console.log('\n6. Closing port...');
  const closeResponse = await fetch(`http://localhost:7777/port/${encodeURIComponent(portId)}`, {
    method: 'DELETE'
  });
  console.log(`   Status: ${closeResponse.status}`);
  const closeData = await closeResponse.json();
  console.log(`   Response:`, closeData);

  console.log('\n✅ Test complete');
}

testGarbageMessages().catch(console.error);