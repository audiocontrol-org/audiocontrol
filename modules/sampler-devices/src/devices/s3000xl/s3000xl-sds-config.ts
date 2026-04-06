/**
 * S3000XL-specific SDS (Sample Dump Standard) configuration.
 *
 * The S3000XL is a 16-bit sampler. These constants encode that
 * hardware constraint so callers don't need to know it.
 */

/** S3000XL always uses 16-bit samples */
export const S3K_SDS_BITS_PER_WORD = 16;

/**
 * S3000XL SDS channel matches the device's MIDI channel.
 * No mapping is needed — the client passes its configured channel through directly.
 */
