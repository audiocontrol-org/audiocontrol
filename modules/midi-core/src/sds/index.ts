// Types
export type {
  SdsLoopType,
  SdsDumpHeader,
  SdsDataPacket,
  SdsDumpRequest,
  SdsAck,
  SdsNak,
  SdsWait,
  SdsCancel,
  SdsMessage,
  SdsTransferProgress,
  SdsSenderOptions,
  SdsReceiverOptions,
} from './sds-types';

// Constants
export {
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
  LOOP_FORWARD,
  LOOP_FORWARD_BACKWARD,
  LOOP_OFF,
  DATA_PACKET_PAYLOAD_SIZE,
  PACKET_COUNTER_MAX,
  MAX_SAMPLE_NUMBER,
  MIN_BIT_DEPTH,
  MAX_BIT_DEPTH,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
} from './sds-constants';

// Message builders and parsers
export {
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
} from './sds-messages';

// Sample data encoding
export {
  encodeSampleWord,
  decodeSampleWord,
  encodeSampleData,
  decodeSampleData,
  samplesToPackets,
  packetsToSamples,
  calculatePacketCount,
} from './sds-encoding';

// Transfer state machines
export {
  createSdsSender,
  createSdsReceiver,
  requestSample,
} from './sds-transfer';
export type { SdsSender } from './sds-sender';
export type { SdsReceiver } from './sds-receiver';
