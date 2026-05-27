interface ErrorBannerProps {
  message: string;
  /**
   * Called when the user clicks the dismiss button. When omitted, the
   * dismiss affordance is not rendered. Every page-level consumer
   * should pass this — banners that can't be dismissed stick around
   * past their useful life (e.g., when the user retries the failed
   * operation and succeeds, but the prior error is still on screen).
   */
  onDismiss?: () => void;
}

/**
 * Inline error / status banner. Sits at the top of a page when an
 * operation fails. Chrome lives in editor-core's feedback-primitives.css
 * as `.ac-error-banner` so the colors resolve from design tokens (AAA
 * on cream akai, AA on roland dark). Replaces the prior
 * `bg-red-900/30 text-red-300` Tailwind composition which produced
 * ~2:1 contrast on the cream akai canvas (operator review 2026-05-26).
 */
export function ErrorBanner({ message, onDismiss }: ErrorBannerProps): JSX.Element {
  return (
    <div className="ac-error-banner" role="alert">
      <span className="ac-error-banner__glyph" aria-hidden="true">!</span>
      <span className="ac-error-banner__message">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          className="ac-error-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
          title="Dismiss"
        >
          &times;
        </button>
      ) : null}
    </div>
  );
}
