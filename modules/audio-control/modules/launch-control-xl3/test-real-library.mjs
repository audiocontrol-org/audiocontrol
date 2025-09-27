import { LaunchControlXL3 } from './dist/index.js';

console.log('Testing actual library with Web MIDI backend...\n');

async function test() {
    try {
        console.log('Creating device instance...');
        const device = new LaunchControlXL3({
            autoConnect: true,
            enableCustomModes: true,
            backend: 'web-midi'
        });
        
        console.log('Initializing device...');
        await device.initialize();
        
        console.log('✓ Device initialized');
        console.log('✓ Connected:', device.isConnected());
        
        console.log('\nAttempting to load custom mode 0...');
        const mode = await device.loadCustomMode(0);
        
        console.log('\n✓✓✓ SUCCESS! Custom mode loaded:');
        console.log('  Template:', mode.template);
        console.log('  Controls:', mode.controls?.length || 0);
        
    } catch (error) {
        console.error('\n✗ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

test();
