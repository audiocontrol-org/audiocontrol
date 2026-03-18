/**
 * Roland S-330 SysEx Message Builders
 *
 * Re-exports shared S-series message builders with S-330 specific helpers.
 *
 * @packageDocumentation
 */

// =============================================================================
// Re-export all shared message functions
// =============================================================================

export {
    nibblize,
    denibblize,
    calculateChecksum,
    encodeSize,
    buildRQDMessage,
    buildWSDMessage,
    buildDATMessage,
    buildDT1Message,
    buildACKMessage,
    buildEODMessage,
    buildRJCMessage,
    buildERRMessage,
} from '../roland-s-series/index.js';

// =============================================================================
// S-330 Specific Helpers
// =============================================================================

/**
 * Build patch address for RQD/WSD/DAT messages
 *
 * Convenience wrapper that builds patch address with offset 0x00.
 * For addresses with other offsets, use buildPatchAddress from s330-addresses.
 *
 * @param patchNumber - Patch number (0-63)
 * @returns 4-byte address [0x00, 0x00, patchNumber*4, 0x00]
 *
 * @throws Error if patch number out of range
 */
export function buildPatchAddressRQD(patchNumber: number): number[] {
    if (patchNumber < 0 || patchNumber >= 64) {
        throw new Error(`Patch number must be 0-63, got ${patchNumber}`);
    }

    return [0x00, 0x00, (patchNumber * 4) & 0x7F, 0x00];
}
