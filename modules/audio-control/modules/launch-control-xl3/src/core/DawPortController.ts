/**
 * DAW Port Controller for Launch Control XL3
 *
 * Handles out-of-band communication via the DAW port for:
 * - Slot selection before writing custom modes
 * - Mode switching and other control messages
 *
 * Protocol discovered from web editor:
 * 1. Send Note On (ch16, note 11, vel 127)
 * 2. Send CC query (ch8, controller 30, value 0) to request current slot
 * 3. Device responds with current slot via CC (ch7, controller 30, value)
 * 4. Send Note Off
 * 5. Send Note On again
 * 6. Send CC selection (ch7, controller 30, target slot value)
 * 7. Send Note Off
 *
 * Slot values: Slot 1 = 6, Slot 2 = 7, Slot 3 = 8, etc.
 */

export interface DawPortController {
  selectSlot(slot: number): Promise<void>;
  sendNoteNotification(): Promise<void>;
}

export class DawPortControllerImpl implements DawPortController {
  constructor(
    private sendMessage: (message: number[]) => Promise<void>,
    private waitForMessage?: (predicate: (data: number[]) => boolean, timeout: number) => Promise<number[]>
  ) {}

  /**
   * Select the active slot for subsequent write operations
   * @param slot 0-based slot index (0-14 for slots 1-15)
   */
  async selectSlot(slot: number): Promise<void> {
    if (slot < 0 || slot > 14) {
      throw new Error(`Invalid slot: ${slot}. Must be 0-14`);
    }

    // Physical slot is 1-based, so add 1 to the 0-based slot
    const physicalSlot = slot + 1;
    const ccValue = physicalSlot + 5; // Slot 1 = CC value 6, Slot 2 = CC value 7, etc.

    console.log(`[DawPortController] Selecting slot ${slot} (physical ${physicalSlot}, CC value ${ccValue})`);

    // Phase 1: Query current slot
    // Note On: note 11, velocity 127, channel 16
    console.log('[DawPortController] Phase 1: Sending Note On ch16');
    await this.sendMessage([0x9F, 11, 127]); // 0x9F = Note On channel 16 (15 in 0-based)

    // CC Query: controller 30, value 0, channel 8
    console.log('[DawPortController] Phase 1: Sending CC query on ch8');
    await this.sendMessage([0xB7, 30, 0]); // 0xB7 = CC channel 8 (7 in 0-based)

    // Wait for device response if we have a wait function
    if (this.waitForMessage) {
      try {
        console.log('[DawPortController] Waiting for device CC response...');
        const response = await this.waitForMessage(
          (data) => {
            // Looking for CC on channel 7, controller 30
            return data.length === 3 &&
                   data[0] === 0xB6 && // CC channel 7
                   data[1] === 30;
          },
          100 // 100ms timeout
        );
        if (response && response.length > 2 && response[2] !== undefined) {
          const currentSlot = response[2] - 5; // Convert CC value back to 0-based slot
          console.log(`[DawPortController] Device reports current slot: ${currentSlot}`);
        }
      } catch (error) {
        console.log('[DawPortController] No response from device (might not be in interactive mode)');
      }
    }

    // Note Off: note 11, velocity 0, channel 16
    console.log('[DawPortController] Phase 1: Sending Note Off ch16');
    await this.sendMessage([0x9F, 11, 0]);

    // Small delay between phases
    await new Promise(resolve => setTimeout(resolve, 10));

    // Phase 2: Set target slot
    // Note On again
    console.log('[DawPortController] Phase 2: Sending Note On ch16');
    await this.sendMessage([0x9F, 11, 127]);

    // CC Selection: controller 30, target value, channel 7
    console.log(`[DawPortController] Phase 2: Sending CC selection on ch7, value ${ccValue}`);
    await this.sendMessage([0xB6, 30, ccValue]); // 0xB6 = CC channel 7 (6 in 0-based)

    // Note Off
    console.log('[DawPortController] Phase 2: Sending Note Off ch16');
    await this.sendMessage([0x9F, 11, 0]);

    // Wait for device acknowledgment if we have a wait function
    if (this.waitForMessage) {
      try {
        console.log('[DawPortController] Waiting for slot change acknowledgment...');
        const ackResponse = await this.waitForMessage(
          (data) => {
            // Looking for CC on channel 7, controller 30, with our target value
            return data.length === 3 &&
                   data[0] === 0xB6 && // CC channel 7
                   data[1] === 30 &&
                   data[2] === ccValue; // Should match our selection
          },
          200 // 200ms timeout
        );
        if (ackResponse && ackResponse.length > 2) {
          console.log(`[DawPortController] Slot change confirmed: ${slot} (CC ${ccValue})`);
        }
      } catch (error) {
        console.log('[DawPortController] No acknowledgment received (proceeding anyway)');
      }
    }
  }

  /**
   * Send a note notification (might be used for mode changes)
   */
  async sendNoteNotification(): Promise<void> {
    // Just the note on/off pattern without CC
    await this.sendMessage([0x9F, 11, 127]);
    await this.sendMessage([0x9F, 11, 0]);
  }
}