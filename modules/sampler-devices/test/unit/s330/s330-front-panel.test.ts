/**
 * Tests for S-330 Front Panel Controller
 *
 * Tests the virtual front panel button message encoding.
 * Arrow buttons support two modes:
 * - 'menu': Category 01 single messages (menus/parameter screens)
 * - 'sampling': Category 09 press/release pairs (sampling screen)
 * Inc/Dec always use category 09 press/release.
 * Function buttons use category 01 single messages.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    createFrontPanelController,
    buildFrontPanelMessage,
    isNavigationButton,
    isArrowButton,
    isValueButton,
    FRONT_PANEL_ADDRESS,
    ARROW_CODES_CAT01,
    ARROW_CODES_CAT09,
    VALUE_CODES,
    NAVIGATION_DELAY_MS,
    FUNCTION_CODES,
    type NavigationButton,
    type FunctionButton,
    type FrontPanelButton,
    type NavigationMode,
} from '../../../src/devices/s330/s330-front-panel.js';
import type { S330MidiAdapter } from '../../../src/devices/s330/s330-types.js';
import { calculateChecksum } from '../../../src/devices/s330/s330-addresses.js';

// Constants
const ROLAND_ID = 0x41;
const S330_MODEL_ID = 0x1e;
const DT1_COMMAND = 0x12;

/**
 * Create a mock MIDI adapter
 */
function createMockAdapter(): S330MidiAdapter & { sentMessages: number[][] } {
    const sentMessages: number[][] = [];
    return {
        sentMessages,
        send(data: number[]) {
            sentMessages.push([...data]);
        },
        onSysEx() {},
        removeSysExListener() {},
    };
}

/**
 * Verify a front panel message has correct structure
 */
function verifyMessageStructure(
    message: number[],
    deviceId: number,
    expectedData: [number, number]
): void {
    expect(message[0]).toBe(0xf0); // SysEx start
    expect(message[1]).toBe(ROLAND_ID);
    expect(message[2]).toBe(deviceId);
    expect(message[3]).toBe(S330_MODEL_ID);
    expect(message[4]).toBe(DT1_COMMAND);
    expect(message.slice(5, 9)).toEqual(FRONT_PANEL_ADDRESS);
    expect(message[9]).toBe(expectedData[0]); // Category
    expect(message[10]).toBe(expectedData[1]); // Code
    expect(message[message.length - 1]).toBe(0xf7); // SysEx end

    // Verify checksum
    const checksum = calculateChecksum(FRONT_PANEL_ADDRESS, expectedData);
    expect(message[11]).toBe(checksum);
}

