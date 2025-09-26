#!/usr/bin/env node

/**
 * Quick device test - using CommonJS to avoid TypeScript issues
 */

const { LaunchControlXL3 } = require('./dist/index.js');

async function testDevice() {
  console.log('🎛️  Launch Control XL 3 Device Test\n');

  let controller;

  try {
    // Create controller instance
    controller = new LaunchControlXL3({
      autoConnect: false,
      enableLedControl: true,
      deviceNameFilter: 'Launch Control XL'
    });

    console.log('1. Initializing controller...');
    await controller.initialize();

    console.log('2. Connecting to device...');
    await controller.connect();

    // Check connection
    if (controller.isConnected()) {
      console.log('✅ Device connected successfully!\n');

      const status = controller.getStatus();
      console.log('Device Status:');
      console.log('- Connected:', status.connected);
      console.log('- State:', status.state);
      if (status.deviceInfo) {
        console.log('- Firmware:', status.deviceInfo.firmwareVersion);
      }

      console.log('\n3. Testing LED control...');

      // Turn off all LEDs first
      console.log('- Turning off all LEDs');
      await controller.turnOffAllLeds();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Test some LED colors
      console.log('- Setting FOCUS1 to GREEN');
      await controller.setLed('FOCUS1', 0x3C); // Green full
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('- Setting FOCUS2 to RED');
      await controller.setLed('FOCUS2', 0x0F); // Red full
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('- Setting FOCUS3 to AMBER');
      await controller.setLed('FOCUS3', 0x3F); // Amber full
      await new Promise(resolve => setTimeout(resolve, 500));

      // Flash an LED
      console.log('- Flashing CONTROL1');
      await controller.flashLed('CONTROL1', 0x3C, 300);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Listen for control changes
      console.log('\n4. Monitoring control changes (move a knob or fader)...');
      console.log('   Press Ctrl+C to exit\n');

      controller.on('control:change', (controlId, value, channel) => {
        console.log(`Control: ${controlId} = ${value} (channel ${channel || 0})`);
      });

      // Keep running
      await new Promise(resolve => {
        process.on('SIGINT', resolve);
      });

    } else {
      console.log('❌ Failed to connect to device');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (controller) {
      console.log('\nCleaning up...');
      await controller.turnOffAllLeds();
      await controller.cleanup();
    }
    process.exit(0);
  }
}

// Run the test
testDevice().catch(console.error);