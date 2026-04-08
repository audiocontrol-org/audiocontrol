export {
  createScsiMidiTransport,
  type ScsiMidiBridgeStatus,
  type ScsiDevice,
  type ScsiMidiTransportOptions,
} from './scsi-midi-transport';

// Re-export SdsChannel from types (it lives there because it's transport-agnostic)
export type { SdsChannel } from '../types';

export {
  createScsiDiskClient,
  type ScsiDiskClient,
  type ScsiInquiryResult,
  type ScsiCapacityResult,
  type SampleTransferHeader,
  type SampleTransferProgress,
  type SampleDownloadCallbacks,
  type SampleUploadCallbacks,
} from './scsi-disk-client';
