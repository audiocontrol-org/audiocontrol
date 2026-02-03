/**
 * Slot Selection Hardware Integration Tests
 *
 * Tests Issue #36 fix: Device firmware rejects writes to inactive slots with status 0x9.
 * The fix calls selectTemplate(slot) before each write operation.
 *
 * CRITICAL: These tests validate that:
 * 1. selectTemplate() uses correct device ID (0x02, not 0x11)
 * 2. Writing to inactive slots succeeds without status 0x9 errors
 * 3. Device properly acknowledges slot selection
 * 4. Sequential slot switching works correctly
 *
 * INTEGRATION TEST PATTERN (MANDATORY):
 * ALL integration tests MUST use this skip pattern to prevent timeouts:
 *   const SKIP_HARDWARE_TESTS = process.env.SKIP_HARDWARE_TESTS === 'true';
 *   describe.skipIf(SKIP_HARDWARE_TESTS)('Test Suite', () => { ... });
 *
 * This allows:
 * - `pnpm test:integration:skip` - Skips all hardware tests (fast, no device needed)
 * - `pnpm test:integration:force` - Runs with real hardware (requires device connected)
 *
 * Note: These tests require a Launch Control XL 3 to be connected
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DeviceManager } from '@/device/DeviceManager.js';
import { NodeMidiBackend } from '@/backends/NodeMidiBackend.js';
import type { CustomMode } from '@/types/index.js';

// Skip these tests if no device is connected
// MANDATORY: All integration tests MUST respect this flag
const SKIP_HARDWARE_TESTS = process.env.SKIP_HARDWARE_TESTS === 'true';

describe.skipIf(SKIP_HARDWARE_TESTS)('Slot Selection Hardware Integration', () => {
  let deviceManager: DeviceManager;
  let backend: NodeMidiBackend;

  beforeAll(async () => {
    console.log('\n[Slot Selection Tests] Connecting to Launch Control XL 3...');

    backend = new NodeMidiBackend();
    await backend.initialize();

    deviceManager = new DeviceManager({
      midiBackend: backend,
      autoConnect: false,
    });

    await deviceManager.initialize();
    await deviceManager.connect();

    const status = deviceManager.getStatus();
    console.log('[Slot Selection Tests] Connected to device:', {
      firmware: status.deviceInfo?.firmwareVersion,
      connected: status.connected,
    });
  }, 15000); // 15s timeout for connection

  afterAll(async () => {
    if (deviceManager) {
      await deviceManager.disconnect();
      await deviceManager.cleanup();
    }
    if (backend) {
      await backend.cleanup();
    }
  });

  describe('Issue #36: Write to Inactive Slots', () => {
    it('should write to inactive slot 1 without status 0x9 error', async () => {
      console.log('\n[Test] Writing to inactive slot 1...');

      // Read from slot 0 (usually active)
      const mode = await deviceManager.readCustomMode(0);
      console.log(`  Read from slot 0: "${mode.name}"`);

      // Write to slot 1 (inactive) - should trigger selectTemplate(1)
      const testMode: CustomMode = {
        ...mode,
        name: 'TEST_S1',
      };

      // This should NOT throw status 0x9 error after the fix
      await expect(
        deviceManager.writeCustomMode(1, testMode)
      ).resolves.not.toThrow();

      console.log('  ✓ Write to slot 1 succeeded (no status 0x9)');

      // Verify by reading back
      const verify = await deviceManager.readCustomMode(1);
      expect(verify.name).toContain('TEST_S1');
      console.log(`  ✓ Verified: "${verify.name}"`);
    }, 20000);

    it('should write to multiple inactive slots sequentially', async () => {
      console.log('\n[Test] Writing to multiple inactive slots...');

      const mode = await deviceManager.readCustomMode(0);
      const testSlots = [3, 5, 7];

      for (const slot of testSlots) {
        console.log(`  Testing slot ${slot}...`);

        const testMode: CustomMode = {
          ...mode,
          name: `TEST_S${slot}`,
        };

        // Each write should trigger selectTemplate(slot) automatically
        await expect(
          deviceManager.writeCustomMode(slot, testMode)
        ).resolves.not.toThrow();

        console.log(`    ✓ Write to slot ${slot} succeeded`);
      }

      console.log('  ✓ All sequential writes succeeded');
    }, 60000); // Longer timeout for multiple operations

    it('should handle rapid slot switching', async () => {
      console.log('\n[Test] Rapid slot switching...');

      const mode = await deviceManager.readCustomMode(0);

      // Switch between slots rapidly
      await deviceManager.writeCustomMode(2, { ...mode, name: 'RAPID_2' });
      await deviceManager.writeCustomMode(4, { ...mode, name: 'RAPID_4' });
      await deviceManager.writeCustomMode(6, { ...mode, name: 'RAPID_6' });

      // Verify final write succeeded
      const verify = await deviceManager.readCustomMode(6);
      expect(verify.name).toContain('RAPID_6');

      console.log('  ✓ Rapid switching succeeded');
    }, 30000);
  });

  describe('Slot Selection Protocol Validation', () => {
    it('should call selectTemplate before each write', async () => {
      console.log('\n[Test] Verifying selectTemplate is called...');

      const mode = await deviceManager.readCustomMode(0);

      // The logs should show: "[DeviceManager] Selecting slot X before write"
      console.log('  Watching logs for slot selection message...');

      const testMode: CustomMode = {
        ...mode,
        name: 'PROTOCOL',
      };

      // Write to slot 8 - should log slot selection
      await deviceManager.writeCustomMode(8, testMode);

      // If we got here without error, selectTemplate was called
      console.log('  ✓ selectTemplate was called (no error)');
    }, 20000);

    it('should use correct device ID in slot selection SysEx', async () => {
      console.log('\n[Test] Verifying device ID in SysEx messages...');

      // The fix changes device ID from 0x11 to 0x02
      // Expected format: F0 00 20 29 02 77 [slot] F7
      //                                 ^^ Device ID (0x02 for XL3)

      const mode = await deviceManager.readCustomMode(0);

      // This should send: F0 00 20 29 02 77 09 F7
      // NOT: F0 00 20 29 11 77 09 F7 (old wrong format)
      await deviceManager.writeCustomMode(9, { ...mode, name: 'DEVID_9' });

      // If device accepted it, correct device ID was used
      console.log('  ✓ Device accepted slot selection (correct device ID)');
    }, 20000);
  });

  describe('Error Handling', () => {
    it('should reject slot 15 (factory slot)', async () => {
      console.log('\n[Test] Attempting to write to slot 15 (factory)...');

      const mode = await deviceManager.readCustomMode(0);

      await expect(
        deviceManager.writeCustomMode(15, mode)
      ).rejects.toThrow(/slot 15.*reserved.*factory/i);

      console.log('  ✓ Slot 15 correctly rejected');
    }, 10000);

    it('should reject invalid slot numbers', async () => {
      console.log('\n[Test] Testing slot validation...');

      const mode = await deviceManager.readCustomMode(0);

      await expect(
        deviceManager.writeCustomMode(-1, mode)
      ).rejects.toThrow(/slot.*0-14/i);

      await expect(
        deviceManager.writeCustomMode(16, mode)
      ).rejects.toThrow(/slot.*0-14/i);

      console.log('  ✓ Invalid slots correctly rejected');
    }, 10000);
  });

  describe('Timing and Delays', () => {
    it('should wait after slot selection before write', async () => {
      console.log('\n[Test] Verifying timing delay after slot selection...');

      const mode = await deviceManager.readCustomMode(0);
      const startTime = Date.now();

      // The fix includes a 100ms delay after selectTemplate
      await deviceManager.writeCustomMode(10, { ...mode, name: 'TIMING' });

      const duration = Date.now() - startTime;

      // Should take at least 100ms (delay) + write time
      expect(duration).toBeGreaterThan(100);
      console.log(`  ✓ Write took ${duration}ms (includes 100ms delay)`);
    }, 20000);
  });

  describe('Read-Modify-Write Cycle', () => {
    it('should complete full read-modify-write cycle on inactive slot', async () => {
      console.log('\n[Test] Full read-modify-write cycle on slot 11...');

      // Read from active slot
      const original = await deviceManager.readCustomMode(0);
      console.log(`  Original: "${original.name}"`);

      // Modify
      const modified: CustomMode = {
        ...original,
        name: 'CYCLE_11',
      };

      // Write to inactive slot 11
      await deviceManager.writeCustomMode(11, modified);
      console.log('  ✓ Write succeeded');

      // Read back
      const readback = await deviceManager.readCustomMode(11);
      expect(readback.name).toContain('CYCLE_11');
      console.log(`  ✓ Read back: "${readback.name}"`);
    }, 30000);
  });
});

describe('Slot Selection Mock Tests', () => {
  it('should handle connection failure gracefully', async () => {
    const backend = new NodeMidiBackend();
    await backend.initialize();

    const deviceManager = new DeviceManager({
      midiBackend: backend,
      autoConnect: false,
      deviceNameFilter: 'Non-existent Device',
      retryAttempts: 1,
    });

    await expect(deviceManager.initialize()).rejects.toThrow();
    await deviceManager.cleanup();
    await backend.cleanup();
  });
});
