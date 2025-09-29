#!/usr/bin/env tsx

/**
 * Playwright Test Actions - Phase 2 Systematic Web Editor Actions
 *
 * This module defines systematic test actions for the Novation web editor
 * to capture corresponding MIDI messages for protocol reverse engineering.
 *
 * Each action is designed to trigger specific MIDI communication patterns
 * that can be analyzed to understand the true SysEx protocol.
 */

import { Page } from 'playwright';
import { CapturedMessage } from './midi-monitor.js';

// Test action interface
export interface TestAction {
  readonly name: string;
  readonly description: string;
  readonly category: 'mode-management' | 'control-config' | 'visual-config' | 'device-interaction';
  readonly expectedMidiMessages: number;
  readonly estimatedDuration: number; // milliseconds
  execute: (page: Page) => Promise<void>;
  verify?: (capturedMessages: CapturedMessage[]) => ValidationResult;
  cleanup?: (page: Page) => Promise<void>;
}

// Validation result for test actions
export interface ValidationResult {
  readonly isValid: boolean;
  readonly expectedMessages: number;
  readonly actualMessages: number;
  readonly missingMessages?: string[];
  readonly unexpectedMessages?: string[];
  readonly notes?: string;
}

// Test action execution result
export interface ActionExecutionResult {
  readonly action: TestAction;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;
  readonly success: boolean;
  readonly capturedMessages: readonly CapturedMessage[];
  readonly validation?: ValidationResult;
  readonly error?: string;
  readonly screenshots?: readonly string[];
}

/**
 * Mode Management Actions
 * These actions test custom mode creation, saving, and loading
 */
export const MODE_MANAGEMENT_ACTIONS: TestAction[] = [
  {
    name: 'create_simple_mode',
    description: 'Create a new custom mode with basic settings',
    category: 'mode-management',
    expectedMidiMessages: 1,
    estimatedDuration: 5000,
    execute: async (page: Page) => {
      // Take screenshot before action
      await page.screenshot({ path: 'action-create-simple-mode-before.png' });

      // Look for and click new mode button (selectors to be refined based on actual UI)
      await page.click('[data-testid="new-mode"], .new-mode-button, button:has-text("New Mode")',
        { timeout: 5000 }).catch(() => {
        // Fallback selectors
        return page.click('button[contains(@class, "mode")], .mode-create, #new-mode');
      });

      await page.waitForTimeout(1000);

      // Set mode name if input is available
      const nameInput = await page.locator('input[placeholder*="mode"], input[name*="name"], .mode-name-input').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('SPY_TEST_MODE_1');
        await page.waitForTimeout(500);
      }

      // Save the mode
      await page.click('[data-testid="save-mode"], .save-button, button:has-text("Save")')
        .catch(() => {
          return page.keyboard.press('Enter'); // Fallback to Enter key
        });

      await page.waitForTimeout(2000);
    },
    verify: (messages: CapturedMessage[]) => {
      const sysexMessages = messages.filter(msg => msg.messageType === 'sysex');
      return {
        isValid: sysexMessages.length >= 1,
        expectedMessages: 1,
        actualMessages: sysexMessages.length,
        notes: `Expected at least 1 SysEx message for mode creation, got ${sysexMessages.length}`,
      };
    },
  },

  {
    name: 'save_mode_to_slot',
    description: 'Save current mode to device slot 1',
    category: 'mode-management',
    expectedMidiMessages: 1,
    estimatedDuration: 3000,
    execute: async (page: Page) => {
      // Look for save/send to device buttons
      await page.click('[data-testid="save-to-device"], .send-to-device, button:has-text("Send to Device")')
        .catch(async () => {
          // Alternative selectors
          await page.click('[data-testid="save-slot"], .save-slot, button:has-text("Save Slot")');
        });

      await page.waitForTimeout(1000);

      // Select slot 1 if slot selection is available
      const slot1Button = page.locator('[data-slot="1"], .slot-1, button:has-text("Slot 1")').first();
      if (await slot1Button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await slot1Button.click();
        await page.waitForTimeout(500);
      }

      // Confirm save action
      await page.click('[data-testid="confirm-save"], .confirm-button, button:has-text("Confirm")')
        .catch(() => {
          return page.keyboard.press('Enter');
        });

      await page.waitForTimeout(2000);
    },
  },

  {
    name: 'load_mode_from_slot',
    description: 'Load mode from device slot 1',
    category: 'mode-management',
    expectedMidiMessages: 2, // Usually read request + response
    estimatedDuration: 3000,
    execute: async (page: Page) => {
      // Look for load from device buttons
      await page.click('[data-testid="load-from-device"], .load-from-device, button:has-text("Load from Device")')
        .catch(async () => {
          await page.click('[data-testid="load-slot"], .load-slot, button:has-text("Load Slot")');
        });

      await page.waitForTimeout(1000);

      // Select slot 1
      const slot1Button = page.locator('[data-slot="1"], .slot-1, button:has-text("Slot 1")').first();
      if (await slot1Button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await slot1Button.click();
        await page.waitForTimeout(2000); // Wait for load to complete
      }
    },
  },
];

