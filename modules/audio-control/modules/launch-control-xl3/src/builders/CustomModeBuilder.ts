/**
 * High-level API for building Launch Control XL 3 custom modes
 * Provides a fluent interface for defining control mappings, labels, and colors
 */

import type { CustomMode, Control, ControlType } from '@/types/CustomMode.js';

export enum Color {
  OFF = 0x0C,
  RED_LOW = 0x0D,
  RED_FULL = 0x0F,
  AMBER_LOW = 0x1D,
  AMBER_FULL = 0x3F,
  YELLOW = 0x3E,
  GREEN_LOW = 0x1C,
  GREEN_FULL = 0x3C
}

interface ControlConfig {
  cc: number;
  channel?: number;
  min?: number;
  max?: number;
}

interface LabelColorData {
  labels: Map<number, string>;
  colors: Map<number, Color>;
}

/**
 * Builder for creating Launch Control XL 3 custom modes
 * Provides a fluent API for defining controls, labels, and colors
 */
export class CustomModeBuilder {
  private modeName: string = '';
  private controls: Control[] = [];
  private labelData: LabelColorData = {
    labels: new Map(),
    colors: new Map()
  };

  /**
   * Set the custom mode name (max 8 characters)
   */
  name(name: string): this {
    if (name.length > 8) {
      throw new Error('Mode name must be 8 characters or less');
    }
    this.modeName = name;
    return this;
  }

  /**
   * Add a fader control mapping
   * @param faderNumber 1-8
   * @param config Control configuration
   */
  addFader(faderNumber: number, config: ControlConfig): this {
    if (faderNumber < 1 || faderNumber > 8) {
      throw new Error('Fader number must be 1-8');
    }

    const controlId = faderNumber - 1; // 0x00-0x07
    this.addControl(controlId, 0x00, config);
    return this;
  }

  /**
   * Add a top row encoder control mapping
   * @param row 1 (always 1 for top row)
   * @param encoderNumber 1-8
   * @param config Control configuration
   */
  addEncoder(row: 1, encoderNumber: number, config: ControlConfig): this;
  /**
   * Add a middle row encoder control mapping
   * @param row 2 (for middle row)
   * @param encoderNumber 1-8
   * @param config Control configuration
   */
  addEncoder(row: 2, encoderNumber: number, config: ControlConfig): this;
  /**
   * Add a bottom row encoder control mapping
   * @param row 3 (for bottom row)
   * @param encoderNumber 1-8
   * @param config Control configuration
   */
  addEncoder(row: 3, encoderNumber: number, config: ControlConfig): this;
  addEncoder(row: 1 | 2 | 3, encoderNumber: number, config: ControlConfig): this {
    if (encoderNumber < 1 || encoderNumber > 8) {
      throw new Error('Encoder number must be 1-8');
    }

    let controlId: number;
    let controlType: ControlType;

    switch (row) {
      case 1: // Top row
        controlId = 0x10 + (encoderNumber - 1); // 0x10-0x17
        controlType = 0x05;
        break;
      case 2: // Middle row
        controlId = 0x18 + (encoderNumber - 1); // 0x18-0x1F
        controlType = 0x09;
        break;
      case 3: // Bottom row
        controlId = 0x20 + (encoderNumber - 1); // 0x20-0x27
        controlType = 0x0D;
        break;
      default:
        throw new Error('Row must be 1, 2, or 3');
    }

    this.addControl(controlId, controlType, config);
    return this;
  }

  /**
   * Add a side button control mapping
   * @param buttonNumber 1-8
   * @param config Control configuration
   */
  addSideButton(buttonNumber: number, config: ControlConfig): this {
    if (buttonNumber < 1 || buttonNumber > 8) {
      throw new Error('Side button number must be 1-8');
    }

    const controlId = 0x28 + (buttonNumber - 1); // 0x28-0x2F
    this.addControl(controlId, 0x19, config);
    return this;
  }

  /**
   * Add a bottom button control mapping
   * @param buttonNumber 1-16
   * @param config Control configuration
   */
  addBottomButton(buttonNumber: number, config: ControlConfig): this {
    if (buttonNumber < 1 || buttonNumber > 16) {
      throw new Error('Bottom button number must be 1-16');
    }

    const controlId = 0x30 + (buttonNumber - 1); // 0x30-0x3F
    this.addControl(controlId, 0x25, config);
    return this;
  }

  /**
   * Add a label for a control
   * @param controlId The hardware control ID (or use helper methods)
   * @param label The label text
   */
  addLabel(controlId: number, label: string): this {
    this.labelData.labels.set(controlId, label);
    return this;
  }

  /**
   * Add a label for a fader
   * @param faderNumber 1-8
   * @param label The label text
   */
  addFaderLabel(faderNumber: number, label: string): this {
    if (faderNumber < 1 || faderNumber > 8) {
      throw new Error('Fader number must be 1-8');
    }
    return this.addLabel(faderNumber - 1, label);
  }

