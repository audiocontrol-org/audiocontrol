/**
 * Roland S-550 Block Utilities
 *
 * The S-550 is organized as two independent blocks, where each block
 * functions similarly to an S-330:
 *
 * - Block 1: Tones 0-31, Wave Banks A (0) and B (1)
 * - Block 2: Tones 32-63, Wave Banks C (2) and D (3)
 *
 * Within each block:
 * - Tones reference wave banks as 0 or 1 (block-relative)
 * - SOURCE TONE references are block-relative (0-31)
 * - Patches may reference tones from either block using absolute indices
 *
 * This module provides utilities for converting between absolute and
 * block-relative indices, and for determining block membership.
 *
 * @packageDocumentation
 */

import type {
    S550Block,
    S550BlockInfo,
    S550BlockRelativeWaveBank,
    S550AbsoluteWaveBank,
} from './s550-types.js';

import {
    TONES_PER_BLOCK,
    BLOCK_INFO,
    BLOCK_WAVE_BANKS,
} from './s550-config.js';

// =============================================================================
// Block Determination
// =============================================================================

/**
 * Get the block number for a given absolute tone index.
 *
 * @param absoluteToneIndex - Tone index (0-63)
 * @returns Block number (1 or 2)
 * @throws Error if tone index is out of range
 *
 * @example
 * ```typescript
 * getBlockForTone(0);   // 1
 * getBlockForTone(31);  // 1
 * getBlockForTone(32);  // 2
 * getBlockForTone(63);  // 2
 * ```
 */
export function getBlockForTone(absoluteToneIndex: number): S550Block {
    if (absoluteToneIndex < 0 || absoluteToneIndex > 63) {
        throw new Error(`Tone index ${absoluteToneIndex} out of range (0-63)`);
    }
    return absoluteToneIndex < TONES_PER_BLOCK ? 1 : 2;
}

/**
 * Get block information for a given block number.
 *
 * @param block - Block number (1 or 2)
 * @returns Block info without disk label
 */
export function getBlockInfo(block: S550Block): Omit<S550BlockInfo, 'diskLabel'> {
    return BLOCK_INFO[block];
}

/**
 * Check if a tone index is within a specific block.
 *
 * @param absoluteToneIndex - Tone index (0-63)
 * @param block - Block to check
 * @returns True if the tone belongs to the specified block
 */
export function isToneInBlock(absoluteToneIndex: number, block: S550Block): boolean {
    const info = BLOCK_INFO[block];
    return absoluteToneIndex >= info.firstToneIndex && absoluteToneIndex <= info.lastToneIndex;
}

// =============================================================================
// Tone Index Conversion
// =============================================================================

/**
 * Convert an absolute tone index (0-63) to a block-relative index (0-31).
 *
 * @param absoluteToneIndex - Tone index (0-63)
 * @returns Block-relative index (0-31)
 *
 * @example
 * ```typescript
 * getBlockRelativeToneIndex(0);   // 0
 * getBlockRelativeToneIndex(31);  // 31
 * getBlockRelativeToneIndex(32);  // 0
 * getBlockRelativeToneIndex(63);  // 31
 * ```
 */
export function getBlockRelativeToneIndex(absoluteToneIndex: number): number {
    if (absoluteToneIndex < 0 || absoluteToneIndex > 63) {
        throw new Error(`Tone index ${absoluteToneIndex} out of range (0-63)`);
    }
    return absoluteToneIndex % TONES_PER_BLOCK;
}

/**
 * Convert a block-relative tone index (0-31) to an absolute index (0-63).
 *
 * @param blockRelativeIndex - Block-relative tone index (0-31)
 * @param block - Block number (1 or 2)
 * @returns Absolute tone index (0-63)
 *
 * @example
 * ```typescript
 * getAbsoluteToneIndex(0, 1);   // 0
 * getAbsoluteToneIndex(31, 1);  // 31
 * getAbsoluteToneIndex(0, 2);   // 32
 * getAbsoluteToneIndex(31, 2);  // 63
 * ```
 */
export function getAbsoluteToneIndex(blockRelativeIndex: number, block: S550Block): number {
    if (blockRelativeIndex < 0 || blockRelativeIndex > 31) {
        throw new Error(`Block-relative tone index ${blockRelativeIndex} out of range (0-31)`);
    }
    const info = BLOCK_INFO[block];
    return info.firstToneIndex + blockRelativeIndex;
}

// =============================================================================
// Wave Bank Conversion
// =============================================================================