/**
 * Control Configuration Actions
 * These actions test control naming, CC assignment, and behavior configuration
 */
export const CONTROL_CONFIG_ACTIONS: TestAction[] = [
  {
    name: 'set_fader_name',
    description: 'Set name for first fader control',
    category: 'control-config',
    expectedMidiMessages: 1,
    estimatedDuration: 4000,
    execute: async (page: Page) => {
      // Find and click on first fader or its label
      await page.click('[data-control="fader-1"], .fader-1, .control-fader:first-of-type')
        .catch(async () => {
          // Try clicking on fader area or label
          await page.click('.fader-container:first-of-type, .control-item:first-of-type');
        });

      await page.waitForTimeout(1000);

      // Look for name input field
      const nameInput = page.locator('input[placeholder*="name"], input[name*="label"], .control-name-input').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.clear();
        await nameInput.fill('SPY_VOLUME_1');
        await nameInput.press('Enter');
        await page.waitForTimeout(1500);
      }
    },
  },

  {
    name: 'set_encoder_cc',
    description: 'Set MIDI CC number for first encoder',
    category: 'control-config',
    expectedMidiMessages: 1,
    estimatedDuration: 4000,
    execute: async (page: Page) => {
      // Find and click on first encoder
      await page.click('[data-control="encoder-1"], .encoder-1, .control-encoder:first-of-type')
        .catch(async () => {
          await page.click('.encoder-container:first-of-type');
        });

      await page.waitForTimeout(1000);

      // Look for CC input field
      const ccInput = page.locator('input[placeholder*="CC"], input[name*="cc"], input[type="number"]').first();
      if (await ccInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ccInput.clear();
        await ccInput.fill('21'); // Use CC 21 as test value
        await ccInput.press('Enter');
        await page.waitForTimeout(1500);
      }
    },
  },

  {
    name: 'configure_button_behavior',
    description: 'Configure behavior for first button pad',
    category: 'control-config',
    expectedMidiMessages: 1,
    estimatedDuration: 5000,
    execute: async (page: Page) => {
      // Find and click on first button pad
      await page.click('[data-control="button-1"], .button-1, .pad-1, .control-button:first-of-type')
        .catch(async () => {
          await page.click('.button-container:first-of-type, .pad-container:first-of-type');
        });

      await page.waitForTimeout(1000);

      // Look for behavior selection dropdown
      const behaviorSelect = page.locator('select[name*="behavior"], .behavior-select, .control-type-select').first();
      if (await behaviorSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await behaviorSelect.selectOption('toggle'); // or 'momentary', 'trigger', etc.
        await page.waitForTimeout(1500);
      }
    },
  },
];

/**
 * Visual Configuration Actions
 * These actions test LED colors and visual feedback settings
 */
export const VISUAL_CONFIG_ACTIONS: TestAction[] = [
  {
    name: 'set_button_color',
    description: 'Set LED color for first button pad',
    category: 'visual-config',
    expectedMidiMessages: 1,
    estimatedDuration: 3000,
    execute: async (page: Page) => {
      // Find and click on first button pad
      await page.click('[data-control="button-1"], .button-1, .pad-1');
      await page.waitForTimeout(1000);

      // Look for color picker or color options
      const colorPicker = page.locator('.color-picker, [type="color"], .led-color-select').first();
      if (await colorPicker.isVisible({ timeout: 3000 }).catch(() => false)) {
        await colorPicker.click();
        await page.waitForTimeout(500);

        // Select a specific color (red)
        await page.click('[data-color="red"], .color-red, [style*="rgb(255, 0, 0)"]')
          .catch(async () => {
            // Fallback: use color input
            await colorPicker.fill('#FF0000');
          });

        await page.waitForTimeout(1500);
      }
    },
  },

  {
    name: 'set_fader_led_behavior',
    description: 'Configure LED behavior for fader',
    category: 'visual-config',
    expectedMidiMessages: 1,
    estimatedDuration: 4000,
    execute: async (page: Page) => {
      // Find and click on first fader
      await page.click('[data-control="fader-1"], .fader-1');
      await page.waitForTimeout(1000);

      // Look for LED behavior settings
      const ledSettings = page.locator('.led-settings, .visual-feedback, .led-behavior').first();
      if (await ledSettings.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ledSettings.click();
        await page.waitForTimeout(1500);
      }
    },
  },
];

