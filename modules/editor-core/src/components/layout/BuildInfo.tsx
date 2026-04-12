/**
 * Build info display with modal for detailed information and debug logs
 */

import { useState, useCallback } from 'react';
import {
  getLogEntries,
  formatLogsForGitHub,
  formatEnvironmentForGitHub,
  clearLogs,
  type LogEntry,
} from '../../utils/logCapture';

export interface BuildInfoData {
  buildTime: string;
  gitCommit: string;
  gitBranch: string;
  gitDate: string;
  gitDirty: boolean;
}

export interface BuildInfoConfig {
  /** Editor name (e.g., "S-330 Editor", "D-110 Editor") */
  editorName: string;
  /** Short description (e.g., "Roland Sampler", "Roland LA Synthesizer") */
  editorDescription: string;
  /** GitHub repo for issues (e.g., "audiocontrol-org/audiocontrol") */
  githubRepo: string;
  /** Issue title prefix (e.g., "[S-330 Editor]", "[D-110 Editor]") */
  issueTitlePrefix: string;
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

export interface BuildInfoProps {
  /** Build information injected at compile time */
  buildInfo: BuildInfoData;
  /** Configuration for branding */
  config: BuildInfoConfig;
}

export function BuildInfo({ buildInfo, config }: BuildInfoProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);

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

  const getIssueContent = useCallback(() => {
    return formatLogsForGitHub({
      buildTime: formatBuildTime(buildInfo.buildTime),
      gitCommit: buildInfo.gitCommit + (buildInfo.gitDirty ? ' (dirty)' : ''),
      gitBranch: buildInfo.gitBranch,
      editorName: config.editorName,
      editorDescription: config.editorDescription,
      includeAllLogs: showAllLogs,
    });
  }, [buildInfo, config, showAllLogs]);

  const handleCopyForGitHub = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getIssueContent());
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [getIssueContent]);

  const getGitHubIssueUrl = useCallback(() => {
    const body = encodeURIComponent(formatEnvironmentForGitHub({
      buildTime: formatBuildTime(buildInfo.buildTime),
      gitCommit: buildInfo.gitCommit + (buildInfo.gitDirty ? ' (dirty)' : ''),
      gitBranch: buildInfo.gitBranch,
      editorName: config.editorName,
      editorDescription: config.editorDescription,
    }));
    const title = encodeURIComponent(`${config.issueTitlePrefix} `);
    return `https://github.com/${config.githubRepo}/issues/new?title=${title}&body=${body}`;
  }, [buildInfo, config]);

  const shortLabel = `${buildInfo.gitCommit}${buildInfo.gitDirty ? '*' : ''}`;

  const displayedLogs = showAllLogs ? logs : logs.filter(l => l.level !== 'log');
  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <>
      {/* Info & Logs trigger */}
      <button
        onClick={openModal}
        className={`ac-build-info-trigger ${errorCount > 0 ? 'ac-build-info-trigger--error' : ''}`}
        title={errorCount > 0 ? `${errorCount} errors — click for logs & issue reporting` : 'Build info, logs & issue reporting'}
      >
        <svg className="ac-icon-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {errorCount > 0 && <span className="ac-build-info-badge">{errorCount}</span>}
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="ac-modal-overlay" onClick={closeModal}>
          <div className="ac-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="ac-modal-header">
              <h2 className="ac-modal-title">Build Information</h2>
              <button onClick={closeModal} className="ac-modal-close" aria-label="Close">
                <svg className="ac-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="ac-tabs">
              <button
                onClick={() => setActiveTab('info')}
                className={`ac-tab ${activeTab === 'info' ? 'ac-tab--active' : ''}`}
              >
                Info
              </button>
              <button
                onClick={() => { setActiveTab('logs'); refreshLogs(); }}
                className={`ac-tab ${activeTab === 'logs' ? 'ac-tab--active' : ''}`}
              >
                Logs
                {(errorCount > 0 || warnCount > 0) && (
                  <span className={`ac-tab-badge ${errorCount > 0 ? 'ac-tab-badge--error' : 'ac-tab-badge--warning'}`}>
                    {errorCount > 0 ? errorCount : warnCount}
                  </span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="ac-modal-content">
              {activeTab === 'info' && (
                <div className="ac-info-list">
                  <InfoRow label="Build Time" value={formatBuildTime(buildInfo.buildTime)} />
                  <InfoRow label="Git Commit" value={buildInfo.gitCommit + (buildInfo.gitDirty ? ' (dirty)' : '')} />
                  <InfoRow label="Git Branch" value={buildInfo.gitBranch} />
                  <InfoRow label="Commit Date" value={formatBuildTime(buildInfo.gitDate)} />
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="ac-logs-panel">
                  {/* Log controls */}
                  <div className="ac-logs-controls">
                    <label className="ac-checkbox-label">
                      <input
                        type="checkbox"
                        checked={showAllLogs}
                        onChange={(e) => setShowAllLogs(e.target.checked)}
                      />
                      Show all logs (not just errors/warnings)
                    </label>
                    <div className="ac-logs-actions">
                      <button onClick={refreshLogs} className="ac-btn ac-btn-sm">Refresh</button>
                      <button onClick={handleClearLogs} className="ac-btn ac-btn-sm">Clear</button>
                    </div>
                  </div>

                  {/* Log entries */}
                  <div className="ac-logs-list">
                    {displayedLogs.length === 0 ? (
                      <p className="ac-logs-empty">
                        {showAllLogs ? 'No logs captured' : 'No errors or warnings'}
                      </p>
                    ) : (
                      displayedLogs.slice(-100).map((entry, i) => (
                        <div key={i} className={`ac-log-entry ac-log-entry--${entry.level}`}>
                          <div className="ac-log-meta">
                            <span>{formatBuildTime(entry.timestamp)}</span>
                            <span className={`ac-log-level ac-log-level--${entry.level}`}>
                              {entry.level.toUpperCase()}
                            </span>
                          </div>
                          <pre className="ac-log-message">{entry.message}</pre>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with copy button and GitHub link */}
            <div className="ac-modal-footer">
              <p className="ac-modal-footer-text">
                {config.editorName} - {config.editorDescription}
              </p>
              <div className="ac-modal-footer-actions">
                <button
                  onClick={handleCopyForGitHub}
                  className={`ac-btn ${copyStatus === 'copied' ? 'ac-btn-success' : ''}`}
                >
                  {copyStatus === 'copied' ? 'Copied!' : 'Copy for Issue'}
                </button>
                <button
                  onClick={() => window.open(getGitHubIssueUrl(), '_blank', 'noopener,noreferrer')}
                  className="ac-btn ac-btn-primary"
                >
                  <svg className="ac-icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Open Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="ac-info-row">
      <span className="ac-info-label">{label}:</span>
      <span className="ac-info-value">{value}</span>
    </div>
  );
}

/**
 * Helper to get build info from global variables
 */
export function getBuildInfo(): BuildInfoData {
  return {
    buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown',
    gitCommit: typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'unknown',
    gitBranch: typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : 'unknown',
    gitDate: typeof __GIT_DATE__ !== 'undefined' ? __GIT_DATE__ : 'unknown',
    gitDirty: typeof __GIT_DIRTY__ !== 'undefined' ? __GIT_DIRTY__ : false,
  };
}
