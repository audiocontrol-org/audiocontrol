/**
 * Patches page - View and edit D-110 patches
 *
 * A D-110 patch combines up to 8 tones with part configurations.
 */

import { useMidiStore } from '@/stores';

export function PatchesPage(): JSX.Element {
  const status = useMidiStore((state) => state.status);
  const isConnected = status === 'connected';

  if (!isConnected) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-bold text-d110-text mb-2">Not Connected</h2>
        <p className="text-d110-muted mb-4">
          Connect to your D-110 to view and edit patches.
        </p>
        <a href="/roland/d110/editor/" className="btn btn-primary inline-block">
          Go to Connection
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-d110-text">Patches</h2>
      </div>

      {/* Placeholder */}
      <div className="card text-center py-12">
        <p className="text-d110-muted mb-2">Patch editor coming soon</p>
        <p className="text-d110-muted text-sm">
          This page will allow you to configure part assignments,<br />
          key ranges, levels, and other patch parameters.
        </p>
      </div>
    </div>
  );
}
