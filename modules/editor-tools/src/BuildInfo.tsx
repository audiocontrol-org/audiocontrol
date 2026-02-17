/**
 * Build info display with modal for detailed information and debug logs
 *
 * Configurable component that can be themed for different editors.
 */

import { useState, useCallback, type CSSProperties } from 'react';
import {
  getLogEntries,
  formatLogsForGitHub,
  formatEnvironmentForGitHub,
  clearLogs,
  type LogEntry,
} from './logCapture';

export interface BuildInfoData {
  buildTime: string;
  gitCommit: string;
  gitBranch: string;
  gitDate: string;
  gitDirty: boolean;
}

export interface BuildInfoTheme {
  /** Muted text color */
  textMuted: string;
  /** Primary text color */
  textPrimary: string;
  /** Highlight/accent text color */
  textHighlight: string;
  /** Primary background color */
  bgPrimary: string;
  /** Panel/surface background color */
  bgPanel: string;
  /** Border color */
  border: string;
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
  /** Theme colors (CSS color values) */
  theme: BuildInfoTheme;
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
  /** Configuration for theming and branding */
  config: BuildInfoConfig;
}

export function BuildInfo({ buildInfo, config }: BuildInfoProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const { theme } = config;

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

  // Style objects for theming
  const buttonStyle: CSSProperties = {
    color: errorCount > 0 ? 'var(--ac-status-danger, #f87171)' : theme.textMuted,
    backgroundColor: 'rgba(0,0,0,0.3)',
    border: errorCount > 0
      ? '1px solid color-mix(in srgb, var(--ac-status-danger, #f87171) 55%, transparent)'
      : '1px solid transparent',
  };

  const modalOverlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  };

  const modalStyle: CSSProperties = {
    backgroundColor: theme.bgPanel,
    border: `1px solid ${theme.border}`,
    borderRadius: '0.5rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    width: '100%',
    maxWidth: '42rem',
    margin: '0 1rem',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <>
      {/* Compact display - clickable to open modal */}
      <button
        onClick={openModal}
        style={buttonStyle}
        className="text-xs font-mono px-2 py-1 rounded transition-colors cursor-pointer hover:opacity-80"
        title={errorCount > 0 ? `${errorCount} errors - click for details` : 'Click for build details'}
      >
        {shortLabel}
        {errorCount > 0 && <span className="ml-1 ac-text-error">({errorCount})</span>}
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div style={modalOverlayStyle} onClick={closeModal}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: theme.textPrimary }}>
                Build Information
              </h2>
              <button
                onClick={closeModal}
                style={{ color: theme.textMuted, padding: '0.25rem' }}
                className="hover:opacity-70"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}` }}>
              <button
                onClick={() => setActiveTab('info')}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: activeTab === 'info' ? theme.textPrimary : theme.textMuted,
                  borderBottom: activeTab === 'info' ? `2px solid ${theme.textHighlight}` : '2px solid transparent',
                }}
                className="transition-colors"
              >
                Info
              </button>
              <button
                onClick={() => { setActiveTab('logs'); refreshLogs(); }}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: activeTab === 'logs' ? theme.textPrimary : theme.textMuted,
                  borderBottom: activeTab === 'logs' ? `2px solid ${theme.textHighlight}` : '2px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
                className="transition-colors"
              >
                Logs
                {(errorCount > 0 || warnCount > 0) && (
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem',
                    backgroundColor: errorCount > 0
                      ? 'color-mix(in srgb, var(--ac-status-danger, #f87171) 22%, transparent)'
                      : 'color-mix(in srgb, var(--ac-status-warning, #fbbf24) 22%, transparent)',
                    color: errorCount > 0
                      ? 'var(--ac-status-danger, #f87171)'
                      : 'var(--ac-status-warning, #fbbf24)',
                  }}>
                    {errorCount > 0 ? errorCount : warnCount}
                  </span>
                )}
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
              {activeTab === 'info' && (
                <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  <InfoRow label="Build Time" value={formatBuildTime(buildInfo.buildTime)} theme={theme} />
                  <InfoRow label="Git Commit" value={buildInfo.gitCommit + (buildInfo.gitDirty ? ' (dirty)' : '')} theme={theme} />
                  <InfoRow label="Git Branch" value={buildInfo.gitBranch} theme={theme} />
                  <InfoRow label="Commit Date" value={formatBuildTime(buildInfo.gitDate)} theme={theme} />
                </div>
              )}

              {activeTab === 'logs' && (
                <div>
                  {/* Log controls */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: theme.textMuted }}>
                      <input
                        type="checkbox"
                        checked={showAllLogs}
                        onChange={(e) => setShowAllLogs(e.target.checked)}
                      />
                      Show all logs (not just errors/warnings)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={refreshLogs}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'rgba(255,255,255,0.1)', color: theme.textPrimary, borderRadius: '0.25rem' }}
                      >
                        Refresh
                      </button>
                      <button
                        onClick={handleClearLogs}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'rgba(255,255,255,0.1)', color: theme.textPrimary, borderRadius: '0.25rem' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Log entries */}
                  <div style={{
                    backgroundColor: theme.bgPrimary,
                    borderRadius: '0.25rem',
                    border: `1px solid ${theme.border}`,
                    maxHeight: '16rem',
                    overflow: 'auto',
                  }}>
                    {displayedLogs.length === 0 ? (
                      <p style={{ padding: '1rem', fontSize: '0.875rem', color: theme.textMuted, textAlign: 'center' }}>
                        {showAllLogs ? 'No logs captured' : 'No errors or warnings'}
                      </p>
                    ) : (
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {displayedLogs.slice(-100).map((entry, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '0.5rem',
                              borderBottom: `1px solid ${theme.border}`,
                              backgroundColor: entry.level === 'error'
                                ? 'color-mix(in srgb, var(--ac-status-danger, #f87171) 12%, transparent)'
                                : entry.level === 'warn'
                                  ? 'color-mix(in srgb, var(--ac-status-warning, #fbbf24) 12%, transparent)'
                                  : 'transparent',
                              color: entry.level === 'error'
                                ? 'var(--ac-status-danger, #fca5a5)'
                                : entry.level === 'warn'
                                  ? 'var(--ac-status-warning, #fcd34d)'
                                  : theme.textMuted,
                            }}
                          >
                            <div style={{ display: 'flex', gap: '0.5rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                              <span>{formatBuildTime(entry.timestamp)}</span>
                              <span style={{
                                textTransform: 'uppercase',
                                fontWeight: 'bold',
                                color: entry.level === 'error'
                                  ? 'var(--ac-status-danger, #f87171)'
                                  : entry.level === 'warn'
                                    ? 'var(--ac-status-warning, #fbbf24)'
                                    : 'inherit',
                              }}>
                                {entry.level}
                              </span>
                            </div>
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{entry.message}</pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with copy button and GitHub link */}
            <div style={{
              padding: '1rem',
              borderTop: `1px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>
                {config.editorName} - {config.editorDescription}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={handleCopyForGitHub}
                  style={{
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    borderRadius: '0.25rem',
                    backgroundColor: copyStatus === 'copied' ? 'var(--ac-status-connected, #16a34a)' : 'rgba(255,255,255,0.1)',
                    color: copyStatus === 'copied' ? 'white' : theme.textPrimary,
                  }}
                  className="transition-colors"
                >
                  {copyStatus === 'copied' ? 'Copied!' : 'Copy for Issue'}
                </button>
                <button
                  onClick={() => window.open(getGitHubIssueUrl(), '_blank', 'noopener,noreferrer')}
                  style={{
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    borderRadius: '0.25rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                  className="hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
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
  theme: BuildInfoTheme;
}

function InfoRow({ label, value, theme }: InfoRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
      <span style={{ color: theme.textMuted }}>{label}:</span>
      <span style={{ color: theme.textPrimary, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
