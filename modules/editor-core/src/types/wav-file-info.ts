/**
 * Shared WAV file metadata type used across editors.
 *
 * Device-specific editors extend this with additional fields
 * (e.g., `duration` for Roland, `samples` for Akai S3K).
 */
export interface WavFileMetadata {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  sampleCount: number;
}
