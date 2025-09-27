/**
 * LED Controller for Launch Control XL 3
 *
 * Manages LED states, colors, and animations for all controls
 * on the Launch Control XL 3 device.
 */

import { EventEmitter } from 'eventemitter3';
import { DeviceManager } from '../device/DeviceManager.js';
import { SysExParser } from '../core/SysExParser.js';
import { LedColor, LedBehaviour } from '../types/index.js';

export interface LedControllerOptions {
  deviceManager: DeviceManager;
  enableAnimations?: boolean;
  animationFrameRate?: number;
  enableColorCorrection?: boolean;
}

export interface LedState {
  controlId: string;
  color: LedColor;
  behaviour: LedBehaviour;
  brightness?: number;
  active: boolean;
}

export interface LedAnimation {
  type: 'fade' | 'pulse' | 'flash' | 'rainbow' | 'chase' | 'custom';
  duration: number;
  repeat?: number | 'infinite';
  controls?: string[];
  colors?: LedColor[];
  callback?: (frame: number) => void;
}

export interface LedControllerEvents {
  'led:changed': (controlId: string, state: LedState) => void;
  'led:batch': (states: LedState[]) => void;
  'animation:started': (animation: LedAnimation) => void;
  'animation:completed': (animation: LedAnimation) => void;
  'error': (error: Error) => void;
}

/**
 * LED color definitions with velocity values
 */
export const LED_COLOR_VALUES = {
  OFF: 0x0C,

  // Red colors
  RED_LOW: 0x0D,
  RED_MEDIUM: 0x0E,
  RED_FULL: 0x0F,

  // Amber colors
  AMBER_LOW: 0x1D,
  AMBER_MEDIUM: 0x2E,
  AMBER_FULL: 0x3F,

  // Yellow colors
  YELLOW_LOW: 0x2D,
  YELLOW_FULL: 0x3E,

  // Green colors
  GREEN_LOW: 0x1C,
  GREEN_MEDIUM: 0x2C,
  GREEN_FULL: 0x3C,
} as const;

/**
 * Control ID to note mapping for LED control
 */
export const LED_NOTE_MAP = {
  // Track focus buttons (top row)
  FOCUS1: 0x29, FOCUS2: 0x2A, FOCUS3: 0x2B, FOCUS4: 0x2C,
  FOCUS5: 0x2D, FOCUS6: 0x2E, FOCUS7: 0x2F, FOCUS8: 0x30,

  // Track control buttons (bottom row)
  CONTROL1: 0x39, CONTROL2: 0x3A, CONTROL3: 0x3B, CONTROL4: 0x3C,
  CONTROL5: 0x3D, CONTROL6: 0x3E, CONTROL7: 0x3F, CONTROL8: 0x40,

  // Side buttons
  DEVICE: 0x69, MUTE: 0x6A, SOLO: 0x6B, RECORD: 0x6C,
  UP: 0x68, DOWN: 0x6D, LEFT: 0x6E, RIGHT: 0x6F,

  // Send select buttons (not on all models)
  SEND_SELECT_UP: 0x2E, SEND_SELECT_DOWN: 0x2F,
} as const;

/**
 * LED Controller
 */
export class LedController extends EventEmitter {
  private deviceManager: DeviceManager;
  private options: Required<LedControllerOptions>;
  private ledStates: Map<string, LedState> = new Map();
  private animations: Map<string, LedAnimation> = new Map();
  private animationTimers: Map<string, NodeJS.Timeout> = new Map();
  private animationFrames: Map<string, number> = new Map();

  constructor(options: LedControllerOptions) {
    super();

    this.deviceManager = options.deviceManager;
    this.options = {
      deviceManager: options.deviceManager,
      enableAnimations: options.enableAnimations ?? true,
      animationFrameRate: options.animationFrameRate ?? 30,
      enableColorCorrection: options.enableColorCorrection ?? false,
    };

    this.initializeLedStates();
  }

  /**
   * Initialize LED states for all controls
   */
  private initializeLedStates(): void {
    // Initialize all button LEDs as off
    for (const [controlId, _noteValue] of Object.entries(LED_NOTE_MAP)) {
      this.ledStates.set(controlId, {
        controlId,
        color: LED_COLOR_VALUES.OFF as any,
        behaviour: 'static',
        active: false,
        brightness: 0,
      });
    }
  }

  /**
   * Set LED color and behaviour
   */
  async setLed(
    controlId: string,
    color: LedColor | number,
    behaviour: LedBehaviour = 'static'
  ): Promise<void> {
    const noteValue = this.getLedNoteValue(controlId);
    if (noteValue === undefined) {
      throw new Error(`Invalid control ID for LED: ${controlId}`);
    }

    // Convert color to velocity value if needed
    const colorValue = typeof color === 'number' ? color : this.getColorValue(color);

    // Apply color correction if enabled
    const correctedColor = this.options.enableColorCorrection
      ? this.applyColorCorrection(colorValue)
      : colorValue;

    // Build and send SysEx message
    const message = SysExParser.buildLedControl(noteValue, correctedColor, behaviour);
    await this.deviceManager.sendSysEx(message);

    // Update internal state
    const state: LedState = {
      controlId,
      color: color as LedColor,
      behaviour,
      active: colorValue !== LED_COLOR_VALUES.OFF,
      brightness: this.getBrightness(colorValue),
    };

    this.ledStates.set(controlId, state);
    this.emit('led:changed', controlId, state);
  }

