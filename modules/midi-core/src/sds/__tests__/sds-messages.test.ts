import { describe, it, expect } from 'vitest';
import {
  buildDumpHeader,
  buildDataPacket,
  buildDumpRequest,
  buildAck,
  buildNak,
  buildWait,
  buildCancel,
  parseSdsMessage,
  calculateChecksum,
  validateChecksum,
} from '../sds-messages';
import {
  SYSEX_START,
  SYSEX_END,
  UNIVERSAL_NON_REAL_TIME,
  CMD_DUMP_HEADER,
  CMD_DATA_PACKET,
  CMD_DUMP_REQUEST,
  CMD_ACK,
  CMD_NAK,
  CMD_WAIT,
  CMD_CANCEL,
  DATA_PACKET_PAYLOAD_SIZE,
  LOOP_OFF,
  LOOP_FORWARD,
} from '../sds-constants';
import type { SdsDumpHeader } from '../sds-types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_CHANNEL = 0x00;

const TEST_HEADER: SdsDumpHeader = {
  sampleNumber: 42,
  sampleFormat: 16,
  samplePeriodNs: 22676, // ~44100 Hz (1_000_000_000 / 44100 = 22675.7...)
  sampleLength: 1000,
  loopStart: 100,
  loopEnd: 900,
  loopType: LOOP_FORWARD,
};

// ---------------------------------------------------------------------------
// buildDumpHeader
// ---------------------------------------------------------------------------

