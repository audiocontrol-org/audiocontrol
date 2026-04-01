export {
  AkaiOpcode,
  AKAI_MANUFACTURER_ID,
  S3000XL_DEVICE_ID,
  SYSEX_START,
  SYSEX_END,
  DEFAULT_TIMING,
  buildAkaiSysEx,
  parseAkaiResponse,
  isErrorResponse,
  parseNameList,
} from '@/devices/s3000xl/s3000xl-protocol.js';

export type {
  ProgramHeader,
  KeygroupHeader,
  SampleHeader,
  ProgressCallback,
  S3000xlClientOptions,
  S3000xlClientInterface,
  S3000xlClientDeps,
} from '@/devices/s3000xl/s3000xl-types.js';

export { createS3000xlClient } from '@/devices/s3000xl/s3000xl-client.js';

export { S3K_SDS_BITS_PER_WORD } from '@/devices/s3000xl/s3000xl-sds-config.js';

export type { SdsTransferProgress, SdsDumpHeader, SdsLoopType } from '@audiocontrol/midi-core';
