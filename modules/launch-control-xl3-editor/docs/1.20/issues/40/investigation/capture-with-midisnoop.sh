#!/bin/bash
# Capture MIDI traffic while running mode name test
# This uses midisnoop to observe the actual MIDI conversation

CAPTURE_DIR="/Users/orion/work/ol_dsp/modules/audio-control/docs/1.20/issues/40/investigation/midi-captures"
mkdir -p "$CAPTURE_DIR"

echo "=== MIDI Traffic Capture for Mode Name Investigation ==="
echo ""
echo "This script will:"
echo "1. Start midisnoop to capture MIDI traffic"
echo "2. Run a simple mode write/read test"
echo "3. Save the captured MIDI to $CAPTURE_DIR"
echo ""
echo "Device: Launch Control XL3 (LCXL3 1)"
echo "Test: Write mode 'TESTMODE' to slot 3, read it back"
echo ""

# Start midisnoop in background, capturing to file
CAPTURE_FILE="$CAPTURE_DIR/mode-name-test-$(date +%s).txt"
echo "Starting midisnoop, output to: $CAPTURE_FILE"
echo ""

midisnoop -p "LCXL3 1" > "$CAPTURE_FILE" 2>&1 &
SNOOP_PID=$!

# Give midisnoop time to start
sleep 1

# Run the test
echo "Running mode write/read test..."
cd /Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3

# Create a simple test that writes and reads a mode
npx tsx << 'TESTSCRIPT'
import { NodeMidiBackend } from '@/backends/NodeMidiBackend.js';
import { MidiInterface } from '@/core/MidiInterface.js';
import { DeviceManager } from '@/device/DeviceManager.js';
import { CustomModeBuilder } from '@/builders/CustomModeBuilder.js';

async function test() {
  const backend = new NodeMidiBackend();
  await backend.initialize();
  
  const midi = new MidiInterface(backend);
  await midi.initialize();
  
  const outputPorts = await midi.getOutputPorts();
  const inputPorts = await midi.getInputPorts();
  
  const outputPort = outputPorts.find(p => p.name.includes('LCXL3 1'));
  const inputPort = inputPorts.find(p => p.name.includes('LCXL3 1'));
  
  if (!outputPort || !inputPort) {
    console.error('Device not found');
    process.exit(1);
  }
  
  await midi.openInput(inputPort.id);
  await midi.openOutput(outputPort.id);
  
  const deviceManager = new DeviceManager(midi);
  
  // Write a mode with known name
  const mode = new CustomModeBuilder()
    .name('TESTMODE')
    .addFader(1, { cc: 10, channel: 1 })
    .addEncoder(1, 1, { cc: 13, channel: 1 })
    .build();
  
  console.log('\nWriting mode "TESTMODE" to slot 3...');
  await deviceManager.writeCustomMode(3, mode);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('Reading back from slot 3...');
  const readMode = await deviceManager.readCustomMode(3);
  
  console.log(`\nResult: Written "TESTMODE", read back "${readMode.name}"`);
  console.log(`Expected: 8 characters, Got: ${readMode.name.length} characters`);
  
  await midi.cleanup();
}

test().catch(console.error);
TESTSCRIPT

# Wait a moment for test to complete
sleep 2

# Stop midisnoop
kill $SNOOP_PID 2>/dev/null

echo ""
echo "=== Capture Complete ==="
echo "MIDI traffic saved to: $CAPTURE_FILE"
echo ""
echo "Analyzing capture for mode name bytes..."
echo ""

# Show the captured data
cat "$CAPTURE_FILE"

echo ""
echo "=== Next Steps ==="
echo "1. Review the hex dumps above"
echo "2. Look for mode name encoding in WRITE messages (search for 'TESTMODE' bytes)"
echo "3. Look for mode name in READ responses"
echo "4. Compare the byte patterns"
echo ""
