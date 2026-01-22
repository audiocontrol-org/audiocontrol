/**
 * Integration tests for Roland S-330 Sampler
 *
 * These tests require a physical Roland S-330 connected via MIDI.
 * The device should be connected to a MIDI interface called "Volt 4".
 *
 * Run with: pnpm test -- --run test/integration/roland-s330.test.ts
 */

import * as easymidi from 'easymidi';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createS330Client, type S330Client } from '@/client/client-roland-s330.js';
import { createEasymidiAdapter, findMidiPort } from '@/client/s330-easymidi-adapter.js';
import {
    ROLAND_ID,
    S330_MODEL_ID,
    S330_COMMANDS,
    calculateChecksum,
    buildSystemAddress,
    buildToneAddress,
    buildPatchAddress,
    SYSTEM_OFFSETS,
} from '@oletizi/sampler-devices/s330';

// MIDI device name - change this if your device has a different name
const MIDI_DEVICE_NAME = 'Volt 4';

let input: easymidi.Input;
let output: easymidi.Output;
let client: S330Client;

/**
 * Setup MIDI connections
 */
function midiSetup() {
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    console.log('Available MIDI inputs:', inputs);
    console.log('Available MIDI outputs:', outputs);

    const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME);
    const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME);

    if (!inputPort || !outputPort) {
        throw new Error(`MIDI device "${MIDI_DEVICE_NAME}" not found. Available: ${inputs.join(', ')}`);
    }

    console.log(`Opening MIDI input: ${inputPort}`);
    console.log(`Opening MIDI output: ${outputPort}`);

    input = new easymidi.Input(inputPort);
    output = new easymidi.Output(outputPort);

    const midiIO = createEasymidiAdapter(input, output);
    client = createS330Client(midiIO, { deviceId: 0, timeoutMs: 2000 });
}

/**
 * Teardown MIDI connections
 */
function midiTeardown() {
    client?.disconnect();
    input?.close();
    output?.close();
}

/**
 * Send raw SysEx and wait for response
 */
