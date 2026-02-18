/**
 * Tones page - View and edit D-110 tones
 *
 * Parameter changes are sent to the device in real-time.
 */

import { useMidiStore, useD110Store } from '@/stores';
import { ToneEditor } from '@/components/ToneEditor';

export function TonesPage(): JSX.Element {
  const status = useMidiStore((state) => state.status);
  const isLoading = useD110Store((state) => state.isLoading);
  const loadingMessage = useD110Store((state) => state.loadingMessage);
  const error = useD110Store((state) => state.error);

  const isConnected = status === 'connected';

  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="card text-center py-12">
          <h2 className="text-xl font-bold text-d110-text mb-2">Not Connected</h2>
          <p className="text-d110-muted mb-4">
            Connect to your D-110 to view and edit tones.
          </p>
          <a href="/roland/d110/editor/" className="ac-btn ac-btn-primary inline-block">
            Go to Connection
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell">
      {/* Header */}
      <div className="ac-page-header ac-page-header-block">
        <h2 className="text-xl font-bold text-d110-text">Tones</h2>
      </div>

      {/* Error Display */}
      {error && (
        <div className="ac-alert ac-alert-error">
          <p className="ac-text-error text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-d110-highlight border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-d110-muted">{loadingMessage ?? 'Loading...'}</p>
        </div>
      )}

      {/* Tone Editor */}
      {!isLoading && <ToneEditor />}
    </div>
  );
}
