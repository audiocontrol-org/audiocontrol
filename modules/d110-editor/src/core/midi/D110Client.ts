/**
 * D-110 MIDI Client
 *
 * High-level client for communicating with the Roland D-110.
 * Handles SysEx message construction, sending, and response parsing.
 */

import type {
  D110MidiIO,
  D110Address,
  D110Tone,
  D110Patch,
  PartConfig,
  SystemParams,
  ToneCommon,
  PartialParams,
  PitchEnvelope,
  TvfEnvelope,
  TvaEnvelope,
  LfoParams,
  D110ClientOptions,
  D110ClientInterface,
  ToneGroup,
  AssignMode,
  OutputAssign,
  ReverbMode,
} from '@/core/midi/types';
import {
  DEFAULT_DEVICE_ID,
  TIMING,
  TONE_DATA_SIZE,
  PART_TIMBRE_SIZE,
  SYSTEM_PARAMS_SIZE,
  TONE_NAME_LENGTH,
  PATCH_NAME_LENGTH,
  NUM_PARTS,
  PARTIAL_OFFSETS,
} from '@/core/midi/constants';
import {
  buildDT1Message,
  buildRQ1Message,
  parseSysExMessage,
  isD110Message,
  getTempToneAddress,
  getPartTimbreAddress,
  getSystemAddress,
  formatBytes,
} from '@/core/midi/sysex';

/**
 * Create a D-110 client
 *
 * @param midi - MIDI I/O adapter
 * @param options - Client options
 * @returns D110ClientInterface
 */
