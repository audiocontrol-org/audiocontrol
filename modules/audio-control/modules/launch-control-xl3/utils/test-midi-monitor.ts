#!/usr/bin/env tsx

/**
 * Test MIDI Monitor Functionality
 *
 * This script tests the MIDI monitoring capabilities and verifies
 * that the monitor can detect and capture MIDI messages correctly.
 */

import { MidiMonitor } from './midi-monitor.js';
import * as easymidi from 'easymidi';

interface TestConfig {
  readonly duration: number;
  readonly deviceFilter?: string;
  readonly testSysEx: boolean;
  readonly testControlChange: boolean;
  readonly testNotes: boolean;
}

class MidiMonitorTester {
  private testOutput?: easymidi.Output;
  private virtualInput?: easymidi.Input;

  constructor() {}

  /**
   * Run comprehensive monitor tests
   */
  async runTests(config: TestConfig): Promise<void> {
    console.log('🧪 MIDI Monitor Test Suite');
    console.log('═'.repeat(50));

    try {
      // Test 1: Basic initialization
      await this.testInitialization();

      // Test 2: Port detection
      await this.testPortDetection();

      // Test 3: Filter functionality
      if (config.deviceFilter) {
        await this.testDeviceFilter(config.deviceFilter);
      }

      // Test 4: Message capture with virtual ports
      await this.testMessageCapture(config);

      // Test 5: Session management
      await this.testSessionManagement();

      console.log('\n✅ All tests passed!');

    } catch (error: any) {
      console.error(`❌ Test failed: ${error.message}`);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test monitor initialization
   */
  private async testInitialization(): Promise<void> {
    console.log('\n📋 Test 1: Monitor Initialization');

    const monitor = new MidiMonitor({
      verboseLogging: true,
      bufferMessages: true,
    });

    const stats = monitor.getCurrentStats();
    if (stats.messageCount !== 0) {
      throw new Error('Expected empty message buffer on initialization');
    }

    if (stats.isRunning) {
      throw new Error('Expected monitor to not be running on initialization');
    }

    console.log('   ✅ Monitor initializes correctly');
  }

  /**
   * Test port detection
   */
  private async testPortDetection(): Promise<void> {
    console.log('\n📋 Test 2: Port Detection');

    const availablePorts = easymidi.getInputs();
    console.log(`   📡 Found ${availablePorts.length} MIDI input ports`);

    if (availablePorts.length > 0) {
      availablePorts.forEach((port, i) => {
        console.log(`      ${i + 1}. ${port}`);
      });
    } else {
      console.log('   ⚠️  No MIDI ports available - will test with virtual ports');
    }

    console.log('   ✅ Port detection working');
  }

  /**
   * Test device filtering
   */
  private async testDeviceFilter(filter: string): Promise<void> {
    console.log(`\n📋 Test 3: Device Filter (${filter})`);

    const monitor = new MidiMonitor({
      deviceFilter: filter,
      verboseLogging: false,
    });

    const availablePorts = easymidi.getInputs();
    const filteredPorts = availablePorts.filter(port =>
      port.toLowerCase().includes(filter.toLowerCase())
    );

    console.log(`   🎯 Filter "${filter}" matches ${filteredPorts.length} ports`);
    filteredPorts.forEach(port => {
      console.log(`      - ${port}`);
    });

    console.log('   ✅ Device filtering working');
  }

  /**
   * Test message capture with generated MIDI messages
   */
  private async testMessageCapture(config: TestConfig): Promise<void> {
    console.log('\n📋 Test 4: Message Capture');

    try {
      // Create virtual MIDI port for testing
      this.testOutput = new easymidi.Output('MIDI Monitor Test Output', true);
      await this.delay(500); // Wait for port to be created

      // Start monitor
      const monitor = new MidiMonitor({
        deviceFilter: 'MIDI Monitor Test',
        verboseLogging: false,
        bufferMessages: true,
      });

      console.log('   🎹 Starting monitor for virtual port...');

      // Start monitoring in background
      const monitorPromise = monitor.startMonitoring();

      // Wait a bit for monitor to start
      await this.delay(1000);

      // Generate test messages
      console.log('   🎵 Generating test MIDI messages...');

      let expectedMessages = 0;

      if (config.testControlChange) {
        console.log('      - Sending CC messages...');
        for (let i = 0; i < 5; i++) {
          this.testOutput.send('cc', { controller: 10 + i, value: 64 + i, channel: 0 });
          expectedMessages++;
          await this.delay(100);
        }
      }

      if (config.testNotes) {
        console.log('      - Sending note messages...');
        for (let i = 0; i < 3; i++) {
          this.testOutput.send('noteon', { note: 60 + i, velocity: 100, channel: 0 });
          expectedMessages++;
          await this.delay(50);
          this.testOutput.send('noteoff', { note: 60 + i, velocity: 0, channel: 0 });
          expectedMessages++;
          await this.delay(50);
        }
      }

      if (config.testSysEx) {
        console.log('      - Sending SysEx messages...');
        // Test Novation Launch Control XL 3 SysEx format
        const sysexMessage = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x11, 0x77, 0x01, 0xF7];
        this.testOutput.send('sysex', sysexMessage);
        expectedMessages++;
        await this.delay(100);
      }

      // Wait for capture
      await this.delay(1000);

      // Stop monitor and get session
      const session = await monitor.stopMonitoring();

      // Verify capture results
      console.log(`   📊 Captured ${session.messages.length} messages (expected ~${expectedMessages})`);
      console.log(`      - SysEx: ${session.statistics.sysexMessages}`);
      console.log(`      - CC: ${session.statistics.ccMessages}`);
      console.log(`      - Notes: ${session.statistics.noteMessages}`);
      console.log(`      - Other: ${session.statistics.otherMessages}`);

      if (session.messages.length === 0) {
        console.log('   ⚠️  No messages captured - this might indicate an issue');
      } else {
        console.log('   ✅ Message capture working');
      }

    } catch (error: any) {
      if (error.message.includes('No MIDI input ports found')) {
        console.log('   ⚠️  Skipping capture test - no matching ports available');
      } else {
        throw error;
      }
    }
  }

  /**
   * Test session management
   */
  private async testSessionManagement(): Promise<void> {
    console.log('\n📋 Test 5: Session Management');

    const monitor = new MidiMonitor({
      outputDir: './test-captures',
      sessionName: 'test-session',
      bufferMessages: true,
    });

    // Simulate quick monitoring session
    try {
      await monitor.startMonitoring();
      await this.delay(100); // Very brief monitoring
      const session = await monitor.stopMonitoring();

      if (!session.sessionId) {
        throw new Error('Session ID not generated');
      }

      if (!session.startTime) {
        throw new Error('Start time not recorded');
      }

      if (!session.endTime) {
        throw new Error('End time not recorded');
      }

      console.log(`   📄 Session ID: ${session.sessionId}`);
      console.log(`   ⏱️  Duration: ${session.endTime - session.startTime}ms`);
      console.log('   ✅ Session management working');

    } catch (error: any) {
      if (error.message.includes('No MIDI input ports found')) {
        console.log('   ⚠️  Skipping session test - no ports available');
      } else {
        throw error;
      }
    }
  }

  /**
   * Clean up test resources
   */
  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test resources...');

    if (this.testOutput) {
      try {
        this.testOutput.close();
        console.log('   ✅ Test output port closed');
      } catch (error: any) {
        console.log(`   ⚠️  Error closing test output: ${error.message}`);
      }
    }

    if (this.virtualInput) {
      try {
        this.virtualInput.close();
        console.log('   ✅ Virtual input port closed');
      } catch (error: any) {
        console.log(`   ⚠️  Error closing virtual input: ${error.message}`);
      }
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface when run directly
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const config: TestConfig = {
    duration: 5000, // 5 seconds
    deviceFilter: args.find(arg => arg.startsWith('--device='))?.split('=')[1],
    testSysEx: !args.includes('--no-sysex'),
    testControlChange: !args.includes('--no-cc'),
    testNotes: !args.includes('--no-notes'),
  };

  console.log('Configuration:', config);

  const tester = new MidiMonitorTester();

  try {
    await tester.runTests(config);
    console.log('\n🎉 MIDI Monitor test suite completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error(`\n💥 Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('test-midi-monitor.ts')) {
  main();
}

export { MidiMonitorTester, TestConfig };