  /**
   * Add a label for an encoder
   * @param row 1, 2, or 3
   * @param encoderNumber 1-8
   * @param label The label text
   */
  addEncoderLabel(row: 1 | 2 | 3, encoderNumber: number, label: string): this {
    if (encoderNumber < 1 || encoderNumber > 8) {
      throw new Error('Encoder number must be 1-8');
    }

    let controlId: number;
    switch (row) {
      case 1:
        controlId = 0x10 + (encoderNumber - 1);
        break;
      case 2:
        controlId = 0x18 + (encoderNumber - 1);
        break;
      case 3:
        controlId = 0x20 + (encoderNumber - 1);
        break;
      default:
        throw new Error('Row must be 1, 2, or 3');
    }

    return this.addLabel(controlId, label);
  }

  /**
   * Add a color for a control
   * @param controlId The hardware control ID
   * @param color The color value
   */
  addColor(controlId: number, color: Color): this {
    this.labelData.colors.set(controlId, color);
    return this;
  }

  /**
   * Add a color for a side button
   * @param buttonNumber 1-8
   * @param color The color value
   */
  addSideButtonColor(buttonNumber: number, color: Color): this {
    if (buttonNumber < 1 || buttonNumber > 8) {
      throw new Error('Side button number must be 1-8');
    }
    return this.addColor(0x28 + (buttonNumber - 1), color);
  }

  /**
   * Add a color for a bottom button
   * @param buttonNumber 1-16
   * @param color The color value
   */
  addBottomButtonColor(buttonNumber: number, color: Color): this {
    if (buttonNumber < 1 || buttonNumber > 16) {
      throw new Error('Bottom button number must be 1-16');
    }
    return this.addColor(0x30 + (buttonNumber - 1), color);
  }

  /**
   * Build the custom mode object
   */
  build(): CustomMode {
    if (!this.modeName) {
      throw new Error('Mode name is required');
    }

    if (this.controls.length === 0) {
      throw new Error('At least one control mapping is required');
    }

    // Sort controls by ID for consistency
    const sortedControls = [...this.controls].sort((a, b) => a.controlId - b.controlId);

    return {
      name: this.modeName,
      controls: sortedControls,
      labels: this.labelData.labels,
      colors: this.labelData.colors
    };
  }

  /**
   * Create a builder pre-configured for a simple test mode
   */
  static createTestMode(): CustomModeBuilder {
    return new CustomModeBuilder()
      .name('TEST')
      .addFader(1, { cc: 10, channel: 1 })
      .addEncoder(1, 1, { cc: 13, channel: 1 })
      .addEncoderLabel(1, 1, 'Filter')
      .addFaderLabel(1, 'Volume');
  }

  /**
   * Create a builder pre-configured for the CHANNEV mode
   */
  static createChannevMode(): CustomModeBuilder {
    const builder = new CustomModeBuilder().name('CHANNEV');

    // Top row encoders (CC 13-20)
    for (let i = 1; i <= 8; i++) {
      builder.addEncoder(1, i, { cc: 12 + i, channel: 1 });
    }

    // Middle row encoders (CC 21-28)
    for (let i = 1; i <= 8; i++) {
      builder.addEncoder(2, i, { cc: 20 + i, channel: 1 });
    }

    // Bottom row encoders (CC 29-36)
    for (let i = 1; i <= 8; i++) {
      builder.addEncoder(3, i, { cc: 28 + i, channel: 1 });
    }

    // Add labels for key controls
    builder
      .addEncoderLabel(1, 1, 'Mic Gain')
      .addEncoderLabel(1, 2, 'Line Amp Gain')
      .addEncoderLabel(1, 4, 'Low Pass')
      .addEncoderLabel(2, 1, 'High Shelf')
      .addEncoderLabel(2, 2, 'Low Freq')
      .addEncoderLabel(2, 3, 'Low Mid Freq')
      .addEncoderLabel(2, 4, 'High Mid Freq')
      .addEncoderLabel(2, 5, 'High Freq')
      .addEncoderLabel(3, 1, 'Low Shelf')
      .addEncoderLabel(3, 2, 'Low Gain')
      .addEncoderLabel(3, 3, 'Low Mid Gain')
      .addEncoderLabel(3, 4, 'High Mid Gain')
      .addEncoderLabel(3, 5, 'High Gain');

    return builder;
  }

  private addControl(controlId: number, controlType: ControlType, config: ControlConfig): void {
    // Check for duplicate control
    if (this.controls.find(c => c.controlId === controlId)) {
      throw new Error(`Control ${controlId.toString(16)} already defined`);
    }

    // Validate CC range
    if (config.cc < 0 || config.cc > 127) {
      throw new Error('CC number must be 0-127');
    }

    // Validate channel
    const channel = config.channel ?? 1;
    if (channel < 1 || channel > 16) {
      throw new Error('MIDI channel must be 1-16');
    }

    const control: Control = {
      controlId,
      controlType,
      midiChannel: channel - 1, // Convert to 0-based
      ccNumber: config.cc,
      minValue: config.min ?? 0,
      maxValue: config.max ?? 127,
      behavior: 'absolute'
    };

    this.controls.push(control);
  }
}