/**
 * Device Interaction Actions
 * These actions test direct device communication and status queries
 */
export const DEVICE_INTERACTION_ACTIONS: TestAction[] = [
  {
    name: 'device_handshake',
    description: 'Perform device handshake/ping',
    category: 'device-interaction',
    expectedMidiMessages: 2, // Request + response
    estimatedDuration: 2000,
    execute: async (page: Page) => {
      // Look for device status or connection check buttons
      await page.click('[data-testid="device-status"], .device-ping, button:has-text("Check Device")')
        .catch(async () => {
          // Trigger via JavaScript if no UI button available
          await page.evaluate(() => {
            // This would trigger a device ping through Web MIDI
            const output = (window as any).__lcxl3_midi_output;
            if (output) {
              // Send a simple identity request (standard MIDI SysEx)
              output.send([0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7]);
            }
          });
        });

      await page.waitForTimeout(2000);
    },
  },

  {
    name: 'request_device_info',
    description: 'Request device firmware and status information',
    category: 'device-interaction',
    expectedMidiMessages: 2,
    estimatedDuration: 3000,
    execute: async (page: Page) => {
      // Look for device info buttons
      await page.click('[data-testid="device-info"], .device-info, button:has-text("Device Info")')
        .catch(async () => {
          // Fallback to programmatic request
          await page.evaluate(() => {
            const output = (window as any).__lcxl3_midi_output;
            if (output) {
              // Request device information (manufacturer-specific)
              output.send([0xF0, 0x00, 0x20, 0x29, 0x02, 0x0C, 0x00, 0xF7]);
            }
          });
        });

      await page.waitForTimeout(3000);
    },
  },
];

/**
 * Combined test action collections
 */
export const ALL_TEST_ACTIONS: TestAction[] = [
  ...MODE_MANAGEMENT_ACTIONS,
  ...CONTROL_CONFIG_ACTIONS,
  ...VISUAL_CONFIG_ACTIONS,
  ...DEVICE_INTERACTION_ACTIONS,
];

/**
 * Test action categories for organized execution
 */
export const TEST_ACTION_CATEGORIES = {
  'mode-management': MODE_MANAGEMENT_ACTIONS,
  'control-config': CONTROL_CONFIG_ACTIONS,
  'visual-config': VISUAL_CONFIG_ACTIONS,
  'device-interaction': DEVICE_INTERACTION_ACTIONS,
} as const;

/**
 * Get actions by category
 */
export function getActionsByCategory(category: keyof typeof TEST_ACTION_CATEGORIES): TestAction[] {
  return TEST_ACTION_CATEGORIES[category] || [];
}

/**
 * Get action by name
 */
export function getActionByName(name: string): TestAction | undefined {
  return ALL_TEST_ACTIONS.find(action => action.name === name);
}

/**
 * Estimate total execution time for a set of actions
 */
export function estimateExecutionTime(actions: TestAction[]): number {
  return actions.reduce((total, action) => total + action.estimatedDuration, 0);
}

/**
 * Validate action execution results
 */
export function validateActionResults(results: ActionExecutionResult[]): {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  totalMessages: number;
  averageMessagesPerAction: number;
} {
  const totalActions = results.length;
  const successfulActions = results.filter(r => r.success).length;
  const failedActions = totalActions - successfulActions;
  const totalMessages = results.reduce((sum, r) => sum + r.capturedMessages.length, 0);
  const averageMessagesPerAction = totalActions > 0 ? totalMessages / totalActions : 0;

  return {
    totalActions,
    successfulActions,
    failedActions,
    totalMessages,
    averageMessagesPerAction,
  };
}