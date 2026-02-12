/**
 * @audiocontrol/editor-tools
 *
 * Shared tools for audiocontrol editors including:
 * - Build info display
 * - Console log capture
 * - GitHub issue integration
 */

// Log capture utilities
export {
  initLogCapture,
  getLogEntries,
  getErrorsAndWarnings,
  clearLogs,
  getErrorCount,
  getWarningCount,
  formatEnvironmentForGitHub,
  formatLogsForGitHub,
  type LogEntry,
  type GitHubFormatOptions,
} from './logCapture';

// Build info component
export {
  BuildInfo,
  type BuildInfoData,
  type BuildInfoConfig,
  type BuildInfoTheme,
  type BuildInfoProps,
} from './BuildInfo';

// Editor layout component
export {
  EditorLayout,
  PanicButton,
  MidiStatusDisplay,
  type EditorLayoutConfig,
  type EditorLayoutTheme,
  type EditorLayoutProps,
  type NavItem,
  type PanicButtonProps,
  type MidiStatusDisplayProps,
} from './EditorLayout';

// Re-export globals type reference
/// <reference path="./globals.d.ts" />

/**
 * Helper to get build info from global variables
 *
 * Use this in your editor's main component or layout:
 * ```tsx
 * import { getBuildInfo } from '@audiocontrol/editor-tools';
 *
 * const buildInfo = getBuildInfo();
 * ```
 */
export function getBuildInfo(): import('./BuildInfo').BuildInfoData {
  return {
    buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown',
    gitCommit: typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'unknown',
    gitBranch: typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : 'unknown',
    gitDate: typeof __GIT_DATE__ !== 'undefined' ? __GIT_DATE__ : 'unknown',
    gitDirty: typeof __GIT_DIRTY__ !== 'undefined' ? __GIT_DIRTY__ : false,
  };
}