  /**
   * Set multiple LEDs at once
   */
  async setMultipleLeds(updates: Array<{
    controlId: string;
    color: LedColor | number;
    behaviour?: LedBehaviour;
  }>): Promise<void> {
    const states: LedState[] = [];

    for (const update of updates) {
      await this.setLed(update.controlId, update.color, update.behaviour);

      const state = this.ledStates.get(update.controlId);
      if (state) {
        states.push(state);
      }
    }

    this.emit('led:batch', states);
  }

  /**
   * Turn off a single LED
   */
  async turnOff(controlId: string): Promise<void> {
    await this.setLed(controlId, LED_COLOR_VALUES.OFF, 'static');
  }

  /**
   * Turn off all LEDs
   */
  async turnOffAll(): Promise<void> {
    const message = SysExParser.buildLedReset();
    await this.deviceManager.sendSysEx(message);

    // Update all states to off
    for (const [_controlId, state] of this.ledStates.entries()) {
      state.color = LED_COLOR_VALUES.OFF as any;
      state.behaviour = 'static';
      state.active = false;
      state.brightness = 0;
    }
  }

  /**
   * Flash an LED
   */
  async flashLed(
    controlId: string,
    color: LedColor | number,
    duration: number = 100
  ): Promise<void> {
    await this.setLed(controlId, color, 'flash');

    if (duration > 0) {
      setTimeout(() => {
        this.turnOff(controlId);
      }, duration);
    }
  }

  /**
   * Pulse an LED
   */
  async pulseLed(
    controlId: string,
    color: LedColor | number
  ): Promise<void> {
    await this.setLed(controlId, color, 'pulse');
  }

  /**
   * Start an animation
   */
  startAnimation(id: string, animation: LedAnimation): void {
    if (!this.options.enableAnimations) {
      return;
    }

    // Stop existing animation with same ID
    this.stopAnimation(id);

    this.animations.set(id, animation);
    this.animationFrames.set(id, 0);

    const frameInterval = 1000 / this.options.animationFrameRate;
    let repeatCount = 0;

    const animate = () => {
      const frame = this.animationFrames.get(id) ?? 0;

      try {
        this.processAnimationFrame(id, animation, frame);
      } catch (error) {
        this.emit('error', error as Error);
        this.stopAnimation(id);
        return;
      }

      // Update frame counter
      this.animationFrames.set(id, frame + 1);

      // Check if animation should repeat
      const totalFrames = (animation.duration / frameInterval);
      if (frame >= totalFrames) {
        repeatCount++;

        if (animation.repeat === 'infinite' ||
            (typeof animation.repeat === 'number' && repeatCount < animation.repeat)) {
          this.animationFrames.set(id, 0);
        } else {
          this.stopAnimation(id);
          this.emit('animation:completed', animation);
        }
      }
    };

    const timer = setInterval(animate, frameInterval);
    this.animationTimers.set(id, timer);

    this.emit('animation:started', animation);
    animate(); // Run first frame immediately
  }

  /**
   * Process animation frame
   */
  private processAnimationFrame(_id: string, animation: LedAnimation, _frame: number): void {
    switch (animation.type) {
      case 'fade':
        this.processFadeAnimation(animation, _frame);
        break;

      case 'pulse':
        this.processPulseAnimation(animation, _frame);
        break;

      case 'flash':
        this.processFlashAnimation(animation, _frame);
        break;

      case 'rainbow':
        this.processRainbowAnimation(animation, _frame);
        break;

      case 'chase':
        this.processChaseAnimation(animation, _frame);
        break;

      case 'custom':
        if (animation.callback) {
          animation.callback(_frame);
        }
        break;
    }
  }

  /**
   * Process fade animation
   */
  private processFadeAnimation(animation: LedAnimation, frame: number): void {
    if (!animation.controls || !animation.colors || animation.colors.length < 2) {
      return;
    }

    const progress = frame / (animation.duration / (1000 / this.options.animationFrameRate));
    const fromColor = animation.colors[0];
    const toColor = animation.colors[1];

    // Simple color interpolation
    const color = progress < 0.5 ? fromColor : toColor;

    for (const controlId of animation.controls) {
      if (color !== undefined) {
        this.setLed(controlId, color, 'static').catch(() => {});
      }
    }
  }

  /**
   * Process pulse animation
   */
  private processPulseAnimation(animation: LedAnimation, _frame: number): void {
    if (!animation.controls || !animation.colors) {
      return;
    }

    const color = animation.colors[0] ?? LED_COLOR_VALUES.GREEN_FULL;

    for (const controlId of animation.controls) {
      this.setLed(controlId, color as any, 'pulse').catch(() => {});
    }
  }