describe('s330-front-panel', () => {
    describe('isNavigationButton', () => {
        it('should identify navigation buttons', () => {
            expect(isNavigationButton('up')).toBe(true);
            expect(isNavigationButton('down')).toBe(true);
            expect(isNavigationButton('left')).toBe(true);
            expect(isNavigationButton('right')).toBe(true);
            expect(isNavigationButton('inc')).toBe(true);
            expect(isNavigationButton('dec')).toBe(true);
        });

        it('should reject function buttons', () => {
            expect(isNavigationButton('mode' as FrontPanelButton)).toBe(false);
            expect(isNavigationButton('menu' as FrontPanelButton)).toBe(false);
            expect(isNavigationButton('sub-menu' as FrontPanelButton)).toBe(false);
            expect(isNavigationButton('com' as FrontPanelButton)).toBe(false);
            expect(isNavigationButton('execute' as FrontPanelButton)).toBe(false);
        });
    });

    describe('isArrowButton', () => {
        it('should identify arrow buttons', () => {
            expect(isArrowButton('up')).toBe(true);
            expect(isArrowButton('down')).toBe(true);
            expect(isArrowButton('left')).toBe(true);
            expect(isArrowButton('right')).toBe(true);
        });

        it('should reject inc/dec buttons', () => {
            expect(isArrowButton('inc')).toBe(false);
            expect(isArrowButton('dec')).toBe(false);
        });
    });

    describe('isValueButton', () => {
        it('should identify value buttons', () => {
            expect(isValueButton('inc')).toBe(true);
            expect(isValueButton('dec')).toBe(true);
        });

        it('should reject arrow buttons', () => {
            expect(isValueButton('up')).toBe(false);
            expect(isValueButton('down')).toBe(false);
            expect(isValueButton('left')).toBe(false);
            expect(isValueButton('right')).toBe(false);
        });
    });

    describe('buildFrontPanelMessage', () => {
        it('should build correct message structure', () => {
            const message = buildFrontPanelMessage(0, [0x01, 0x00]);
            verifyMessageStructure(message, 0, [0x01, 0x00]);
        });

        it('should respect device ID', () => {
            const message = buildFrontPanelMessage(5, [0x01, 0x03]);
            expect(message[2]).toBe(5);
        });

        it('should calculate correct checksum for category 01 message', () => {
            // Address: 00 04 00 00, Data: 01 03 (down, menu mode)
            // Sum = 0 + 4 + 0 + 0 + 1 + 3 = 8
            // Checksum = 128 - 8 = 120 = 0x78
            const message = buildFrontPanelMessage(0, [0x01, 0x03]);
            expect(message[11]).toBe(0x78);
        });

        it('should calculate correct checksum for category 09 press', () => {
            // Address: 00 04 00 00, Data: 09 03 (down press, sampling mode)
            // Sum = 0 + 4 + 0 + 0 + 9 + 3 = 16
            // Checksum = 128 - 16 = 112 = 0x70
            const message = buildFrontPanelMessage(0, [0x09, 0x03]);
            expect(message[11]).toBe(0x70);
        });

        it('should calculate correct checksum for category 09 release', () => {
            // Address: 00 04 00 00, Data: 09 0B (down release)
            // Sum = 0 + 4 + 0 + 0 + 9 + 11 = 24
            // Checksum = 128 - 24 = 104 = 0x68
            const message = buildFrontPanelMessage(0, [0x09, 0x0b]);
            expect(message[11]).toBe(0x68);
        });
    });

    describe('ARROW_CODES_CAT01', () => {
        it('should have correct category 01 codes for arrow buttons', () => {
            expect(ARROW_CODES_CAT01.right).toEqual([0x01, 0x00]);
            expect(ARROW_CODES_CAT01.left).toEqual([0x01, 0x01]);
            expect(ARROW_CODES_CAT01.up).toEqual([0x01, 0x02]);
            expect(ARROW_CODES_CAT01.down).toEqual([0x01, 0x03]);
        });
    });

    describe('ARROW_CODES_CAT09', () => {
        it('should have correct category 09 codes for arrow buttons', () => {
            expect(ARROW_CODES_CAT09.right.press).toEqual([0x09, 0x00]);
            expect(ARROW_CODES_CAT09.right.release).toEqual([0x09, 0x08]);
            expect(ARROW_CODES_CAT09.left.press).toEqual([0x09, 0x01]);
            expect(ARROW_CODES_CAT09.left.release).toEqual([0x09, 0x09]);
            expect(ARROW_CODES_CAT09.up.press).toEqual([0x09, 0x02]);
            expect(ARROW_CODES_CAT09.up.release).toEqual([0x09, 0x0a]);
            expect(ARROW_CODES_CAT09.down.press).toEqual([0x09, 0x03]);
            expect(ARROW_CODES_CAT09.down.release).toEqual([0x09, 0x0b]);
        });

        it('should have release codes that are press codes + 8', () => {
            for (const [_button, codes] of Object.entries(ARROW_CODES_CAT09)) {
                expect(codes.release[1]).toBe(codes.press[1] + 8);
            }
        });
    });

    describe('VALUE_CODES', () => {
        it('should have correct category 09 codes for inc/dec', () => {
            expect(VALUE_CODES.inc.press).toEqual([0x09, 0x04]);
            expect(VALUE_CODES.inc.release).toEqual([0x09, 0x0c]);
            expect(VALUE_CODES.dec.press).toEqual([0x09, 0x05]);
            expect(VALUE_CODES.dec.release).toEqual([0x09, 0x0d]);
        });
    });

    describe('FUNCTION_CODES', () => {
        it('should have correct codes for all function buttons', () => {
            expect(FUNCTION_CODES.mode).toEqual([0x01, 0x0b]);
            expect(FUNCTION_CODES.menu).toEqual([0x01, 0x0c]);
            expect(FUNCTION_CODES['sub-menu']).toEqual([0x01, 0x0d]);
            expect(FUNCTION_CODES.com).toEqual([0x01, 0x0e]);
            expect(FUNCTION_CODES.execute).toEqual([0x01, 0x0f]);
        });
    });

    describe('createFrontPanelController', () => {
        let adapter: ReturnType<typeof createMockAdapter>;

        beforeEach(() => {
            adapter = createMockAdapter();
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        describe('pressNavigation - menu mode (default)', () => {
            const arrowButtons: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];

            it.each(arrowButtons)('should send single cat01 message for %s in menu mode', async (button) => {
                const controller = createFrontPanelController(adapter, { deviceId: 0 });
                await controller.pressNavigation(button, 'menu');

                expect(adapter.sentMessages).toHaveLength(1);
                const code = ARROW_CODES_CAT01[button];
                verifyMessageStructure(adapter.sentMessages[0], 0, code as [number, number]);
            });

            it('should default to menu mode', async () => {
                const controller = createFrontPanelController(adapter, { deviceId: 0 });
                await controller.pressNavigation('up');

                expect(adapter.sentMessages).toHaveLength(1);
                expect(adapter.sentMessages[0][9]).toBe(0x01); // Category 01
            });
        });

        describe('pressNavigation - sampling mode', () => {
            const arrowButtons: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];

            it.each(arrowButtons)('should send press/release for %s in sampling mode', async (button) => {
                const controller = createFrontPanelController(adapter, { deviceId: 0 });
                const promise = controller.pressNavigation(button, 'sampling');

                await vi.advanceTimersByTimeAsync(NAVIGATION_DELAY_MS);
                await promise;

                expect(adapter.sentMessages).toHaveLength(2);
                const codes = ARROW_CODES_CAT09[button];
                verifyMessageStructure(adapter.sentMessages[0], 0, codes.press as [number, number]);
                verifyMessageStructure(adapter.sentMessages[1], 0, codes.release as [number, number]);
            });
        });

        describe('pressNavigation - inc/dec (always cat09)', () => {
            const valueButtons: Array<'inc' | 'dec'> = ['inc', 'dec'];

            it.each(valueButtons)('should send press/release for %s regardless of mode', async (button) => {
                const controller = createFrontPanelController(adapter, { deviceId: 0 });
                const promise = controller.pressNavigation(button, 'menu');

                await vi.advanceTimersByTimeAsync(NAVIGATION_DELAY_MS);
                await promise;

                expect(adapter.sentMessages).toHaveLength(2);
                const codes = VALUE_CODES[button];
                verifyMessageStructure(adapter.sentMessages[0], 0, codes.press as [number, number]);
                verifyMessageStructure(adapter.sentMessages[1], 0, codes.release as [number, number]);
            });
        });

        describe('pressFunction', () => {
            const functionButtons: FunctionButton[] = ['mode', 'menu', 'sub-menu', 'com', 'execute'];

            it.each(functionButtons)('should send single message for %s button', async (button) => {
                const controller = createFrontPanelController(adapter, { deviceId: 0 });
                await controller.pressFunction(button);

                expect(adapter.sentMessages).toHaveLength(1);
                const code = FUNCTION_CODES[button];
                verifyMessageStructure(adapter.sentMessages[0], 0, code as [number, number]);
            });
        });

        describe('press (unified)', () => {
            it('should handle arrow buttons in menu mode', async () => {
                const controller = createFrontPanelController(adapter);
                await controller.press('left', 'menu');

                expect(adapter.sentMessages).toHaveLength(1);
                expect(adapter.sentMessages[0][9]).toBe(0x01);
            });

            it('should handle arrow buttons in sampling mode', async () => {
                const controller = createFrontPanelController(adapter);
                const promise = controller.press('left', 'sampling');

                await vi.advanceTimersByTimeAsync(NAVIGATION_DELAY_MS);
                await promise;

                expect(adapter.sentMessages).toHaveLength(2);
                expect(adapter.sentMessages[0][9]).toBe(0x09);
            });

            it('should handle function buttons', async () => {
                const controller = createFrontPanelController(adapter);
                await controller.press('execute');

                expect(adapter.sentMessages).toHaveLength(1);
                expect(adapter.sentMessages[0][9]).toBe(0x01);
            });
        });
    });

    describe('message checksums', () => {
        it('should match observed hardware messages for down button', () => {
            // Observed from hardware on sampling screen:
            // Press:   F0 41 00 1E 12 00 04 00 00 09 03 70 F7
            // Release: F0 41 00 1E 12 00 04 00 00 09 0B 68 F7
            const pressMessage = buildFrontPanelMessage(0, [0x09, 0x03]);
            const releaseMessage = buildFrontPanelMessage(0, [0x09, 0x0b]);

            expect(pressMessage).toEqual([0xf0, 0x41, 0x00, 0x1e, 0x12, 0x00, 0x04, 0x00, 0x00, 0x09, 0x03, 0x70, 0xf7]);
            expect(releaseMessage).toEqual([0xf0, 0x41, 0x00, 0x1e, 0x12, 0x00, 0x04, 0x00, 0x00, 0x09, 0x0b, 0x68, 0xf7]);
        });
    });
});
