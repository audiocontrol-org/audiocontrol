/**
 * Console log capture for debugging and issue reporting
 *
 * Intercepts console.log, console.warn, console.error and stores them
 * in a buffer that can be copied for GitHub issues.
 */

export interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error';
  message: string;
}

const MAX_LOG_ENTRIES = 500;
const logBuffer: LogEntry[] = [];

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function formatArgs(args: unknown[]): string {
  return args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

function addLogEntry(level: LogEntry['level'], args: unknown[]) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: formatArgs(args),
  };

  logBuffer.push(entry);

  // Trim buffer if too large
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_ENTRIES);
  }
}

/**
 * Initialize log capture by patching console methods
 */
export function initLogCapture() {
  console.log = (...args: unknown[]) => {
    addLogEntry('log', args);
    originalConsole.log(...args);
  };

  console.warn = (...args: unknown[]) => {
    addLogEntry('warn', args);
    originalConsole.warn(...args);
  };

  console.error = (...args: unknown[]) => {
    addLogEntry('error', args);
    originalConsole.error(...args);
  };

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    addLogEntry('error', [`Unhandled error: ${event.message}`, event.filename, `line ${event.lineno}`]);
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    addLogEntry('error', [`Unhandled promise rejection: ${event.reason}`]);
  });
}

/**
 * Get all captured log entries
 */
export function getLogEntries(): LogEntry[] {
  return [...logBuffer];
}

/**
 * Get only error and warning entries
 */
export function getErrorsAndWarnings(): LogEntry[] {
  return logBuffer.filter(entry => entry.level === 'error' || entry.level === 'warn');
}

/**
 * Clear the log buffer
 */
export function clearLogs() {
  logBuffer.length = 0;
}

/**
 * Format logs for GitHub issue
 */
export function formatLogsForGitHub(options: {
  buildTime: string;
  gitCommit: string;
  gitBranch: string;
  includeAllLogs?: boolean;
}): string {
  const { buildTime, gitCommit, gitBranch, includeAllLogs = false } = options;

  const logs = includeAllLogs ? getLogEntries() : getErrorsAndWarnings();
  const recentLogs = logs.slice(-100); // Last 100 entries

  const userAgent = navigator.userAgent;
  const url = window.location.href;

  let output = `## Environment

| Property | Value |
|----------|-------|
| Build | \`${gitCommit}\` |
| Branch | \`${gitBranch}\` |
| Build Time | ${buildTime} |
| URL | ${url} |
| User Agent | ${userAgent} |

## Description

<!-- Please describe the issue you encountered -->

## Steps to Reproduce

<!-- Please list the steps to reproduce the issue -->

1.
2.
3.

## Expected Behavior

<!-- What did you expect to happen? -->

## Actual Behavior

<!-- What actually happened? -->

`;

  if (recentLogs.length > 0) {
    output += `## Console Logs

\`\`\`
${recentLogs.map(entry => {
  const levelIcon = entry.level === 'error' ? '[ERROR]' : entry.level === 'warn' ? '[WARN]' : '[LOG]';
  return `${entry.timestamp} ${levelIcon} ${entry.message}`;
}).join('\n')}
\`\`\`
`;
  } else {
    output += `## Console Logs

No errors or warnings captured.
`;
  }

  return output;
}
