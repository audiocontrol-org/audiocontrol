/**
 * Build info display with modal for detailed information and debug logs
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  getLogEntries,
  formatLogsForGitHub,
  clearLogs,
  type LogEntry,
} from '@/lib/logCapture';

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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const tz = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${tz}`;
  } catch {
    return isoString;
  }
}

type TabType = 'info' | 'logs';

export function BuildInfo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const info = getBuildInfo();

  const openModal = useCallback(() => {
    setLogs(getLogEntries());
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const refreshLogs = useCallback(() => {
    setLogs(getLogEntries());
  }, []);

  const handleClearLogs = useCallback(() => {
    clearLogs();
    setLogs([]);
  }, []);

  const handleCopyForGitHub = useCallback(async () => {
    const content = formatLogsForGitHub({
      buildTime: formatBuildTime(info.buildTime),
      gitCommit: info.gitCommit + (info.gitDirty ? ' (dirty)' : ''),
      gitBranch: info.gitBranch,
      includeAllLogs: showAllLogs,
    });

    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [info, showAllLogs]);

  const shortLabel = `${info.gitCommit}${info.gitDirty ? '*' : ''}`;

  const displayedLogs = showAllLogs ? logs : logs.filter(l => l.level !== 'log');
  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

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
          'border border-transparent hover:border-s330-accent/50',
          errorCount > 0 && 'border-red-500/50 text-red-400'
        )}
        title={errorCount > 0 ? `${errorCount} errors - click for details` : 'Click for build details'}
      >
        {shortLabel}
        {errorCount > 0 && <span className="ml-1 text-red-400">({errorCount})</span>}
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
              'w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-s330-accent/50">
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

            {/* Tabs */}
            <div className="flex border-b border-s330-accent/50">
              <button
                onClick={() => setActiveTab('info')}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === 'info'
                    ? 'text-s330-text border-b-2 border-s330-highlight'
                    : 'text-s330-muted hover:text-s330-text'
                )}
              >
                Info
              </button>
              <button
                onClick={() => { setActiveTab('logs'); refreshLogs(); }}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2',
                  activeTab === 'logs'
                    ? 'text-s330-text border-b-2 border-s330-highlight'
                    : 'text-s330-muted hover:text-s330-text'
                )}
              >
                Logs
                {(errorCount > 0 || warnCount > 0) && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    errorCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  )}>
                    {errorCount > 0 ? errorCount : warnCount}
                  </span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {activeTab === 'info' && (
                <div className="space-y-3 font-mono text-sm">
                  <InfoRow label="Build Time" value={formatBuildTime(info.buildTime)} />
                  <InfoRow label="Git Commit" value={info.gitCommit + (info.gitDirty ? ' (dirty)' : '')} />
                  <InfoRow label="Git Branch" value={info.gitBranch} />
                  <InfoRow label="Commit Date" value={formatBuildTime(info.gitDate)} />
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="space-y-3">
                  {/* Log controls */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="flex items-center gap-2 text-sm text-s330-muted">
                      <input
                        type="checkbox"
                        checked={showAllLogs}
                        onChange={(e) => setShowAllLogs(e.target.checked)}
                        className="rounded border-s330-accent"
                      />
                      Show all logs (not just errors/warnings)
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={refreshLogs}
                        className="px-2 py-1 text-xs bg-s330-accent/30 hover:bg-s330-accent/50 rounded text-s330-text"
                      >
                        Refresh
                      </button>
                      <button
                        onClick={handleClearLogs}
                        className="px-2 py-1 text-xs bg-s330-accent/30 hover:bg-s330-accent/50 rounded text-s330-text"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Log entries */}
                  <div className="bg-s330-bg rounded border border-s330-accent/50 max-h-64 overflow-auto">
                    {displayedLogs.length === 0 ? (
                      <p className="p-4 text-sm text-s330-muted text-center">
                        {showAllLogs ? 'No logs captured' : 'No errors or warnings'}
                      </p>
                    ) : (
                      <div className="font-mono text-xs divide-y divide-s330-accent/20">
                        {displayedLogs.slice(-100).map((entry, i) => (
                          <div
                            key={i}
                            className={cn(
                              'p-2',
                              entry.level === 'error' && 'bg-red-500/10 text-red-300',
                              entry.level === 'warn' && 'bg-yellow-500/10 text-yellow-300',
                              entry.level === 'log' && 'text-s330-muted'
                            )}
                          >
                            <div className="flex gap-2 text-s330-muted/70 mb-1">
                              <span>{formatBuildTime(entry.timestamp)}</span>
                              <span className={cn(
                                'uppercase font-bold',
                                entry.level === 'error' && 'text-red-400',
                                entry.level === 'warn' && 'text-yellow-400'
                              )}>
                                {entry.level}
                              </span>
                            </div>
                            <pre className="whitespace-pre-wrap break-all">{entry.message}</pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with copy button */}
            <div className="p-4 border-t border-s330-accent/50 flex items-center justify-between">
              <p className="text-xs text-s330-muted">
                S-330 Editor - Roland Sampler Control
              </p>
              <button
                onClick={handleCopyForGitHub}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                  copyStatus === 'copied'
                    ? 'bg-green-600 text-white'
                    : 'bg-s330-highlight hover:bg-s330-highlight/80 text-white'
                )}
              >
                {copyStatus === 'copied' ? 'Copied!' : 'Copy for GitHub Issue'}
              </button>
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
