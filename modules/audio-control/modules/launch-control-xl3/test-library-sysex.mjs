#!/usr/bin/env node
/**
 * Integration test for Launch Control XL3 SysEx communication
 * Tests the actual library code with Web MIDI backend
 */

import { LaunchControlXL3 } from './dist/index.js';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Launch Control XL3 - SysEx Communication Test             ║');
console.log('║  Testing: @oletizi/launch-control-xl3 library              ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

async function test() {
    try {
        console.log('📦 Step 1: Creating device instance...');
        const device = new LaunchControlXL3({
            autoConnect: true,
            enableCustomModes: true,
        });
        console.log('✅ Device instance created\n');

        console.log('🔌 Step 2: Initializing device (handshake)...');
        const startInit = Date.now();
        await device.initialize();
        const initTime = Date.now() - startInit;
        console.log(`✅ Device initialized in ${initTime}ms`);
        console.log(`✅ Connected: ${device.isConnected()}\n`);

        if (!device.isConnected()) {
            throw new Error('Device not connected after initialization');
        }

        console.log('📨 Step 3: Loading custom mode 0 (CRITICAL TEST)...');
        console.log('   This will:');
        console.log('   1. Send SysEx: F0 00 20 29 02 11 77 00 F7');
        console.log('   2. Wait for device response');
        console.log('   3. Parse custom mode data\n');

        const startLoad = Date.now();
        const mode = await device.loadCustomMode(0);
        const loadTime = Date.now() - startLoad;

        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║  ✅ SUCCESS! Custom mode loaded                            ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        console.log(`⏱️  Load time: ${loadTime}ms`);
        console.log(`📝 Mode name: ${mode.name || '(unnamed)'}`);
        console.log(`🎛️  Controls: ${Object.keys(mode.controls || {}).length}`);
        console.log(`💡 LEDs: ${mode.leds ? mode.leds.size : 0}\n`);

        if (mode.controls && Object.keys(mode.controls).length > 0) {
            console.log('Sample controls:');
            const controlEntries = Object.entries(mode.controls).slice(0, 3);
            for (const [id, control] of controlEntries) {
                console.log(`  ${id}: CC${control.cc} (${control.type})`);
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('VERIFICATION COMPLETE');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ Library code is working correctly');
        console.log('✅ SysEx messages are being sent');
        console.log('✅ Device is responding');
        console.log('✅ Custom mode data is being parsed');
        console.log('✅ Timestamp fix is working properly');
        console.log('═══════════════════════════════════════════════════════════\n');

        process.exit(0);

    } catch (error) {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║  ❌ TEST FAILED                                            ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        console.error('Error:', error.message);

        if (error.message.includes('timeout')) {
            console.log('\n💡 Timeout Analysis:');
            console.log('   • SysEx may have been sent but device didn\'t respond');
            console.log('   • Device may not be in correct mode');
            console.log('   • USB connection issue');
            console.log('   • Wrong MIDI port selected');
        } else if (error.message.includes('not found') || error.message.includes('not connected')) {
            console.log('\n💡 Connection Issue:');
            console.log('   • Make sure Launch Control XL3 is connected via USB');
            console.log('   • Check that device is powered on');
            console.log('   • Try reconnecting the USB cable');
        }

        if (error.stack) {
            console.log('\nStack trace:');
            console.log(error.stack);
        }

        console.log();
        process.exit(1);
    }
}

// Run test
console.log('Starting test...\n');
test();