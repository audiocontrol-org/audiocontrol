/**
 * Launch Control XL 3 MIDI client for Web MIDI API
 */

import {
  SlotNumber,
  CustomMode,
  ControlDefinition,
  buildReadRequest,
  MANUFACTURER_ID,
  DEVICE_ID,
  DataType,
  SysExCommand,
  SysExSubCommand,
  encodeSlot,
  encodeChannel,
} from './types';

import {
  eightToSeven,
  sevenToEight,
  encodeString,
  encodeControl,
  splitIntoSysExMessages,
  validateSysEx,
  chunkSysEx,
} from './midimunge';

export class LaunchControlXL3Client {
  private midiAccess: MIDIAccess | null = null;
  private midiInput: MIDIInput | null = null;
  private midiOutput: MIDIOutput | null = null;
  private dawInput: MIDIInput | null = null;
  private dawOutput: MIDIOutput | null = null;

  /**
   * Initialize MIDI connection to Launch Control XL 3
   */
  async connect(): Promise<void> {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API not supported in this browser');
    }

    this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });

    // Find Launch Control XL 3 ports
    this.midiAccess.inputs.forEach((input) => {
      if (input.name?.includes('LCXL3 1 MIDI Out')) {
        this.midiInput = input;
      } else if (input.name?.includes('LCXL3 1 DAW Out')) {
        this.dawInput = input;
      }
    });

    this.midiAccess.outputs.forEach((output) => {
      if (output.name?.includes('LCXL3 1 MIDI In')) {
        this.midiOutput = output;
      } else if (output.name?.includes('LCXL3 1 DAW In')) {
        this.dawOutput = output;
      }
    });

    if (!this.midiOutput || !this.midiInput) {
      throw new Error('Launch Control XL 3 not found. Please connect the device.');
    }

    // Set up input listeners
    this.setupInputListeners();
  }

  /**
   * Set up listeners for incoming MIDI messages
   */
  private setupInputListeners(): void {
    if (this.midiInput) {
      this.midiInput.onmidimessage = (event) => {
        this.handleMidiMessage(event);
      };
    }

    if (this.dawInput) {
      this.dawInput.onmidimessage = (event) => {
        this.handleDawMessage(event);
      };
    }
  }

  /**
   * Handle incoming MIDI messages from the device
   */
  private handleMidiMessage(event: MIDIMessageEvent): void {
    const data = Array.from(event.data);

    // Check if it's a SysEx message
    if (data[0] === 0xF0) {
      this.handleSysExResponse(new Uint8Array(data));
    } else if (data[0] >= 0xB0 && data[0] <= 0xBF) {
      // Control Change message
      const channel = data[0] & 0x0F;
      const cc = data[1];
      const value = data[2];
      this.onControlChange?.(channel, cc, value);
    } else if (data[0] >= 0x90 && data[0] <= 0x9F) {
      // Note On message (button press)
      const channel = data[0] & 0x0F;
      const note = data[1];
      const velocity = data[2];
      this.onNoteOn?.(channel, note, velocity);
    }
  }

  /**
   * Handle DAW-specific messages
   */
  private handleDawMessage(event: MIDIMessageEvent): void {
    // DAW port handling if needed
  }

  /**
   * Handle SysEx response from device
   */
  private handleSysExResponse(data: Uint8Array): void {
    if (!validateSysEx(data)) {
      console.error('Invalid SysEx response received');
      return;
    }

    // Check if it's a response to our read request
    if (
      data[1] === MANUFACTURER_ID[0] &&
      data[2] === MANUFACTURER_ID[1] &&
      data[3] === MANUFACTURER_ID[2] &&
      data[4] === DEVICE_ID
    ) {
      // This is a message from our device
      const command = data[5];
      const subCommand = data[6];

      if (
        command === SysExCommand.CUSTOM_MODE &&
        subCommand === SysExSubCommand.CUSTOM_MODE_DATA
      ) {
        // Custom mode data response
        this.handleCustomModeResponse(data);
      }
    }
  }

  /**
   * Handle custom mode data response
   */
  private handleCustomModeResponse(data: Uint8Array): void {
    // Parse the custom mode data
    // This would need proper implementation based on actual response format
    console.log('Received custom mode data:', data);
  }

  /**
   * Read a custom mode from the device
   */
  async readCustomMode(slot: SlotNumber): Promise<CustomMode | null> {
    if (!this.midiOutput) {
      throw new Error('Not connected to device');
    }

    // Send read request
    const request = buildReadRequest(slot);
    this.midiOutput.send(request);

    // Wait for response
    // In a real implementation, this would use promises and event handling
    return new Promise((resolve) => {
      setTimeout(() => {
        // Timeout if no response
        resolve(null);
      }, 1000);
    });
  }

  /**
   * Write a custom mode to the device
   */
  async writeCustomMode(slot: SlotNumber, mode: CustomMode): Promise<void> {
    if (!this.midiOutput) {
      throw new Error('Not connected to device');
    }

    // Build the custom mode data
    const data = this.buildCustomModeData(slot, mode);

    // Apply 7-bit encoding
    const encoded = eightToSeven(data);

    // Split into SysEx messages
    const messages = this.buildWriteMessages(slot, mode, encoded);

    // Send each message with a small delay
    for (const message of messages) {
      this.midiOutput.send(message);
      await this.delay(50); // Small delay between messages
    }
  }

  /**
   * Build custom mode data bytes
   */
  private buildCustomModeData(slot: SlotNumber, mode: CustomMode): Uint8Array {
    const data: number[] = [];

    // Add mode name
    const nameBytes = encodeString(mode.name);
    data.push(nameBytes.length);
    data.push(...nameBytes);

    // Add each control definition
    for (const control of mode.controls) {
      const controlBytes = encodeControl(
        control.id,
        control.type,
        encodeChannel(control.channel),
        control.ccNumber,
        control.minValue,
        control.maxValue
      );

      data.push(...controlBytes);

      // Add control name
      const controlNameBytes = encodeString(control.name);
      data.push(controlNameBytes.length);
      data.push(...controlNameBytes);
    }

    return new Uint8Array(data);
  }

  /**
   * Build SysEx write messages
   */
  private buildWriteMessages(
    slot: SlotNumber,
    mode: CustomMode,
    encodedData: Uint8Array
  ): Uint8Array[] {
    const messages: Uint8Array[] = [];
    const maxPayloadSize = 500; // Approximate max size per message
    let offset = 0;
    let messageIndex = 0;

    while (offset < encodedData.length) {
      const chunkSize = Math.min(maxPayloadSize, encodedData.length - offset);
      const chunk = encodedData.slice(offset, offset + chunkSize);

      const message = new Uint8Array([
        0xF0, // SysEx start
        ...MANUFACTURER_ID,
        DEVICE_ID,
        SysExCommand.CUSTOM_MODE,
        SysExSubCommand.CUSTOM_MODE_DATA,
        0x00, // Reserved
        DataType.WRITE,
        messageIndex === 0 ? encodeSlot(slot) : messageIndex + 2, // Slot or continuation
        0x02,
        0x20,
        0x05,
        ...chunk,
        0xF7, // SysEx end
      ]);

      messages.push(message);
      offset += chunkSize;
      messageIndex++;
    }

    return messages;
  }

  /**
   * Send LED update to button
   */
  async setButtonLED(button: number, color: number): Promise<void> {
    if (!this.midiOutput) {
      throw new Error('Not connected to device');
    }

    // Note: LED protocol needs to be discovered
    // This is a placeholder based on common patterns
    const message = new Uint8Array([0x90, button, color]);
    this.midiOutput.send(message);
  }

  /**
   * Disconnect from device
   */
  disconnect(): void {
    if (this.midiInput) {
      this.midiInput.onmidimessage = null;
      this.midiInput = null;
    }

    if (this.dawInput) {
      this.dawInput.onmidimessage = null;
      this.dawInput = null;
    }

    this.midiOutput = null;
    this.dawOutput = null;
    this.midiAccess = null;
  }

  /**
   * Helper function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Event callbacks (to be set by user)
  onControlChange?: (channel: number, cc: number, value: number) => void;
  onNoteOn?: (channel: number, note: number, velocity: number) => void;
  onCustomModeReceived?: (mode: CustomMode) => void;
  onDeviceReady?: () => void;
  onDeviceDisconnected?: () => void;
}

/**
 * Example usage
 */
export async function example() {
  const client = new LaunchControlXL3Client();

  try {
    // Connect to device
    await client.connect();
    console.log('Connected to Launch Control XL 3');

    // Set up event handlers
    client.onControlChange = (channel, cc, value) => {
      console.log(`Control Change: Channel ${channel}, CC ${cc}, Value ${value}`);
    };

    client.onNoteOn = (channel, note, velocity) => {
      console.log(`Button Press: Channel ${channel}, Note ${note}, Velocity ${velocity}`);
    };

    // Read a custom mode from slot 3
    const mode = await client.readCustomMode(3);
    if (mode) {
      console.log('Custom mode from slot 3:', mode);
    }

    // Create and write a custom mode
    const newMode: CustomMode = {
      name: 'My Custom Mode',
      controls: [
        {
          id: 0x10,
          type: 0x19, // Encoder
          name: 'Filter Cutoff',
          channel: 1,
          ccNumber: 74,
          minValue: 0,
          maxValue: 127,
        },
        // ... more controls
      ],
    };

    // Write to slot 1
    await client.writeCustomMode(1, newMode);
    console.log('Custom mode written to slot 1');
  } catch (error) {
    console.error('Error:', error);
  }
}