export function createD110Client(
  midi: D110MidiIO,
  options: D110ClientOptions = {}
): D110ClientInterface {
  const deviceId = options.deviceId ?? DEFAULT_DEVICE_ID;
  const timeoutMs = options.timeoutMs ?? TIMING.TIMEOUT_MS;

  /**
   * Send a request and wait for response
   */
  async function requestData(address: D110Address, size: number): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        midi.removeSysExListener(handler);
        reject(new Error(`Timeout waiting for response from D-110 at address ${formatAddress(address)}`));
      }, timeoutMs);

      const handler = (message: number[]): void => {
        if (!isD110Message(message)) return;

        const parsed = parseSysExMessage(message);
        if (!parsed.isValid) {
          console.warn('[D110] Invalid response:', parsed.error);
          return;
        }

        // Check if this is a response to our request (matching address)
        if (
          parsed.address.aa === address.aa &&
          parsed.address.bb === address.bb &&
          parsed.address.cc === address.cc
        ) {
          clearTimeout(timeoutId);
          midi.removeSysExListener(handler);
          resolve(parsed.data);
        }
      };

      midi.onSysEx(handler);

      const request = buildRQ1Message(address, size, deviceId);
      console.log('[D110] Sending request:', formatBytes(request));
      midi.send(request);
    });
  }

  /**
   * Send a parameter value
   */
  async function sendParameter(address: D110Address, data: number[]): Promise<void> {
    const message = buildDT1Message(address, data, deviceId);
    console.log('[D110] Sending parameter:', formatBytes(message));
    midi.send(message);

    // Small delay after sending to allow device to process
    await new Promise((resolve) => setTimeout(resolve, TIMING.PARAM_DELAY_MS));
  }

  /**
   * Parse tone data from raw bytes
   */
  function parseToneData(data: number[]): D110Tone {
    if (data.length < TONE_DATA_SIZE) {
      throw new Error(`Tone data too short: ${data.length} bytes, expected ${TONE_DATA_SIZE}`);
    }

    // Parse common parameters (first 14 bytes)
    const common = parseToneCommon(data.slice(0, 14));

    // Parse 4 partials
    const partial1 = parsePartialParams(data, PARTIAL_OFFSETS[0]);
    const partial2 = parsePartialParams(data, PARTIAL_OFFSETS[1]);
    const partial3 = parsePartialParams(data, PARTIAL_OFFSETS[2]);
    const partial4 = parsePartialParams(data, PARTIAL_OFFSETS[3]);

    return {
      common,
      partial1,
      partial2,
      partial3,
      partial4,
    };
  }

  /**
   * Parse tone common parameters
   */
  function parseToneCommon(data: number[]): ToneCommon {
    // Name is first 10 bytes as ASCII
    const nameBytes = data.slice(0, TONE_NAME_LENGTH);
    const name = String.fromCharCode(...nameBytes).trim();

    return {
      name,
      structure12: data[10] as ToneCommon['structure12'],
      structure34: data[11] as ToneCommon['structure34'],
      partialMutes: {
        // Bits represent "partial ON", so invert: bit=1 means NOT muted
        partial1: (data[12] & 0x01) === 0,
        partial2: (data[12] & 0x02) === 0,
        partial3: (data[12] & 0x04) === 0,
        partial4: (data[12] & 0x08) === 0,
      },
      envMode: data[13],
    };
  }

  /**
   * Parse partial parameters from tone data
   *
   * D-110 partial parameter layout (58 bytes):
   *   0-7:   Pitch section (8 bytes)
   *   8-19:  Pitch envelope (12 bytes)
   *   20-22: LFO section (3 bytes)
   *   23-40: TVF section (18 bytes)
   *   41-57: TVA section (17 bytes)
   */
  function parsePartialParams(data: number[], offset: number): PartialParams {
    const d = (i: number): number => data[offset + i] ?? 0;

    // Pitch envelope (8-19)
    const pitchEnvelope: PitchEnvelope = {
      depth: d(8),
      velocitySensitivity: d(9),
      timeKeyfollow: d(10),
      time1: d(11),
      time2: d(12),
      time3: d(13),
      time4: d(14),
      level0: d(15),
      level1: d(16),
      level2: d(17),
      sustainLevel: d(18),
      endLevel: d(19),
    };

    // LFO section (20-22) - comes BEFORE TVF in D-110 memory
    const lfo: LfoParams = {
      rate: d(20),
      depth: d(21),
      modulationSensitivity: d(22),
    };

    // TVF envelope (28-40)
    const tvfEnvelope: TvfEnvelope = {
      depth: d(28),
      velocitySensitivity: d(29),
      depthKeyfollow: d(30),
      timeKeyfollow: d(31),
      time1: d(32),
      time2: d(33),
      time3: d(34),
      time4: d(35),
      time5: d(36),
      level1: d(37),
      level2: d(38),
      level3: d(39),
      sustainLevel: d(40),
    };

    // TVA envelope (47-57)
    const tvaEnvelope: TvaEnvelope = {
      timeKeyfollow: d(47),
      time1Velocity: d(48),
      time1: d(49),
      time2: d(50),
      time3: d(51),
      time4: d(52),
      time5: d(53),
      level1: d(54),
      level2: d(55),
      level3: d(56),
      sustainLevel: d(57),
    };

    return {
      // Pitch section (0-7)
      pitchCoarse: d(0),
      pitchFine: d(1),
      pitchKeyfollow: d(2),
      pitchBenderSwitch: d(3) !== 0,
      waveform: d(4),
      pcmWaveNumber: d(5),
      pulseWidth: d(6),
      pulseWidthVelocity: d(7),

      // Pitch envelope (8-19)
      pitchEnvelope,

      // LFO section (20-22)
      lfo,

      // Filter (TVF) section (23-40)
      tvfCutoff: d(23),
      tvfResonance: d(24),
      tvfKeyfollow: d(25),
      tvfBiasPoint: d(26),
      tvfBiasLevel: d(27),
      tvfEnvelope,

      // Amplifier (TVA) section (41-57)
      tvaLevel: d(41),
      tvaVelocitySensitivity: d(42),
      tvaBiasPoint1: d(43),
      tvaBiasLevel1: d(44),
      tvaBiasPoint2: d(45),
      tvaBiasLevel2: d(46),
      tvaEnvelope,
    };
  }

  /**
   * Parse part configuration from raw bytes
   */
  function parsePartConfig(data: number[]): PartConfig {
    if (data.length < PART_TIMBRE_SIZE) {
      throw new Error(`Part data too short: ${data.length} bytes`);
    }

    return {
      toneGroup: data[0] as ToneGroup,
      toneNumber: data[1],
      keyShift: data[2],
      fineTune: data[3],
      benderRange: data[4],
      assignMode: data[5] as AssignMode,
      outputAssign: data[6] as OutputAssign,
      outputLevel: data[8],
      pan: data[9],
      keyRangeLower: data[10],
      keyRangeUpper: data[11],
    };
  }

  /**
   * Parse system parameters from raw bytes
   */
  function parseSystemParams(data: number[]): SystemParams {
    if (data.length < SYSTEM_PARAMS_SIZE) {
      throw new Error(`System data too short: ${data.length} bytes`);
    }

    // System params start at offset 1 (skip master tune at offset 0)
    const partialReserve: number[] = [];
    for (let i = 0; i < NUM_PARTS + 1; i++) {
      partialReserve.push(data[4 + i]);
    }

    const midiChannels: number[] = [];
    for (let i = 0; i < NUM_PARTS + 1; i++) {
      midiChannels.push(data[13 + i]);
    }

    return {
      reverbMode: data[1] as ReverbMode,
      reverbTime: data[2],
      reverbLevel: data[3],
      partialReserve,
      midiChannels,
    };
  }

  return {
    async requestTone(partIndex: number): Promise<D110Tone> {
      if (partIndex < 0 || partIndex > 7) {
        throw new Error(`Invalid part index: ${partIndex}`);
      }

      const address = getTempToneAddress(partIndex);
      const data = await requestData(address, TONE_DATA_SIZE);
      return parseToneData(data);
    },

    async sendToneParameter(
      partIndex: number,
      address: D110Address,
      value: number
    ): Promise<void> {
      if (partIndex < 0 || partIndex > 7) {
        throw new Error(`Invalid part index: ${partIndex}`);
      }

      // Calculate the full address including part offset
      const baseAddress = getTempToneAddress(partIndex);
      const fullAddress: D110Address = {
        aa: baseAddress.aa,
        bb: baseAddress.bb + address.bb,
        cc: baseAddress.cc + address.cc,
      };

      // Handle overflow from CC to BB
      if (fullAddress.cc > 0x7f) {
        fullAddress.bb += fullAddress.cc >> 7;
        fullAddress.cc = fullAddress.cc & 0x7f;
      }

      await sendParameter(fullAddress, [value]);
    },

    async requestPatch(): Promise<D110Patch> {
      // Request system parameters
      const systemAddress = getSystemAddress();
      const systemData = await requestData(systemAddress, SYSTEM_PARAMS_SIZE);
      const system = parseSystemParams(systemData);

      // Request all part configurations
      const parts: PartConfig[] = [];
      for (let i = 0; i < NUM_PARTS; i++) {
        const partAddress = getPartTimbreAddress(i);
        const partData = await requestData(partAddress, PART_TIMBRE_SIZE);
        parts.push(parsePartConfig(partData));

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, TIMING.MESSAGE_DELAY_MS));
      }

      // Extract patch name from system data (last 10 bytes)
      const nameBytes = systemData.slice(22, 22 + PATCH_NAME_LENGTH);
      const name = String.fromCharCode(...nameBytes).trim();

      return {
        name,
        system,
        parts,
      };
    },

    async sendPatchParameter(address: D110Address, value: number): Promise<void> {
      await sendParameter(address, [value]);
    },

    async requestPartConfig(partIndex: number): Promise<PartConfig> {
      if (partIndex < 0 || partIndex > 8) {
        throw new Error(`Invalid part index: ${partIndex}`);
      }

      const address = getPartTimbreAddress(partIndex);
      const data = await requestData(address, PART_TIMBRE_SIZE);
      return parsePartConfig(data);
    },

    async sendPartParameter(
      partIndex: number,
      paramOffset: number,
      value: number
    ): Promise<void> {
      if (partIndex < 0 || partIndex > 8) {
        throw new Error(`Invalid part index: ${partIndex}`);
      }

      const address = getPartTimbreAddress(partIndex);
      const fullAddress: D110Address = {
        aa: address.aa,
        bb: address.bb,
        cc: address.cc + paramOffset,
      };

      await sendParameter(fullAddress, [value]);
    },

    async requestSystemParams(): Promise<SystemParams> {
      const address = getSystemAddress();
      const data = await requestData(address, SYSTEM_PARAMS_SIZE);
      return parseSystemParams(data);
    },

    async sendSystemParameter(offset: number, value: number): Promise<void> {
      const address = getSystemAddress();
      const fullAddress: D110Address = {
        aa: address.aa,
        bb: address.bb,
        cc: address.cc + offset,
      };

      await sendParameter(fullAddress, [value]);
    },
  };
}

/**
 * Format address for logging
 */
function formatAddress(address: D110Address): string {
  return `${address.aa.toString(16).padStart(2, '0')}:${address.bb.toString(16).padStart(2, '0')}:${address.cc.toString(16).padStart(2, '0')}`;
}
