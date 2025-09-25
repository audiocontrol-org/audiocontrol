/**
 * Launch Control XL 3 device-specific types
 */

// Device slot numbers (1-8 for custom modes)
export type SlotNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// Device state machine
export type DeviceState =
  | { readonly status: 'disconnected' }
  | { readonly status: 'connecting'; readonly startTime: number }
  | {
      readonly status: 'connected';
      readonly deviceName: string;
      readonly portInfo: MidiPortInfo;
      readonly lastHeartbeat: number;
    }
  | {
      readonly status: 'error';
      readonly error: Error;
      readonly retryCount: number;
    };

// MIDI port information
export interface MidiPortInfo {
  readonly id: string;
  readonly name: string;
  readonly manufacturer?: string;
  readonly version?: string;
  readonly state: 'connected' | 'disconnected';
  readonly type: 'input' | 'output';
}

// Device configuration options
export interface DeviceOptions {
  readonly retryPolicy?: RetryPolicy;
  readonly heartbeat?: HeartbeatConfig;
  readonly errorRecovery?: ErrorRecoveryConfig;
  readonly timeout?: TimeoutConfig;
}

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly exponentialBackoff?: boolean;
}

export interface HeartbeatConfig {
  readonly intervalMs: number;
  readonly timeoutMs?: number;
  readonly enabled?: boolean;
}

export interface ErrorRecoveryConfig {
  readonly autoReconnect: boolean;
  readonly reconnectDelayMs?: number;
  readonly maxReconnectAttempts?: number;
}

export interface TimeoutConfig {
  readonly connectionMs: number;
  readonly commandMs: number;
  readonly sysexMs: number;
}

// Device operation results
export interface DeviceOperationResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: DeviceError;
  readonly timestamp: number;
  readonly duration: number; // Operation duration in milliseconds
}

export interface DeviceError {
  readonly code: DeviceErrorCode;
  readonly message: string;
  readonly originalError?: Error;
  readonly context?: Record<string, unknown>;
}

export type DeviceErrorCode =
  | 'NO_MIDI_SUPPORT'
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'CONNECTION_TIMEOUT'
  | 'COMMAND_TIMEOUT'
  | 'SYSEX_ERROR'
  | 'VALIDATION_ERROR'
  | 'PROTOCOL_ERROR'
  | 'DEVICE_BUSY'
  | 'UNEXPECTED_RESPONSE'
  | 'MIDIMUNGE_ERROR'
  | 'CHECKSUM_ERROR';

// Device capabilities and limits
export interface DeviceCapabilities {
  readonly customModeSlots: number; // 8 for XL3
  readonly controlsPerMode: number; // 40 for XL3 (24 knobs + 8 buttons + 8 faders)
  readonly maxMidiChannels: number; // 16
  readonly maxCCNumbers: number; // 128
  readonly firmwareVersion?: string;
  readonly serialNumber?: string;
  readonly modelName: string;
}