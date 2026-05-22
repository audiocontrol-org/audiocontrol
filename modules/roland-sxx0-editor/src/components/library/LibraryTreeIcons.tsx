/**
 * Library Tree Icons
 *
 * Stateless SVG icon components used by the library tree panel. All
 * icons are stroke-only with `stroke="currentColor"` so the wrapping
 * `.ac-tree-icon` class controls color (muted by default, accent when
 * the parent `.ac-tree-node` is selected). Size + color are NOT set
 * locally — leave that to the .ac-tree-* design system.
 */

const ICON_PROPS = {
  className: 'ac-tree-icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Folder icon — same glyph open or closed; rotation/decoration would
 *  reduce visual coherence with the rest of the stroke-only icon set. */
export function FolderIcon({ isOpen: _isOpen }: { isOpen: boolean }): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

/** Legacy alias for the AcChevron primitive. The S330/S550 tree rows
 *  still import ChevronIcon from this module; this thin wrapper keeps
 *  those call-sites working without re-routing them all through
 *  editor-core. Owns no styling — the AcChevron component is the sole
 *  source of chevron sizing/color/glyph. */
import { AcChevron } from '@audiocontrol/editor-core';

export function ChevronIcon({ isExpanded }: { isExpanded: boolean }): JSX.Element {
  return <AcChevron expanded={isExpanded} />;
}

/** Wave icon for tones. */
export function WaveIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  );
}

/** Patch icon. */
export function PatchIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

/** Drum kit icon — two concentric circles, same stroke weight as the
 *  rest of the tree icons. */
export function DrumKitIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Delete button used inside tree rows. Style comes from
 *  `.ac-tree-delete-btn` (hover-revealed via parent .ac-tree-node:hover). */
export function DeleteButton({
  onClick,
  title = 'Delete',
}: {
  onClick: (e: React.MouseEvent) => void;
  title?: string;
}): JSX.Element {
  return (
    <button onClick={onClick} title={title} className="ac-tree-delete-btn">
      <svg {...ICON_PROPS}>
        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}
