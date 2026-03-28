/**
 * PatchLabel - Renders a patch slot label with proper font styling.
 *
 * For S-550, Roman numerals (I, II) are rendered in serif font while
 * the Arabic numbers remain in the standard font.
 */

import type { MemoryLayout } from '@/configs/types';

interface PatchLabelProps {
  /** Patch index (0-based) */
  index: number;
  /** Memory layout for formatting */
  memoryLayout: MemoryLayout;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Split a patch label into Roman numeral prefix and Arabic number suffix.
 * Returns null for prefix if the label doesn't start with Roman numerals.
 */
function splitPatchLabel(label: string): { prefix: string | null; suffix: string } {
  // Match Roman numerals at the start (I, II, III, IV, etc.)
  const match = label.match(/^(I{1,3}|IV|V|VI{0,3}|IX|X)/);
  if (match) {
    return {
      prefix: match[1],
      suffix: label.slice(match[1].length),
    };
  }
  return { prefix: null, suffix: label };
}

export function PatchLabel({ index, memoryLayout, className }: PatchLabelProps): JSX.Element {
  const label = memoryLayout.formatPatchSlot(index);

  if (!memoryLayout.patchLabelsUseSerif) {
    // S-330 style: just render the label as-is
    return <span className={className}>{label}</span>;
  }

  // S-550 style: split into Roman prefix and Arabic suffix
  const { prefix, suffix } = splitPatchLabel(label);

  if (!prefix) {
    // No Roman numeral prefix, render as-is
    return <span className={className}>{label}</span>;
  }

  return (
    <span className={className}>
      <span className="font-roman">{prefix}</span>
      {suffix}
    </span>
  );
}

/**
 * Render a patch bank label (e.g., "I11-I18") with proper font styling.
 */
interface PatchBankLabelProps {
  /** Bank index (0-based) */
  bankIndex: number;
  /** Patches per bank */
  patchesPerBank: number;
  /** Memory layout for formatting */
  memoryLayout: MemoryLayout;
  /** Additional CSS classes */
  className?: string;
}

export function PatchBankLabel({ bankIndex, patchesPerBank, memoryLayout, className }: PatchBankLabelProps): JSX.Element {
  const label = memoryLayout.formatPatchBankLabel(bankIndex, patchesPerBank);

  if (!memoryLayout.patchLabelsUseSerif) {
    // S-330 style: just render the label as-is
    return <span className={className}>{label}</span>;
  }

  // S-550 style: split at the dash and style each part
  // Label format: "I11-I18" or "II11-II18"
  const parts = label.split('-');
  if (parts.length !== 2) {
    return <span className={className}>{label}</span>;
  }

  const [start, end] = parts;
  const startSplit = splitPatchLabel(start);
  const endSplit = splitPatchLabel(end);

  return (
    <span className={className}>
      {startSplit.prefix && <span className="font-roman">{startSplit.prefix}</span>}
      {startSplit.suffix}
      -
      {endSplit.prefix && <span className="font-roman">{endSplit.prefix}</span>}
      {endSplit.suffix}
    </span>
  );
}
