/**
 * Build info display with modal for detailed information
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface BuildInfoData {
  buildTime: string;
  gitCommit: string;
  gitBranch: string;
  gitDate: string;
  gitDirty: boolean;
}

function getBuildInfo(): BuildInfoData {
  return {
    buildTime: __BUILD_TIME__,
    gitCommit: __GIT_COMMIT__,
    gitBranch: __GIT_BRANCH__,
    gitDate: __GIT_DATE__,
    gitDirty: __GIT_DIRTY__,
  };
}

function formatBuildTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    // Format as YYYY-MM-DD HH:MM:SS TZ
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    // Get short timezone abbreviation (e.g., "PST", "EST")
    const tz = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${tz}`;
  } catch {
    return isoString;
  }
}

export function BuildInfo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const info = getBuildInfo();

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const shortLabel = `${info.gitCommit}${info.gitDirty ? '*' : ''}`;

  return (
    <>
      {/* Compact display - clickable to open modal */}
      <button
        onClick={openModal}
        className={cn(
          'text-xs font-mono px-2 py-1 rounded',
          'text-s330-muted hover:text-s330-text',
          'bg-s330-bg/50 hover:bg-s330-accent/30',
          'transition-colors cursor-pointer',
          'border border-transparent hover:border-s330-accent/50'
        )}
        title="Click for build details"
      >
        {shortLabel}
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className={cn(
              'bg-s330-panel border border-s330-accent rounded-lg shadow-xl',
              'w-full max-w-md mx-4 p-6'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-s330-text">Build Information</h2>
              <button
                onClick={closeModal}
                className="text-s330-muted hover:text-s330-text p-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Build info table */}
            <div className="space-y-3 font-mono text-sm">
              <InfoRow label="Build Time" value={formatBuildTime(info.buildTime)} />
              <InfoRow label="Git Commit" value={info.gitCommit + (info.gitDirty ? ' (dirty)' : '')} />
              <InfoRow label="Git Branch" value={info.gitBranch} />
              <InfoRow label="Commit Date" value={formatBuildTime(info.gitDate)} />
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-s330-accent/50">
              <p className="text-xs text-s330-muted text-center">
                S-330 Editor - Roland Sampler Control
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-s330-muted">{label}:</span>
      <span className="text-s330-text text-right">{value}</span>
    </div>
  );
}
