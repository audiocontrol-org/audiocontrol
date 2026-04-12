/**
 * LoadingBar — thin indeterminate progress bar for panel title areas.
 *
 * Shows a subtle animated bar when `active` is true. Collapses to
 * zero height when inactive to avoid layout shift.
 */

interface LoadingBarProps {
  active: boolean;
}

export function LoadingBar({ active }: LoadingBarProps): JSX.Element {
  if (!active) {
    // Reserve 2px of height to prevent layout shift
    return <div style={{ height: 2 }} />;
  }
  return (
    <div className="ac-loading-bar">
      <div className="ac-loading-bar-fill" />
    </div>
  );
}
