/**
 * Minimal dialog for picking a chopped sample from the library.
 * Shown when the user clicks "Load" in the SampleChopperDialog.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ChoppedSampleInfo } from '@audiocontrol/sampler-library/browser';
import { listChoppedSamples } from './library.js';

interface LoadDialogProps {
  open: boolean;
  onSelect: (name: string) => void;
  onCancel: () => void;
}

export function LoadDialog({ open, onSelect, onCancel }: LoadDialogProps): JSX.Element | null {
  const [items, setItems] = useState<ChoppedSampleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);
    listChoppedSamples()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to list samples'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel]
  );

  if (!open) return null;

  return (
    <div className="load-dialog-overlay" onClick={handleBackdropClick}>
      <div className="load-dialog">
        <div className="load-dialog-header">
          <h2>Load Chopped Sample</h2>
          <button className="load-dialog-close" onClick={onCancel}>&times;</button>
        </div>

        <div className="load-dialog-body">
          {loading && <p className="load-dialog-status">Scanning library...</p>}

          {error && <p className="load-dialog-error">{error}</p>}

          {!loading && !error && items.length === 0 && (
            <p className="load-dialog-status">No saved samples found. Save a sample first.</p>
          )}

          {!loading && items.length > 0 && (
            <ul className="load-dialog-list">
              {items.map((item) => (
                <li key={item.name}>
                  <button className="load-dialog-item" onClick={() => onSelect(item.name)}>
                    <span className="load-dialog-item-name">{item.name}</span>
                    <span className="load-dialog-item-meta">
                      {item.variant} &middot; {item.sliceCount} slice{item.sliceCount !== 1 ? 's' : ''}
                      {item.description && ` &middot; ${item.description}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
