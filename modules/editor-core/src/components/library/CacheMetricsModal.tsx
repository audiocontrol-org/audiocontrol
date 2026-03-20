/**
 * Modal dialog displaying cache performance metrics.
 *
 * Shows hit/miss rates, cache sizes, and invalidation counts
 * for monitoring cache effectiveness on high-latency backends.
 */

import React, { useCallback, useEffect, useRef } from 'react';

/**
 * Metrics for a single cache category (matches CacheCategoryMetrics from sampler-library).
 */
export interface CategoryMetrics {
  hits: number;
  misses: number;
  size: number;
}

/**
 * Aggregated cache metrics (matches CacheMetrics from sampler-library).
 */
export interface CacheMetricsData {
  entries: CategoryMetrics;
  directories: CategoryMetrics;
  files: CategoryMetrics;
  content: CategoryMetrics;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  invalidations: number;
  clears: number;
}

export interface CacheMetricsModalProps {
  open: boolean;
  metrics: CacheMetricsData | null | undefined;
  onClose: () => void;
  onReset?: () => void;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function MetricRow({ label, hits, misses, size }: { label: string; hits: number; misses: number; size: number }): JSX.Element {
  const total = hits + misses;
  const rate = total > 0 ? hits / total : 0;

  return (
    <tr>
      <td className="ac-metrics-label">{label}</td>
      <td className="ac-metrics-value">{hits}</td>
      <td className="ac-metrics-value">{misses}</td>
      <td className="ac-metrics-value">{formatPercent(rate)}</td>
      <td className="ac-metrics-value">{size}</td>
    </tr>
  );
}

export function CacheMetricsModal({
  open,
  metrics,
  onClose,
  onReset,
}: CacheMetricsModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap: focus close button on open
  useEffect(() => {
    if (open && dialogRef.current) {
      const closeBtn = dialogRef.current.querySelector<HTMLButtonElement>('.ac-modal-close');
      closeBtn?.focus();
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!open) return null;

  const hasMetrics = metrics != null;

  return (
    <div className="ac-modal-overlay" onClick={handleOverlayClick}>
      <div className="ac-modal" ref={dialogRef} style={{ maxWidth: '32rem' }} role="dialog" aria-labelledby="cache-metrics-title">
        <div className="ac-modal-header">
          <h2 id="cache-metrics-title" className="ac-modal-title">Cache Metrics</h2>
          <button className="ac-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <div className="ac-modal-content">
          {!hasMetrics ? (
            <p className="ac-metrics-empty">No cache metrics available. Connect to a cached backend to see metrics.</p>
          ) : (
            <>
              {/* Summary */}
              <div className="ac-metrics-summary">
                <div className="ac-metrics-stat">
                  <span className="ac-metrics-stat-value">{formatPercent(metrics.hitRate)}</span>
                  <span className="ac-metrics-stat-label">Hit Rate</span>
                </div>
                <div className="ac-metrics-stat">
                  <span className="ac-metrics-stat-value">{metrics.totalHits}</span>
                  <span className="ac-metrics-stat-label">Total Hits</span>
                </div>
                <div className="ac-metrics-stat">
                  <span className="ac-metrics-stat-value">{metrics.totalMisses}</span>
                  <span className="ac-metrics-stat-label">Total Misses</span>
                </div>
              </div>

              {/* Category breakdown */}
              <table className="ac-metrics-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Hits</th>
                    <th>Misses</th>
                    <th>Rate</th>
                    <th>Cached</th>
                  </tr>
                </thead>
                <tbody>
                  <MetricRow label="Entries" {...metrics.entries} />
                  <MetricRow label="Directories" {...metrics.directories} />
                  <MetricRow label="Files" {...metrics.files} />
                  <MetricRow label="Content" {...metrics.content} />
                </tbody>
              </table>

              {/* Invalidation stats */}
              <div className="ac-metrics-footer-stats">
                <span>Invalidations: {metrics.invalidations}</span>
                <span>Full Clears: {metrics.clears}</span>
              </div>
            </>
          )}
        </div>
        <div className="ac-modal-footer">
          <div />
          <div className="ac-modal-footer-actions">
            {onReset && hasMetrics && (
              <button className="ac-btn ac-btn-sm" onClick={onReset}>
                Reset
              </button>
            )}
            <button className="ac-btn ac-btn-sm ac-btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