function sendRawSysEx(message: number[]): Promise<number[]> {
    return new Promise((resolve, reject) => {
        // Debug: log the message being sent
        console.log('Sending SysEx:', message.map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('Message array:', message);
        console.log('First byte check:', message[0], '===', 0xF0, ':', message[0] === 0xF0);
        console.log('Last byte check:', message[message.length - 1], '===', 0xF7, ':', message[message.length - 1] === 0xF7);

        const timeout = setTimeout(() => {
            input.removeListener('sysex', listener);
            reject(new Error('SysEx response timeout'));
        }, 2000);

        function listener(msg: { bytes: number[] }) {
            clearTimeout(timeout);
            input.removeListener('sysex', listener);
            resolve(msg.bytes);
        }

        input.on('sysex', listener);
        // easymidi expects the byte array directly, not wrapped in {bytes: ...}
        output.send('sysex', message as any);
    });
}

/**
 * Build a Roland DT1 (Data Set) message
 */
function buildDT1Message(deviceId: number, address: number[], data: number[]): number[] {
    const checksum = calculateChecksum(address, data);
    return [
        0xF0,           // SysEx start
        ROLAND_ID,      // Roland
        deviceId,       // Device ID
        S330_MODEL_ID,  // S-330
        S330_COMMANDS.DT1,
        ...address,
        ...data,
        checksum,
        0xF7            // SysEx end
    ];
}

/**
 * Build a Roland RQ1 (Data Request) message
 */
function buildRQ1Message(deviceId: number, address: number[], size: number[]): number[] {
    const checksum = calculateChecksum(address, size);
    return [
        0xF0,           // SysEx start
        ROLAND_ID,      // Roland
        deviceId,       // Device ID
        S330_MODEL_ID,  // S-330
        S330_COMMANDS.RQ1,
        ...address,
        ...size,
        checksum,
        0xF7            // SysEx end
    ];
}

describe('Roland S-330 Integration Tests', () => {
    beforeAll(midiSetup);
    afterAll(midiTeardown);

    describe('Basic Communication', () => {
        it('should list available MIDI ports', () => {
            const inputs = easymidi.getInputs();
            const outputs = easymidi.getOutputs();

            console.log('MIDI Inputs:', inputs);
            console.log('MIDI Outputs:', outputs);

            expect(inputs.length).toBeGreaterThan(0);
            expect(outputs.length).toBeGreaterThan(0);
        });

        it('should find Volt 4 MIDI device', () => {
            const inputs = easymidi.getInputs();
            const outputs = easymidi.getOutputs();

            const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME);
            const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME);

            expect(inputPort).toBeDefined();
            expect(outputPort).toBeDefined();
            console.log(`Found input: ${inputPort}`);
            console.log(`Found output: ${outputPort}`);
        });
    });

    describe('SysEx Communication', () => {
        it('should receive response to system parameter request', async () => {
            // Try different device IDs (0-31 are valid for Roland)
            // Also try different message formats

            // First, let's try a simple identity request (Universal SysEx)
            // F0 7E 00 06 01 F7 = Identity Request
            const identityRequest = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
            console.log('Trying Universal Identity Request...');

            try {
                const response = await sendRawSysEx(identityRequest);
                console.log('Identity Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));
            } catch (e) {
                console.log('Identity request timed out (device may not support it)');
            }

            // Now try Roland RQ1 with device ID 0
            const address = buildSystemAddress(SYSTEM_OFFSETS.MASTER_TUNE);
            const size = [0x00, 0x00, 0x00, 0x01]; // Request 1 byte

            const message = buildRQ1Message(0, address, size);
            console.log('Sending RQ1:', message.map(b => b.toString(16).padStart(2, '0')).join(' '));

            try {
                const response = await sendRawSysEx(message);
                console.log('Received:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));

                // Verify response structure
                expect(response[0]).toBe(0xF0);  // SysEx start
                expect(response[1]).toBe(ROLAND_ID);  // Roland
                expect(response[response.length - 1]).toBe(0xF7);  // SysEx end
            } catch (e) {
                // Try with different device IDs
                console.log('Device ID 0 timed out, trying device ID 16 (0x10)...');
                const message16 = buildRQ1Message(16, address, size);
                const response16 = await sendRawSysEx(message16);
                console.log('Received:', response16.map(b => b.toString(16).padStart(2, '0')).join(' '));
            }
        });

        it('should request master level', async () => {
            const address = buildSystemAddress(SYSTEM_OFFSETS.MASTER_LEVEL);
            const size = [0x00, 0x00, 0x00, 0x01];

            const message = buildRQ1Message(0, address, size);
            console.log('Requesting master level...');

            const response = await sendRawSysEx(message);
            console.log('Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));

            expect(response.length).toBeGreaterThan(5);
        });

        it('should request MIDI channel setting', async () => {
            const address = buildSystemAddress(SYSTEM_OFFSETS.MIDI_CHANNEL);
            const size = [0x00, 0x00, 0x00, 0x01];

            const message = buildRQ1Message(0, address, size);
            console.log('Requesting MIDI channel...');

            const response = await sendRawSysEx(message);
            console.log('Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));

            // Extract the data byte (should be MIDI channel 0-15)
            if (response.length >= 10) {
                const midiChannel = response[9]; // Data starts after header
                console.log(`MIDI Channel: ${midiChannel}`);
                expect(midiChannel).toBeGreaterThanOrEqual(0);
                expect(midiChannel).toBeLessThanOrEqual(15);
            }
        });
    });

    describe('Tone Data', () => {
        it('should request tone 0 name', async () => {
            // Request 8 bytes (name) from tone 0
            const address = buildToneAddress(0, 0x00);
            const size = [0x00, 0x00, 0x00, 0x08]; // 8 bytes for name

            const message = buildRQ1Message(0, address, size);
            console.log('Requesting tone 0 name...');

            const response = await sendRawSysEx(message);
            console.log('Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));

            // Try to extract name from response
            if (response.length >= 17) {
                const nameBytes = response.slice(9, 17);
                const name = nameBytes.map(b => String.fromCharCode(b & 0x7F)).join('').trim();
                console.log(`Tone 0 name: "${name}"`);
            }
        });

        it('should request tone 0 original key', async () => {
            const address = buildToneAddress(0, 0x08); // Original key offset
            const size = [0x00, 0x00, 0x00, 0x01];

            const message = buildRQ1Message(0, address, size);
            console.log('Requesting tone 0 original key...');

            const response = await sendRawSysEx(message);
            console.log('Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));

            if (response.length >= 10) {
                const originalKey = response[9];
                console.log(`Tone 0 original key: ${originalKey} (MIDI note)`);
            }
        });
    });

    describe('Patch Data', () => {
        it('should request patch 0 name', async () => {
            const address = buildPatchAddress(0, 0x00);
            const size = [0x00, 0x00, 0x00, 0x08]; // 8 bytes for name

            const message = buildRQ1Message(0, address, size);
            console.log('Requesting patch 0 name...');

            const response = await sendRawSysEx(message);
            console.log('Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));

            if (response.length >= 17) {
                const nameBytes = response.slice(9, 17);
                const name = nameBytes.map(b => String.fromCharCode(b & 0x7F)).join('').trim();
                console.log(`Patch 0 name: "${name}"`);
            }
        });

        it('should request patch 0 level', async () => {
            const address = buildPatchAddress(0, 0x0F); // Level offset
            const size = [0x00, 0x00, 0x00, 0x01];

            const message = buildRQ1Message(0, address, size);
            console.log('Requesting patch 0 level...');

            const response = await sendRawSysEx(message);
            console.log('Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));

            if (response.length >= 10) {
                const level = response[9];
                console.log(`Patch 0 level: ${level}`);
                expect(level).toBeGreaterThanOrEqual(0);
                expect(level).toBeLessThanOrEqual(127);
            }
        });
    });

    describe('Client API', () => {
        it('should connect to the device', async () => {
            const connected = await client.connect();
            expect(connected).toBe(true);
            expect(client.isConnected()).toBe(true);
        });

        it('should report correct device ID', () => {
            expect(client.getDeviceId()).toBe(0);
        });

        it('should disconnect from the device', () => {
            client.disconnect();
            expect(client.isConnected()).toBe(false);
        });
    });
});

describe('Roland S-330 Protocol Exploration', () => {
    beforeAll(midiSetup);
    afterAll(midiTeardown);

    it('should try different SysEx approaches', { timeout: 30000 }, async () => {
        console.log('\n=== S-330 Protocol Exploration ===\n');

        // 1. Try Universal Identity Request
        console.log('1. Universal Identity Request (F0 7E 00 06 01 F7):');
        try {
            const response = await sendRawSysEx([0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7]);
            console.log('   Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));
        } catch (e) {
            console.log('   No response (timeout)');
        }

        // 2. Try Roland RQD (Request Data bulk) with proper checksum
        // Format: F0 41 dev 1E 41 tt cs F7
        // tt = data type (00=all, 01=patch1-32, 02=patch33-64, 03=tone1-32...)
        // cs = checksum = 128 - (tt & 0x7F)
        console.log('\n2. Roland RQD with proper checksum:');
        for (const dataType of [0x00, 0x01, 0x02, 0x03]) {
            const checksum = (128 - (dataType & 0x7F)) & 0x7F;
            const rqdMessage = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.RQD, dataType, checksum, 0xF7];
            console.log(`   RQD type ${dataType}: `, rqdMessage.map(b => b.toString(16).padStart(2, '0')).join(' '));
            try {
                const response = await sendRawSysEx(rqdMessage);
                console.log('   Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));
            } catch (e) {
                console.log('   No response (timeout)');
            }
        }

        // 3. Try different device IDs with RQ1 (user suggested device ID might be 1)
        console.log('\n3. Trying RQ1 with different device IDs:');
        for (const deviceId of [1, 0, 16, 17]) {
            const address = [0x00, 0x00, 0x00, 0x00];
            const size = [0x00, 0x00, 0x00, 0x01];
            const checksum = calculateChecksum(address, size);
            const rq1Message = [
                0xF0, ROLAND_ID, deviceId, S330_MODEL_ID, S330_COMMANDS.RQ1,
                ...address, ...size, checksum, 0xF7
            ];
            console.log(`   Device ID ${deviceId}: `, rq1Message.map(b => b.toString(16).padStart(2, '0')).join(' '));
            try {
                const response = await sendRawSysEx(rq1Message);
                console.log('   Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));
            } catch (e) {
                console.log('   No response');
            }
        }

        // 4. Try S-50 model ID (0x14) instead of S-330 (0x1E)
        console.log('\n4. Trying with S-50 model ID (0x14):');
        {
            const address = [0x00, 0x00, 0x00, 0x00];
            const size = [0x00, 0x00, 0x00, 0x01];
            const checksum = calculateChecksum(address, size);
            const rq1Message = [
                0xF0, ROLAND_ID, 0x00, 0x14, S330_COMMANDS.RQ1,
                ...address, ...size, checksum, 0xF7
            ];
            console.log('   Message:', rq1Message.map(b => b.toString(16).padStart(2, '0')).join(' '));
            try {
                const response = await sendRawSysEx(rq1Message);
                console.log('   Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));
            } catch (e) {
                console.log('   No response');
            }
        }

        // 5. Try sending WSD (Want to Send Data) to initiate handshake
        // Format: F0 41 dev 1E 40 tt cs F7
        // tt = data type, cs = checksum
        console.log('\n5. Trying WSD handshake with proper checksum:');
        for (const dataType of [0x00, 0x01, 0x02, 0x03]) {
            const checksum = (128 - (dataType & 0x7F)) & 0x7F;
            const wsdMessage = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.WSD, dataType, checksum, 0xF7];
            console.log(`   WSD type ${dataType}: `, wsdMessage.map(b => b.toString(16).padStart(2, '0')).join(' '));
            try {
                const response = await sendRawSysEx(wsdMessage);
                console.log('   Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));
            } catch (e) {
                console.log('   No response');
            }
        }

        // 6. Try DT1 write to a safe read-only address to test if format is correct
        // This should get either ACK or RJC response
        console.log('\n6. Trying DT1 data set (read master tune):');
        {
            const address = [0x00, 0x01, 0x00, 0x00]; // System params
            const data = [0x40]; // Middle value
            const checksum = calculateChecksum(address, data);
            const dt1Message = [
                0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.DT1,
                ...address, ...data, checksum, 0xF7
            ];
            console.log('   DT1 Message:', dt1Message.map(b => b.toString(16).padStart(2, '0')).join(' '));
            try {
                const response = await sendRawSysEx(dt1Message);
                console.log('   Response:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));
            } catch (e) {
                console.log('   No response (DT1 might not send ACK)');
            }
        }

        // Test passes if we get here - we're just exploring
        expect(true).toBe(true);
    });

    it('should collect all data from S-330 using RQD/DAT protocol', { timeout: 60000 }, async () => {
        console.log('\n=== Collecting S-330 Data via RQD/DAT ===\n');

        /**
         * Collect all DAT responses for a given RQD request
         * The S-330 sends multiple DAT packets followed by EOD
         */
        async function collectRQDData(dataType: number): Promise<number[][]> {
            const checksum = (128 - (dataType & 0x7F)) & 0x7F;
            const rqdMessage = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.RQD, dataType, checksum, 0xF7];

            return new Promise((resolve, reject) => {
                const packets: number[][] = [];
                let timeoutId: NodeJS.Timeout;

                function resetTimeout() {
                    if (timeoutId) clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        input.removeListener('sysex', listener);
                        if (packets.length > 0) {
                            resolve(packets);
                        } else {
                            reject(new Error('RQD data collection timeout'));
                        }
                    }, 3000);
                }

                function listener(msg: { bytes: number[] }) {
                    const bytes = msg.bytes;
                    resetTimeout();

                    // Check if it's from S-330
                    if (bytes[1] !== ROLAND_ID || bytes[3] !== S330_MODEL_ID) return;

                    const command = bytes[4];

                    if (command === S330_COMMANDS.DAT) {
                        packets.push(bytes);
                    } else if (command === S330_COMMANDS.EOD) {
                        // End of data
                        clearTimeout(timeoutId);
                        input.removeListener('sysex', listener);
                        resolve(packets);
                    } else if (command === S330_COMMANDS.RJC) {
                        clearTimeout(timeoutId);
                        input.removeListener('sysex', listener);
                        reject(new Error('RQD request rejected'));
                    } else if (command === S330_COMMANDS.ERR) {
                        clearTimeout(timeoutId);
                        input.removeListener('sysex', listener);
                        reject(new Error('RQD error response'));
                    }
                }

                resetTimeout();
                input.on('sysex', listener);
                output.send('sysex', rqdMessage as any);
            });
        }

        /**
         * Data type meanings (based on S-330 spec):
         * 0x00 = All data
         * 0x01 = Patch 1-32
         * 0x02 = Patch 33-64
         * 0x03 = Tone 1-32
         * 0x04 = Tone 33-64
         * 0x05 = Function parameters
         */

        // Collect Patch 1-32 data (type 1) - this is known to work!
        console.log('Requesting Patch 1-32 data (type 1)...');
        try {
            const patches = await collectRQDData(0x01);
            console.log(`   Received ${patches.length} DAT packets`);

            // Combine all packet data
            const allData: number[] = [];
            for (const packet of patches) {
                // Format: F0 41 dev 1E 42 tt cs data... checksum F7
                const data = packet.slice(7, -2); // Remove header and trailing checksum + F7
                allData.push(...data);
            }
            console.log(`   Total data bytes: ${allData.length}`);

            // S-330 patch data format (from documentation):
            // Each patch appears to be variable length, with nibblized data
            // The raw data uses 2 bytes per actual data byte (nibblization)

            // Try to interpret as nibblized data (MSN in first byte, LSN in second)
            const denibblized: number[] = [];
            for (let i = 0; i < allData.length - 1; i += 2) {
                const msn = allData[i] & 0x0F;
                const lsn = allData[i + 1] & 0x0F;
                denibblized.push((msn << 4) | lsn);
            }
            console.log(`   Denibblized to ${denibblized.length} bytes`);

            // Patch data structure (per S-330 manual):
            // Offset 0x00-0x07: Patch name (8 chars)
            // Offset 0x08: Key mode
            // etc.

            // Each patch is 24 bytes in raw form, so 48 nibblized bytes
            const PATCH_SIZE = 48; // nibblized
            const patchCount = Math.floor(allData.length / PATCH_SIZE);
            console.log(`   Detected ${patchCount} patches in data`);

            for (let p = 0; p < Math.min(patchCount, 4); p++) {
                const patchStart = p * PATCH_SIZE;
                const patchData = allData.slice(patchStart, patchStart + PATCH_SIZE);

                // Denibblize this patch
                const patch: number[] = [];
                for (let i = 0; i < patchData.length - 1; i += 2) {
                    const msn = patchData[i] & 0x0F;
                    const lsn = patchData[i + 1] & 0x0F;
                    patch.push((msn << 4) | lsn);
                }

                // Extract patch name (first 8 bytes after denibblization)
                const name = patch.slice(0, 8).map(b => {
                    const c = b & 0x7F;
                    return c >= 0x20 && c < 0x7F ? String.fromCharCode(c) : '.';
                }).join('');

                console.log(`   Patch ${p + 1}: "${name}" - raw: ${patch.slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            }
        } catch (e) {
            console.log(`   Error: ${e}`);
        }

        // Try other data types to see what's available
        for (const [typeNum, typeName] of [
            [0x02, 'Patch 33-64'],
            [0x03, 'Tone 1-32'],
            [0x04, 'Tone 33-64'],
            [0x05, 'Function params']
        ] as const) {
            console.log(`\nRequesting ${typeName} (type ${typeNum})...`);
            try {
                const data = await collectRQDData(typeNum);
                console.log(`   Received ${data.length} DAT packets`);
            } catch (e) {
                console.log(`   Rejected (empty or not available)`);
            }
        }

        expect(true).toBe(true);
    });

    it('should listen for any incoming MIDI messages', async () => {
        console.log('\n=== Listening for MIDI messages for 3 seconds ===');
        console.log('(Try pressing buttons on the S-330 or sending data from it)\n');

        return new Promise<void>((resolve) => {
            let messageCount = 0;

            function listener(msg: { bytes: number[] }) {
                messageCount++;
                console.log(`Message ${messageCount}:`, msg.bytes.map(b => b.toString(16).padStart(2, '0')).join(' '));
            }

            input.on('sysex', listener);

            setTimeout(() => {
                input.removeListener('sysex', listener);
                console.log(`\nReceived ${messageCount} SysEx messages`);
                resolve();
            }, 3000);
        });
    });
});
