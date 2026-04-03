/**
 * Library tree icon components for the S3000XL editor.
 *
 * SVG icons for the library browser tree, following the same pattern
 * as the Roland editor's LibraryTreeIcons but using ac-tree-icon
 * class names for consistent sizing.
 */

/**
 * Waveform icon for regular samples.
 * Musical note with waveform suggestion.
 */
export function SampleIcon(): JSX.Element {
  return (
    <svg className="ac-tree-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>
  );
}

/**
 * Chopped/sliced sample icon.
 * Scissors shape suggesting the sample has been sliced.
 */
export function ChoppedSampleIcon(): JSX.Element {
  return (
    <svg className="ac-tree-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="6" cy="6" r="3" strokeWidth={2} />
      <circle cx="6" cy="18" r="3" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"
      />
    </svg>
  );
}

/**
 * Drum kit icon.
 * Concentric circles representing a drum pad / cymbal.
 */
export function DrumKitIcon(): JSX.Element {
  return (
    <svg className="ac-tree-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
    </svg>
  );
}

/**
 * Program icon.
 * Stacked layers representing a multi-keygroup program.
 */
export function ProgramIcon(): JSX.Element {
  return (
    <svg className="ac-tree-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}
