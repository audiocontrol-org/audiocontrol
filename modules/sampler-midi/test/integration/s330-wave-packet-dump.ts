/**
 * S-330 Wave Packet Dump Test
 *
 * Low-level diagnostic that captures raw SysEx packets during wave data transfer.
 * Use this to diagnose corruption at the packet level.
 *
 * Run with: tsx test/integration/s330-wave-packet-dump.ts [toneIndex]
 */

import * as easymidi from 'easymidi';
import * as fs from 'fs';

const MIDI_DEVICE = 'Volt 4';
const TARGET_TONE = parseInt(process.argv[2] ?? '0', 10);

// Roland S-330 constants
const ROLAND_ID = 0x41;
const S330_MODEL_ID = 0x1e;
const CMD_RQD = 0x41;
const CMD_DAT = 0x42;
const CMD_ACK = 0x43;
const CMD_EOD = 0x45;

function calculateChecksum(address: number[], size: number[]): number {
    const sum = address.reduce((a, b) => a + b, 0) + size.reduce((a, b) => a + b, 0);
    return (128 - (sum % 128)) % 128;
}

async function main() {
    console.log('=== S-330 Wave Packet Dump ===\n');
    console.log(`Target tone index: ${TARGET_TONE}`);

    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    const inputName = inputs.find((n) => n.includes(MIDI_DEVICE));
    const outputName = outputs.find((n) => n.includes(MIDI_DEVICE));

    if (!inputName || !outputName) {
        console.error(`\nERROR: ${MIDI_DEVICE} not found`);
        console.log('Available inputs:', inputs);
        console.log('Available outputs:', outputs);
        process.exit(1);
    }

    console.log(`Using MIDI: ${inputName} / ${outputName}\n`);

    const input = new easymidi.Input(inputName);
    const output = new easymidi.Output(outputName);

    // Collect all packets
    const packets: { packetNum: number; address: number[]; data: number[] }[] = [];
    const allBytes: number[] = [];
    let packetCount = 0;
    let done = false;

    // Helper to send ACK
    function sendAck() {
        const ackMsg = [0xf0, ROLAND_ID, 0x00, S330_MODEL_ID, CMD_ACK, 0xf7];
        output.send('sysex', ackMsg as Parameters<typeof output.send>[1]);
    }

    // Helper to dump a packet
    function dumpPacket(packetNum: number, response: number[]) {
        const address = response.slice(5, 9);
        const dataStart = 9;
        const dataEnd = response.length - 2;
        const data = response.slice(dataStart, dataEnd);

        packets.push({ packetNum, address, data });

        console.log(`\n=== PACKET ${packetNum} ===`);
        console.log(`  Total msg length: ${response.length} bytes`);
        console.log(`  Address: ${address.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`  Data length: ${data.length} bytes (${data.length / 2} samples)`);

        // Show first 20 bytes of data
        const preview = data.slice(0, 20);
        console.log(`  Data preview: ${preview.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

        // Check for all-zero packets
        const zeroCount = data.filter(b => b === 0).length;
        if (zeroCount === data.length) {
            console.log(`  ⚠️  ALL ZEROS!`);
        } else if (zeroCount > data.length * 0.9) {
            console.log(`  ⚠️  MOSTLY ZEROS: ${zeroCount}/${data.length}`);
        }

        // Check for alternating pattern
        let alternating = true;
        for (let i = 0; i < Math.min(100, data.length - 4); i += 4) {
            if (data[i] !== data[i + 4] || data[i + 1] !== data[i + 5] ||
                data[i + 2] !== data[i + 6] || data[i + 3] !== data[i + 7]) {
                alternating = false;
                break;
            }
        }
        if (alternating && data.length > 8) {
            console.log(`  ⚠️  ALTERNATING PATTERN DETECTED: ${data.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        }

        allBytes.push(...data);
    }

    return new Promise<void>((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout>;

        function resetTimeout() {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                input.removeListener('sysex', listener);
                finalize();
            }, 5000);
        }

        function finalize() {
            if (done) return;
            done = true;

            console.log('\n\n=== TRANSFER COMPLETE ===');
            console.log(`Total packets received: ${packetCount}`);
            console.log(`Total data bytes: ${allBytes.length}`);
            console.log(`Total samples: ${allBytes.length / 2}`);

            // Analyze the assembled data
            console.log('\n=== ASSEMBLED DATA ANALYSIS ===');
            console.log('First 40 bytes:');
            for (let i = 0; i < Math.min(40, allBytes.length); i += 10) {
                const bytes = allBytes.slice(i, i + 10).map(b => b.toString(16).padStart(2, '0')).join(' ');
                console.log(`  [${i.toString().padStart(5)}]: ${bytes}`);
            }

            // Count zero bytes at the start
            let leadingZeros = 0;
            for (let i = 0; i < allBytes.length; i++) {
                if (allBytes[i] === 0) leadingZeros++;
                else break;
            }
            console.log(`\nLeading zero bytes: ${leadingZeros} (${leadingZeros / 2} zero samples)`);

            // Check for the alternating pattern
            console.log('\n=== PATTERN ANALYSIS ===');
            let patternStart = -1;
            for (let i = 0; i < allBytes.length - 8; i++) {
                if (allBytes[i] !== 0 && allBytes[i + 2] === 0 && allBytes[i + 3] === 0 &&
                    allBytes[i + 4] === allBytes[i] && allBytes[i + 5] === allBytes[i + 1]) {
                    patternStart = i;
                    break;
                }
            }
            if (patternStart >= 0) {
                console.log(`Alternating pattern starts at byte ${patternStart}`);
                console.log(`Pattern: ${allBytes.slice(patternStart, patternStart + 16).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            }

            // Save raw data
            const filename = `tone_${TARGET_TONE}_packets.json`;
            fs.writeFileSync(filename, JSON.stringify(packets, null, 2));
            console.log(`\nSaved packet data to ${filename}`);

            const rawFilename = `tone_${TARGET_TONE}_raw_assembled.bin`;
            fs.writeFileSync(rawFilename, Buffer.from(allBytes));
            console.log(`Saved assembled raw data to ${rawFilename}`);

            input.close();
            output.close();
            resolve();
        }

        function listener(data: { bytes: number[] }) {
            const response = data.bytes;
            if (response.length < 5) return;
            if (response[0] !== 0xf0) return;
            if (response[1] !== ROLAND_ID) return;
            if (response[3] !== S330_MODEL_ID) return;

            const command = response[4];

            resetTimeout();

            if (command === CMD_DAT) {
                packetCount++;
                dumpPacket(packetCount, response);
                sendAck();
            } else if (command === CMD_EOD) {
                console.log('\n=== EOD RECEIVED ===');
                sendAck();
                clearTimeout(timeoutId);
                input.removeListener('sysex', listener);
                setTimeout(finalize, 100);
            }
        }

        input.on('sysex', listener);
        resetTimeout();

        // Calculate wave address for tone
        // From the wave dump test, we know tone 0 is at:
        //   Wave Bank: 1 (Bank B)
        //   Segment Top: 0
        //   Segment Length: 5
        //
        // Address calculation (from s330-client.ts):
        //   SEGMENT_ADDR_STRIDE = 24576
        //   BANK_ADDR_SIZE = SEGMENT_ADDR_STRIDE * 18 = 442368
        //   For Bank B: addrOffset = 1 * 442368 = 442368
        //
        const waveBank = 1; // Bank B (where "HITS 01" is)
        const segmentTop = 0;
        const segmentLength = 5; // 5 segments for this tone

        // Calculate address like the client does
        const SEGMENT_ADDR_STRIDE = 24576;
        const BANK_ADDR_SIZE = SEGMENT_ADDR_STRIDE * 18;
        const addrOffset = waveBank * BANK_ADDR_SIZE + (segmentTop * SEGMENT_ADDR_STRIDE);

        const waveAddress = [
            0x01,
            (addrOffset >> 14) & 0x7f,
            (addrOffset >> 7) & 0x7f,
            addrOffset & 0x7e,
        ];
        const bytesToFetch = segmentLength * 12000 * 2; // samples * 2 bytes per sample

        const size = [
            (bytesToFetch >> 21) & 0x7f,
            (bytesToFetch >> 14) & 0x7f,
            (bytesToFetch >> 7) & 0x7f,
            bytesToFetch & 0x7f,
        ];

        const cs = calculateChecksum(waveAddress, size);
        const message = [
            0xf0,
            ROLAND_ID,
            0x00, // device ID
            S330_MODEL_ID,
            CMD_RQD,
            ...waveAddress,
            ...size,
            cs,
            0xf7,
        ];

        console.log('Sending RQD:', message.map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log(`Requesting ${bytesToFetch} bytes from address ${waveAddress.map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`);

        output.send('sysex', message as Parameters<typeof output.send>[1]);
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
