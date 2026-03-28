/**
 * Re-exports operation status components from editor-core.
 *
 * These components originated here and were promoted to editor-core
 * for portability across all editors. This file re-exports them so
 * that existing imports within sampler-editor continue to work.
 *
 * Note: The editor-core versions use ac- prefixed CSS classes.
 * sampler-editor's Tailwind config maps ac- tokens to the same
 * CSS custom properties, so styling remains consistent.
 */

export {
  OperationProgressBar,
  OperationErrorBanner,
  OperationSuccessScreen,
  OperationLoadingSpinner,
  OperationButtonContent,
} from '@audiocontrol/editor-core';

/**
 * Dialog close button — kept local since it's specific to
 * sampler-editor's dialog pattern, not a general operation status
 * component.
 */
export function DialogCloseButton({ disabled }: { disabled?: boolean }): JSX.Element {
  return (
    <button
      className={`absolute top-4 right-4 text-s330-muted hover:text-s330-text${disabled ? ' opacity-50' : ''}`}
      aria-label="Close"
      disabled={disabled}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