/**
 * Convert a block-relative wave bank (0 or 1) to an absolute wave bank (0-3).
 *
 * @param blockRelativeBank - Block-relative wave bank (0 or 1)
 * @param block - Block number (1 or 2)
 * @returns Absolute wave bank (0-3)
 *
 * @example
 * ```typescript
 * getAbsoluteWaveBank(0, 1);  // 0 (Bank A)
 * getAbsoluteWaveBank(1, 1);  // 1 (Bank B)
 * getAbsoluteWaveBank(0, 2);  // 2 (Bank C)
 * getAbsoluteWaveBank(1, 2);  // 3 (Bank D)
 * ```
 */
export function getAbsoluteWaveBank(
    blockRelativeBank: S550BlockRelativeWaveBank,
    block: S550Block
): S550AbsoluteWaveBank {
    return BLOCK_WAVE_BANKS[block][blockRelativeBank];
}

/**
 * Convert an absolute wave bank (0-3) to a block-relative wave bank (0 or 1).
 *
 * @param absoluteBank - Absolute wave bank (0-3)
 * @returns Object with block number and block-relative bank index
 *
 * @example
 * ```typescript
 * getBlockRelativeWaveBank(0);  // { block: 1, bankIndex: 0 }
 * getBlockRelativeWaveBank(1);  // { block: 1, bankIndex: 1 }
 * getBlockRelativeWaveBank(2);  // { block: 2, bankIndex: 0 }
 * getBlockRelativeWaveBank(3);  // { block: 2, bankIndex: 1 }
 * ```
 */
export function getBlockRelativeWaveBank(
    absoluteBank: S550AbsoluteWaveBank
): { block: S550Block; bankIndex: S550BlockRelativeWaveBank } {
    if (absoluteBank <= 1) {
        return { block: 1, bankIndex: absoluteBank as S550BlockRelativeWaveBank };
    } else {
        return { block: 2, bankIndex: (absoluteBank - 2) as S550BlockRelativeWaveBank };
    }
}

/**
 * Get the block that a wave bank belongs to.
 *
 * @param absoluteBank - Absolute wave bank (0-3)
 * @returns Block number (1 or 2)
 */
export function getBlockForWaveBank(absoluteBank: S550AbsoluteWaveBank): S550Block {
    return absoluteBank <= 1 ? 1 : 2;
}

/**
 * Check if a wave bank is valid for a given block.
 *
 * @param absoluteBank - Absolute wave bank (0-3)
 * @param block - Block number (1 or 2)
 * @returns True if the wave bank belongs to the specified block
 */
export function isWaveBankInBlock(absoluteBank: S550AbsoluteWaveBank, block: S550Block): boolean {
    const blockBanks = BLOCK_WAVE_BANKS[block];
    return blockBanks.includes(absoluteBank);
}

// =============================================================================
// Wave Bank Name Utilities
// =============================================================================

/** Wave bank letter names */
export const WAVE_BANK_NAMES = ['A', 'B', 'C', 'D'] as const;

/**
 * Get the letter name for an absolute wave bank.
 *
 * @param absoluteBank - Absolute wave bank (0-3)
 * @returns Bank letter ('A', 'B', 'C', or 'D')
 */
export function getWaveBankName(absoluteBank: S550AbsoluteWaveBank): 'A' | 'B' | 'C' | 'D' {
    return WAVE_BANK_NAMES[absoluteBank];
}

/**
 * Parse a wave bank letter to an absolute bank index.
 *
 * @param name - Bank letter ('A', 'B', 'C', or 'D')
 * @returns Absolute wave bank (0-3)
 */
export function parseWaveBankName(name: 'A' | 'B' | 'C' | 'D'): S550AbsoluteWaveBank {
    const index = WAVE_BANK_NAMES.indexOf(name);
    if (index === -1) {
        throw new Error(`Invalid wave bank name: ${name}`);
    }
    return index as S550AbsoluteWaveBank;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate that a tone's wave bank is appropriate for its block.
 *
 * In the S-550, tones in Block 1 should only reference wave banks A (0) or B (1),
 * and tones in Block 2 should only reference wave banks C (2) or D (3).
 *
 * @param absoluteToneIndex - Tone index (0-63)
 * @param absoluteWaveBank - Wave bank (0-3)
 * @returns True if the wave bank is valid for the tone's block
 */
export function isValidWaveBankForTone(
    absoluteToneIndex: number,
    absoluteWaveBank: S550AbsoluteWaveBank
): boolean {
    const block = getBlockForTone(absoluteToneIndex);
    return isWaveBankInBlock(absoluteWaveBank, block);
}

/**
 * Get the valid wave banks for a tone.
 *
 * @param absoluteToneIndex - Tone index (0-63)
 * @returns Array of valid absolute wave bank indices
 */
export function getValidWaveBanksForTone(
    absoluteToneIndex: number
): readonly [S550AbsoluteWaveBank, S550AbsoluteWaveBank] {
    const block = getBlockForTone(absoluteToneIndex);
    return BLOCK_WAVE_BANKS[block];
}
