/**
 * DAW Port Controller for Launch Control XL3
 *
 * Handles out-of-band communication via the DAW port for:
 * - Slot selection before writing custom modes
 * - Mode switching and other control messages
 */

export interface DawPortController {
  selectSlot(slot: number): Promise<void>;
  sendNoteNotification(): Promise<void>;
}

export class DawPortControllerImpl implements DawPortController {
  constructor(
    private sendMessage: (message: number[]) => Promise<void>
  ) {}

  /**
   * Select the active slot for subsequent write operations
   * @param slot 0-based slot index (0-14 for slots 1-15)
   */
  async selectSlot(slot: number): Promise<void> {
    if (slot < 0 || slot > 14) {
      throw new Error(`Invalid slot: ${slot}. Must be 0-14`);
    }

    // The web editor sends:
    // 1. Note On (note 11, velocity 127, channel 15)
    // 2. CC 30 on channel 6, value = physical slot + 5
    // 3. Note Off (note 11, velocity 0, channel 15)

    // Physical slot is 1-based, so add 1 to the 0-based slot
    const physicalSlot = slot + 1;
    const ccValue = physicalSlot + 5; // Slot 1 = CC value 6, Slot 2 = CC value 7, etc.

    // Note On: note 11, velocity 127, channel 15
    await this.sendMessage([0x9F, 11, 127]); // 0x9F = Note On channel 15

    // CC: controller 30, value, channel 6
    await this.sendMessage([0xB5, 30, ccValue]); // 0xB5 = CC channel 5 (0-based)

    // Note Off: note 11, velocity 0, channel 15
    await this.sendMessage([0x9F, 11, 0]); // Velocity 0 = Note Off

    // Give the device time to process the selection
    await new Promise(resolve => setTimeout(resolve, 50));
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