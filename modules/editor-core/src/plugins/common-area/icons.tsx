/**
 * Shared SVG icon components for common-area library items.
 *
 * Theme-aware icons that use `currentColor` for stroke, allowing
 * consuming editors to control color via CSS class or parent styling.
 */

/**
 * Waveform/sample icon — musical note with waveform suggestion.
 * Used for common-area samples across all editors.
 */
export function SampleIcon({
  className = 'w-3.5 h-3.5',
}: {
  className?: string;
}): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
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
 * Program icon — stacked layers representing a multi-zone program.
 * Used for common-area programs across all editors.
 */
export function ProgramIcon({
  className = 'w-3.5 h-3.5',
}: {
  className?: string;
}): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

/**
 * Chopped/sliced sample icon — scissors shape.
 * Used when a sample has been sliced into segments.
 */
export function ChoppedSampleIcon({
  className = 'w-3.5 h-3.5',
}: {
  className?: string;
}): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
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
 * Drum kit icon — concentric circles representing a drum pad.
 * Used for samples or programs with drum kit associations.
 */
export function DrumKitIcon({
  className = 'w-3.5 h-3.5',
}: {
  className?: string;
}): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
    </svg>
  );
}