  /**
   * Process flash animation
   */
  private processFlashAnimation(animation: LedAnimation, frame: number): void {
    if (!animation.controls || !animation.colors) {
      return;
    }

    const color = animation.colors[0] ?? LED_COLOR_VALUES.RED_FULL;
    const flashRate = 4; // Flashes per second
    const on = Math.floor(frame / (this.options.animationFrameRate / flashRate)) % 2 === 0;

    for (const controlId of animation.controls) {
      this.setLed(controlId, on ? color as any : LED_COLOR_VALUES.OFF, 'static').catch(() => {});
    }
  }

  /**
   * Process rainbow animation
   */
  private processRainbowAnimation(animation: LedAnimation, frame: number): void {
    if (!animation.controls) {
      return;
    }

    const colors = [
      LED_COLOR_VALUES.RED_FULL,
      LED_COLOR_VALUES.AMBER_FULL,
      LED_COLOR_VALUES.YELLOW_FULL,
      LED_COLOR_VALUES.GREEN_FULL,
    ];

    const colorIndex = Math.floor(frame / 10) % colors.length;
    const color = colors[colorIndex];

    for (const controlId of animation.controls) {
      if (color !== undefined) {
        this.setLed(controlId, color, 'static').catch(() => {});
      }
    }
  }

  /**
   * Process chase animation
   */
  private processChaseAnimation(animation: LedAnimation, frame: number): void {
    if (!animation.controls || !animation.colors) {
      return;
    }

    const color = animation.colors[0] ?? LED_COLOR_VALUES.GREEN_FULL;
    const activeIndex = frame % animation.controls.length;

    for (let i = 0; i < animation.controls.length; i++) {
      const controlId = animation.controls[i];
      if (!controlId) continue; // Skip undefined controlIds
      const isActive = i === activeIndex;

      this.setLed(
        controlId,
        isActive ? color as any : LED_COLOR_VALUES.OFF,
        'static'
      ).catch(() => {});
    }
  }

  /**
   * Stop an animation
   */
  stopAnimation(id: string): void {
    const timer = this.animationTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.animationTimers.delete(id);
    }

    this.animations.delete(id);
    this.animationFrames.delete(id);
  }

  /**
   * Stop all animations
   */
  stopAllAnimations(): void {
    for (const id of this.animations.keys()) {
      this.stopAnimation(id);
    }
  }

  /**
   * Get LED note value from control ID
   */
  private getLedNoteValue(controlId: string): number | undefined {
    return (LED_NOTE_MAP as any)[controlId];
  }

  /**
   * Get color value from color name
   */
  private getColorValue(color: LedColor | number): number {
    if (typeof color === 'number') {
      return color;
    }
    return (LED_COLOR_VALUES as any)[color] ?? LED_COLOR_VALUES.OFF;
  }

  /**
   * Apply color correction
   */
  private applyColorCorrection(color: number): number {
    // Simple gamma correction
    // This would need to be calibrated for the actual hardware
    return color;
  }

  /**
   * Get brightness from color value
   */
  private getBrightness(colorValue: number): number {
    // Extract brightness from velocity value
    // This is a simplified calculation
    if (colorValue === LED_COLOR_VALUES.OFF) {
      return 0;
    }

    const brightness = (colorValue & 0x0F) / 15;
    return Math.round(brightness * 100);
  }

  /**
   * Get current LED state
   */
  getLedState(controlId: string): LedState | undefined {
    return this.ledStates.get(controlId);
  }

  /**
   * Get all LED states
   */
  getAllLedStates(): Map<string, LedState> {
    return new Map(this.ledStates);
  }

  /**
   * Create startup animation
   */
  async playStartupAnimation(): Promise<void> {
    const focusButtons = ['FOCUS1', 'FOCUS2', 'FOCUS3', 'FOCUS4', 'FOCUS5', 'FOCUS6', 'FOCUS7', 'FOCUS8'];
    const controlButtons = ['CONTROL1', 'CONTROL2', 'CONTROL3', 'CONTROL4', 'CONTROL5', 'CONTROL6', 'CONTROL7', 'CONTROL8'];

    // Chase animation on focus buttons
    this.startAnimation('startup-focus', {
      type: 'chase',
      duration: 2000,
      controls: focusButtons,
      colors: [LED_COLOR_VALUES.GREEN_FULL.toString()],
    });

    // Chase animation on control buttons (delayed)
    setTimeout(() => {
      this.startAnimation('startup-control', {
        type: 'chase',
        duration: 2000,
        controls: controlButtons,
        colors: [LED_COLOR_VALUES.AMBER_FULL.toString()],
      });
    }, 500);

    // Turn off after animation
    setTimeout(() => {
      this.turnOffAll();
    }, 3000);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopAllAnimations();
    this.ledStates.clear();
    this.removeAllListeners();
  }
}

export default LedController;