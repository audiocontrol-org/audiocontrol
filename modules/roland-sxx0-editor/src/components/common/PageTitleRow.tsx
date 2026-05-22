/**
 * PageTitleRow
 *
 * Lean editor-page title row used by PatchesPage, TonesPage, and PlayPage.
 * Composes the .ac-page-title-* shared primitives (declared in
 * `modules/roland-sxx0-editor/src/styles/_shared.css`):
 *
 *   <header class="ac-page-title-row">
 *     <div class="ac-page-title-block">
 *       <h2 class="ac-page-title-heading">{headingText}</h2>
 *       <div class="ac-page-title-rule" />     // red rule under heading
 *     </div>
 *     <span class="ac-page-title-metric">
 *       <span class="ac-page-title-led" />     // device-active LED
 *       {loading-message | metric}             // see render rules
 *       {onRefresh && <button>{AcReloadIcon}</button>}
 *     </span>
 *     {loadingProgress && <div class="ac-page-title-progress">…</div>}
 *   </header>
 *
 * Extracted 2026-05-22 from PatchesPage.tsx (lines ~273-326),
 * TonesPage.tsx (~241-294), and PlayPage.tsx (~293-322) per clones.yaml
 * groups c53786bfb969 (33L) + c3ee44db4131 (16L) + 8ab1699757ff (10L)
 * dispositions. Pre-extraction the three call sites held byte-identical
 * markup for the header, h2/rule, LED span, refresh button, and reload
 * SVG; the only divergences were the heading text, the metric template,
 * the refresh button's aria-label, and whether PatchesPage/TonesPage
 * vs. PlayPage rendered the inline loading-progress strip (PlayPage
 * has a separate .ac-page-progress strip below the header).
 *
 * Contract pinned by D-PATCH-PAGE-TITLE-01 + D-TONE-PAGE-TITLE-01 +
 * D-PLAY-PAGE-TITLE-01 wiring assertions added before this extraction.
 */

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { AcReloadIcon } from './AcReloadIcon';

export interface PageTitleRowProps {
  /** id= on the h2 (used by aria-labelledby on downstream regions). */
  headingId: string;
  headingText: string;
  /** Metric content shown when not loading or when loading has no
   *  message. Typically a JSX fragment like
   *  `<strong>{N}</strong> of <strong>{M}</strong> loaded`. */
  metric: ReactNode;
  /** Optional loading message shown in place of `metric` when isLoading
   *  is true and the message is non-empty. PlayPage doesn't use this
   *  variant — it always shows the metric. */
  loadingMessage?: string | null;
  isLoading: boolean;
  /** Refresh button click handler. Button is omitted if undefined. */
  onRefresh?: () => void;
  /** aria-label on the refresh button. */
  refreshLabel: string;
  /** title attribute on the refresh button. Defaults to refreshLabel. */
  refreshTitle?: string;
  /** Optional 0-100 progress percentage. When set, renders the inline
   *  .ac-page-title-progress strip overlaying the header's bottom
   *  hairline. PlayPage doesn't use this — it has a separate
   *  .ac-page-progress strip rendered below the header. */
  loadingProgress?: number | null;
}

export function PageTitleRow({
  headingId,
  headingText,
  metric,
  loadingMessage,
  isLoading,
  onRefresh,
  refreshLabel,
  refreshTitle,
  loadingProgress,
}: PageTitleRowProps): JSX.Element {
  const showLoadingMessage = isLoading && Boolean(loadingMessage);
  return (
    <header className="ac-page-title-row">
      <div className="ac-page-title-block">
        <h2 id={headingId} className="ac-page-title-heading">{headingText}</h2>
        <div className="ac-page-title-rule" aria-hidden="true" />
      </div>
      <span className="ac-page-title-metric">
        <span className="ac-page-title-led" aria-hidden="true" />
        {showLoadingMessage ? (
          <span
            className="ac-page-title-metric-status"
            role="status"
            aria-live="polite"
          >
            {loadingMessage}
          </span>
        ) : (
          <span>{metric}</span>
        )}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className={cn(
              'ac-icon-btn',
              isLoading && 'ac-icon-btn--spinning',
            )}
            aria-label={refreshLabel}
            title={refreshTitle ?? refreshLabel}
          >
            <AcReloadIcon />
          </button>
        )}
      </span>
      {isLoading && loadingProgress !== null && loadingProgress !== undefined && (
        <div
          className="ac-page-title-progress"
          aria-hidden="true"
        >
          <span
            className="ac-page-title-progress-fill"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
      )}
    </header>
  );
}