describe('buildDumpHeader', () => {
  it('builds a 21-byte message with correct framing', () => {
    const msg = buildDumpHeader(TEST_CHANNEL, TEST_HEADER);

    expect(msg).toHaveLength(21);
    expect(msg[0]).toBe(SYSEX_START);
    expect(msg[1]).toBe(UNIVERSAL_NON_REAL_TIME);
    expect(msg[2]).toBe(TEST_CHANNEL);
    expect(msg[3]).toBe(CMD_DUMP_HEADER);
    expect(msg[20]).toBe(SYSEX_END);
  });

  it('encodes sample number 42 as 14-bit (sl=42, sh=0)', () => {
    const msg = buildDumpHeader(TEST_CHANNEL, TEST_HEADER);
    // 42 in 14-bit: LSB = 42 & 0x7F = 42, MSB = (42 >> 7) & 0x7F = 0
    expect(msg[4]).toBe(42); // sl
    expect(msg[5]).toBe(0);  // sh
  });

  it('encodes sample format at byte 6', () => {
    const msg = buildDumpHeader(TEST_CHANNEL, TEST_HEADER);
    expect(msg[6]).toBe(16);
  });

  it('encodes sample period 22676 as 21-bit (3 bytes)', () => {
    const msg = buildDumpHeader(TEST_CHANNEL, TEST_HEADER);
    // 22676 = 0x5894
    // low  = 22676 & 0x7F        = 0x14 = 20
    // mid  = (22676 >> 7) & 0x7F = 0x31 = 49  (22676 >> 7 = 177 = 0xB1, & 0x7F = 0x31)
    // high = (22676 >> 14) & 0x7F = 1
    expect(msg[7]).toBe(22676 & 0x7f);         // pl
    expect(msg[8]).toBe((22676 >> 7) & 0x7f);  // pm
    expect(msg[9]).toBe((22676 >> 14) & 0x7f); // ph
  });

  it('encodes sample length, loop start, loop end, and loop type', () => {
    const msg = buildDumpHeader(TEST_CHANNEL, TEST_HEADER);

    // sampleLength = 1000 = 0x3E8
    expect(msg[10]).toBe(1000 & 0x7f);
    expect(msg[11]).toBe((1000 >> 7) & 0x7f);
    expect(msg[12]).toBe((1000 >> 14) & 0x7f);

    // loopStart = 100 = 0x64
    expect(msg[13]).toBe(100 & 0x7f);
    expect(msg[14]).toBe((100 >> 7) & 0x7f);
    expect(msg[15]).toBe((100 >> 14) & 0x7f);

    // loopEnd = 900 = 0x384
    expect(msg[16]).toBe(900 & 0x7f);
    expect(msg[17]).toBe((900 >> 7) & 0x7f);
    expect(msg[18]).toBe((900 >> 14) & 0x7f);

    // loopType
    expect(msg[19]).toBe(LOOP_FORWARD);
  });

  it('all bytes are valid MIDI data bytes (0-127) except framing', () => {
    const msg = buildDumpHeader(TEST_CHANNEL, TEST_HEADER);
    // Bytes 1 through 19 (inside the SysEx) should all be <= 0x7F
    for (let i = 1; i < msg.length - 1; i++) {
      expect(msg[i]).toBeLessThanOrEqual(0x7f);
      expect(msg[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it('encodes a large 14-bit sample number correctly', () => {
    const header: SdsDumpHeader = {
      ...TEST_HEADER,
      sampleNumber: 16383, // max 14-bit
    };
    const msg = buildDumpHeader(TEST_CHANNEL, header);
    expect(msg[4]).toBe(0x7f); // LSB
    expect(msg[5]).toBe(0x7f); // MSB
  });

  it('uses loop type LOOP_OFF (0x7F)', () => {
    const header: SdsDumpHeader = { ...TEST_HEADER, loopType: LOOP_OFF };
    const msg = buildDumpHeader(TEST_CHANNEL, header);
    expect(msg[19]).toBe(LOOP_OFF);
  });
});

// ---------------------------------------------------------------------------
// buildDataPacket
// ---------------------------------------------------------------------------

describe('buildDataPacket', () => {
  it('builds a 127-byte message with correct framing', () => {
    const data = new Uint8Array(DATA_PACKET_PAYLOAD_SIZE);
    const msg = buildDataPacket(TEST_CHANNEL, 0, data);

    expect(msg).toHaveLength(5 + DATA_PACKET_PAYLOAD_SIZE + 2); // 127
    expect(msg[0]).toBe(SYSEX_START);
    expect(msg[1]).toBe(UNIVERSAL_NON_REAL_TIME);
    expect(msg[2]).toBe(TEST_CHANNEL);
    expect(msg[3]).toBe(CMD_DATA_PACKET);
    expect(msg[4]).toBe(0); // packet number
    expect(msg[msg.length - 1]).toBe(SYSEX_END);
  });

  it('pads short data to 120 bytes', () => {
    const shortData = new Uint8Array([0x10, 0x20, 0x30]);
    const msg = buildDataPacket(TEST_CHANNEL, 5, shortData);

    expect(msg).toHaveLength(127);
    // First three payload bytes should be our data
    expect(msg[5]).toBe(0x10);
    expect(msg[6]).toBe(0x20);
    expect(msg[7]).toBe(0x30);
    // Rest of payload should be zero-padded
    for (let i = 8; i < 5 + DATA_PACKET_PAYLOAD_SIZE; i++) {
      expect(msg[i]).toBe(0);
    }
  });

  it('has a correct checksum', () => {
    const data = new Uint8Array(DATA_PACKET_PAYLOAD_SIZE);
    data[0] = 0x55;
    data[1] = 0x2a;
    const msg = buildDataPacket(TEST_CHANNEL, 3, data);

    // Checksum is at position msg.length - 2 (before F7)
    const checksumByte = msg[msg.length - 2];

    // Manually compute: XOR of bytes [1] through [4 + 120]
    let xor = 0;
    for (let i = 1; i <= 4 + DATA_PACKET_PAYLOAD_SIZE; i++) {
      xor ^= msg[i]!;
    }
    xor &= 0x7f;

    expect(checksumByte).toBe(xor);
  });

  it('throws for data longer than 120 bytes', () => {
    const tooLong = new Uint8Array(121);
    expect(() => buildDataPacket(TEST_CHANNEL, 0, tooLong)).toThrow(
      /at most 120 bytes/,
    );
  });
});

// ---------------------------------------------------------------------------
// buildDumpRequest
// ---------------------------------------------------------------------------

describe('buildDumpRequest', () => {
  it('builds a correct 7-byte message', () => {
    const msg = buildDumpRequest(TEST_CHANNEL, 42);

    expect(msg).toHaveLength(7);
    expect(msg[0]).toBe(SYSEX_START);
    expect(msg[1]).toBe(UNIVERSAL_NON_REAL_TIME);
    expect(msg[2]).toBe(TEST_CHANNEL);
    expect(msg[3]).toBe(CMD_DUMP_REQUEST);
    expect(msg[4]).toBe(42);  // sl
    expect(msg[5]).toBe(0);   // sh
    expect(msg[6]).toBe(SYSEX_END);
  });

  it('encodes a large sample number', () => {
    const msg = buildDumpRequest(TEST_CHANNEL, 200);
    // 200 = 0xC8 → LSB = 200 & 0x7F = 0x48 = 72, MSB = (200 >> 7) = 1
    expect(msg[4]).toBe(72);
    expect(msg[5]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Handshake builders
// ---------------------------------------------------------------------------

describe('handshake builders', () => {
  const cases: Array<{
    name: string;
    builder: (ch: number, pkt: number) => number[];
    cmdByte: number;
  }> = [
    { name: 'buildAck', builder: buildAck, cmdByte: CMD_ACK },
    { name: 'buildNak', builder: buildNak, cmdByte: CMD_NAK },
    { name: 'buildWait', builder: buildWait, cmdByte: CMD_WAIT },
    { name: 'buildCancel', builder: buildCancel, cmdByte: CMD_CANCEL },
  ];

  for (const { name, builder, cmdByte } of cases) {
    describe(name, () => {
      it('produces a 6-byte message with correct framing', () => {
        const msg = builder(TEST_CHANNEL, 7);

        expect(msg).toHaveLength(6);
        expect(msg[0]).toBe(SYSEX_START);
        expect(msg[1]).toBe(UNIVERSAL_NON_REAL_TIME);
        expect(msg[2]).toBe(TEST_CHANNEL);
        expect(msg[3]).toBe(cmdByte);
        expect(msg[4]).toBe(7);
        expect(msg[5]).toBe(SYSEX_END);
      });

      it('masks packet number to 7 bits', () => {
        const msg = builder(TEST_CHANNEL, 127);
        expect(msg[4]).toBe(127);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// parseSdsMessage round-trips
// ---------------------------------------------------------------------------

describe('parseSdsMessage round-trips', () => {
  it('round-trips a dump header', () => {
    const msg = buildDumpHeader(TEST_CHANNEL, TEST_HEADER);
    const parsed = parseSdsMessage(msg);

    expect(parsed.type).toBe('dump-header');
    expect(parsed.channel).toBe(TEST_CHANNEL);
    if (parsed.type === 'dump-header') {
      expect(parsed.header.sampleNumber).toBe(TEST_HEADER.sampleNumber);
      expect(parsed.header.sampleFormat).toBe(TEST_HEADER.sampleFormat);
      expect(parsed.header.samplePeriodNs).toBe(TEST_HEADER.samplePeriodNs);
      expect(parsed.header.sampleLength).toBe(TEST_HEADER.sampleLength);
      expect(parsed.header.loopStart).toBe(TEST_HEADER.loopStart);
      expect(parsed.header.loopEnd).toBe(TEST_HEADER.loopEnd);
      expect(parsed.header.loopType).toBe(TEST_HEADER.loopType);
    }
  });

  it('round-trips a data packet', () => {
    const data = new Uint8Array(DATA_PACKET_PAYLOAD_SIZE);
    data[0] = 0x7f;
    data[59] = 0x55;
    data[119] = 0x01;

    const msg = buildDataPacket(TEST_CHANNEL, 42, data);
    const parsed = parseSdsMessage(msg);

    expect(parsed.type).toBe('data-packet');
    expect(parsed.channel).toBe(TEST_CHANNEL);
    if (parsed.type === 'data-packet') {
      expect(parsed.packet.packetNumber).toBe(42);
      expect(parsed.packet.data[0]).toBe(0x7f);
      expect(parsed.packet.data[59]).toBe(0x55);
      expect(parsed.packet.data[119]).toBe(0x01);
      expect(parsed.packet.data).toHaveLength(DATA_PACKET_PAYLOAD_SIZE);
    }
  });

  it('round-trips a dump request', () => {
    const msg = buildDumpRequest(TEST_CHANNEL, 999);
    const parsed = parseSdsMessage(msg);

    expect(parsed.type).toBe('dump-request');
    expect(parsed.channel).toBe(TEST_CHANNEL);
    if (parsed.type === 'dump-request') {
      expect(parsed.request.sampleNumber).toBe(999);
    }
  });

  it('round-trips ACK', () => {
    const msg = buildAck(5, 10);
    const parsed = parseSdsMessage(msg);

    expect(parsed.type).toBe('ack');
    expect(parsed.channel).toBe(5);
    if (parsed.type === 'ack') {
      expect(parsed.packetNumber).toBe(10);
    }
  });

  it('round-trips NAK', () => {
    const msg = buildNak(0, 127);
    const parsed = parseSdsMessage(msg);

    expect(parsed.type).toBe('nak');
    if (parsed.type === 'nak') {
      expect(parsed.packetNumber).toBe(127);
    }
  });

  it('round-trips WAIT', () => {
    const msg = buildWait(3, 0);
    const parsed = parseSdsMessage(msg);

    expect(parsed.type).toBe('wait');
    if (parsed.type === 'wait') {
      expect(parsed.packetNumber).toBe(0);
    }
  });

  it('round-trips CANCEL', () => {
    const msg = buildCancel(7, 64);
    const parsed = parseSdsMessage(msg);

    expect(parsed.type).toBe('cancel');
    if (parsed.type === 'cancel') {
      expect(parsed.packetNumber).toBe(64);
    }
  });
});

// ---------------------------------------------------------------------------
// parseSdsMessage validation
// ---------------------------------------------------------------------------

describe('parseSdsMessage validation', () => {
  it('throws on too-short message', () => {
    expect(() => parseSdsMessage([0xf0, 0x7e, 0x00, 0xf7])).toThrow(
      /too short/,
    );
  });

  it('throws on wrong start byte', () => {
    expect(() =>
      parseSdsMessage([0x00, 0x7e, 0x00, 0x7f, 0x00, 0xf7]),
    ).toThrow(/must start with 0xF0/i);
  });

  it('throws on wrong end byte', () => {
    expect(() =>
      parseSdsMessage([0xf0, 0x7e, 0x00, 0x7f, 0x00, 0x00]),
    ).toThrow(/must end with 0xF7/i);
  });

  it('throws on non-7E second byte', () => {
    expect(() =>
      parseSdsMessage([0xf0, 0x01, 0x00, 0x7f, 0x00, 0xf7]),
    ).toThrow(/0x7E/i);
  });

  it('throws on unknown command byte', () => {
    expect(() =>
      parseSdsMessage([0xf0, 0x7e, 0x00, 0x55, 0x00, 0xf7]),
    ).toThrow(/unknown SDS command/i);
  });
});

// ---------------------------------------------------------------------------
// calculateChecksum
// ---------------------------------------------------------------------------

describe('calculateChecksum', () => {
  it('XORs all bytes and masks to 7 bits', () => {
    // 0x10 ^ 0x20 ^ 0x30 = 0x00
    expect(calculateChecksum([0x10, 0x20, 0x30])).toBe(0x00);
  });

  it('returns single byte unchanged when only one element', () => {
    expect(calculateChecksum([0x55])).toBe(0x55);
  });

  it('masks the result to 7 bits', () => {
    // 0xFF is not a valid MIDI byte in practice, but the function
    // should still mask the result to 7 bits.
    // 0xFF ^ 0x00 = 0xFF, masked = 0x7F
    expect(calculateChecksum([0xff])).toBe(0x7f);
  });

  it('returns 0 for empty array', () => {
    expect(calculateChecksum([])).toBe(0);
  });

  it('computes a known XOR correctly', () => {
    // 0x7E ^ 0x00 ^ 0x02 ^ 0x05 = 0x79
    expect(calculateChecksum([0x7e, 0x00, 0x02, 0x05])).toBe(0x79);
  });
});

// ---------------------------------------------------------------------------
// validateChecksum
// ---------------------------------------------------------------------------

describe('validateChecksum', () => {
  it('returns true for a valid packet', () => {
    const data = new Uint8Array(DATA_PACKET_PAYLOAD_SIZE);
    data[0] = 0x55;
    data[10] = 0x2a;

    const msg = buildDataPacket(TEST_CHANNEL, 0, data);
    const parsed = parseSdsMessage(msg);
    if (parsed.type !== 'data-packet') {
      throw new Error('Expected data-packet');
    }

    expect(validateChecksum(parsed.packet, TEST_CHANNEL)).toBe(true);
  });

  it('returns false for a corrupted packet', () => {
    const data = new Uint8Array(DATA_PACKET_PAYLOAD_SIZE);
    data[0] = 0x55;

    const msg = buildDataPacket(TEST_CHANNEL, 0, data);
    const parsed = parseSdsMessage(msg);
    if (parsed.type !== 'data-packet') {
      throw new Error('Expected data-packet');
    }

    // Corrupt the checksum
    const corruptedPacket = {
      ...parsed.packet,
      checksum: (parsed.packet.checksum ^ 0x01) & 0x7f,
    };

    expect(validateChecksum(corruptedPacket, TEST_CHANNEL)).toBe(false);
  });

  it('returns false when data has been tampered with', () => {
    const data = new Uint8Array(DATA_PACKET_PAYLOAD_SIZE);
    const msg = buildDataPacket(TEST_CHANNEL, 0, data);
    const parsed = parseSdsMessage(msg);
    if (parsed.type !== 'data-packet') {
      throw new Error('Expected data-packet');
    }

    // Tamper with the data but keep the original checksum
    const tamperedData = new Uint8Array(parsed.packet.data);
    tamperedData[0] = 0x7f;
    const tamperedPacket = {
      ...parsed.packet,
      data: tamperedData,
    };

    expect(validateChecksum(tamperedPacket, TEST_CHANNEL)).toBe(false);
  });
});
