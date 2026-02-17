/**
 * Shared Editor Layout Component
 *
 * Provides consistent layout structure across all audiocontrol editors.
 * Configurable for different editor branding, navigation, and theming.
 */

import { type ReactNode, type CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import { BuildInfo, type BuildInfoConfig, getBuildInfo } from './index';

export interface NavItem {
  /** Route path */
  to: string;
  /** Display label */
  label: string;
}

export interface EditorLayoutTheme {
  /** Main background color */
  bgPrimary: string;
  /** Panel/header background color */
  bgPanel: string;
  /** Border color */
  border: string;
  /** Primary text color */
  textPrimary: string;
  /** Muted/secondary text color */
  textMuted: string;
  /** Highlight/accent color */
  highlight: string;
}

export interface EditorLayoutConfig {
  /** Editor name (e.g., "D-110", "S-330") */
  editorName: string;
  /** Editor subtitle (e.g., "Roland LA Synthesizer") */
  editorSubtitle: string;
  /** Navigation items */
  navItems: NavItem[];
  /** Theme colors */
  theme: EditorLayoutTheme;
  /** Build info configuration */
  buildInfoConfig: BuildInfoConfig;
  /** Footer text (optional) */
  footerText?: string;
}

export interface EditorLayoutProps {
  /** Layout configuration */
  config: EditorLayoutConfig;
  /** Content to render in the header right section (panic button, MIDI status, etc.) */
  headerRight?: ReactNode;
  /** Content to render before the header (e.g., sidebar drawer toggle) */
  headerBefore?: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Additional className for the main wrapper */
  className?: string;
  /** Custom style for main content area margin (e.g., when sidebar is open) */
  contentStyle?: CSSProperties;
}

export function EditorLayout({
  config,
  headerRight,
  headerBefore,
  children,
  className = '',
  contentStyle,
}: EditorLayoutProps): JSX.Element {
  const { theme, navItems, editorName, editorSubtitle, buildInfoConfig, footerText } = config;

  const headerStyle: CSSProperties = {
    backgroundColor: theme.bgPanel,
    borderBottom: `1px solid ${theme.border}`,
  };

  const navLinkBaseStyle: CSSProperties = {
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem 0.375rem 0 0',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'all var(--ac-duration-fast, 150ms) var(--ac-easing-default, ease)',
  };

  const footerStyle: CSSProperties = {
    borderTop: `1px solid ${theme.border}`,
    padding: '1rem 0',
    marginTop: 'auto',
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${className}`}
      style={{ backgroundColor: theme.bgPrimary }}
    >
      {headerBefore}

      {/* Header */}
      <header style={headerStyle}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold" style={{ color: theme.textPrimary }}>
                <span style={{ color: theme.highlight }}>{editorName}</span> Editor
              </h1>
              <span className="text-xs" style={{ color: theme.textMuted }}>
                {editorSubtitle}
              </span>
            </div>

            {/* Right side: custom content + build info */}
            <div className="flex items-center gap-3">
              {headerRight}
              <BuildInfo buildInfo={getBuildInfo()} config={buildInfoConfig} />
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-3">
            <ul className="flex gap-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    style={({ isActive }) => ({
                      ...navLinkBaseStyle,
                      backgroundColor: isActive ? theme.bgPrimary : 'transparent',
                      color: isActive ? theme.textPrimary : theme.textMuted,
                    })}
                    className={({ isActive }) =>
                      isActive ? '' : 'hover:opacity-80'
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main
        className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full"
        style={contentStyle}
      >
        {children}
      </main>

      {/* Footer */}
      {footerText && (
        <footer style={footerStyle}>
          <div
            className="max-w-7xl mx-auto px-4 text-center text-xs"
            style={{ color: theme.textMuted }}
          >
            {footerText}
          </div>
        </footer>
      )}
    </div>
  );
}

/**
 * Panic button component - shared styling, accepts onClick handler
 */
export interface PanicButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

export function PanicButton({
  onClick,
  disabled = false,
  title = 'Send All Notes Off on all channels',
}: PanicButtonProps): JSX.Element {
  const panicBg = 'var(--ac-status-danger, #dc2626)';
  const mutedText = 'var(--ac-text-muted, #6b7280)';
  const mutedBg = 'color-mix(in srgb, var(--ac-color-surface-panel, #111827) 70%, transparent)';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.375rem 0.75rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        borderRadius: '0.25rem',
        backgroundColor: disabled ? mutedBg : panicBg,
        color: disabled ? mutedText : 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color var(--ac-duration-fast, 150ms) var(--ac-easing-default, ease)',
      }}
      className={disabled ? '' : 'hover:opacity-90'}
      title={disabled ? 'Connect to MIDI to enable' : title}
    >
      PANIC
    </button>
  );
}

/**
 * MIDI Status indicator - shared styling
 */
export interface MidiStatusDisplayProps {
  isConnected: boolean;
  inputName?: string;
  outputName?: string;
}

export function MidiStatusDisplay({
  isConnected,
  inputName,
  outputName,
}: MidiStatusDisplayProps): JSX.Element {
  const connectedColor = 'var(--ac-status-connected, #22c55e)';
  const mutedColor = 'var(--ac-text-muted, #6b7280)';

  return (
    <div className="flex items-center gap-2 text-sm">
      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        <div
          style={{
            width: '0.5rem',
            height: '0.5rem',
            borderRadius: '50%',
            backgroundColor: isConnected ? connectedColor : mutedColor,
          }}
        />
        <span style={{ color: isConnected ? connectedColor : mutedColor }}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Port names when connected */}
      {isConnected && (inputName || outputName) && (
        <span style={{ color: 'var(--ac-text-muted, #9ca3af)', fontSize: '0.75rem' }}>
          {inputName && outputName
            ? `${inputName} ↔ ${outputName}`
            : inputName || outputName}
        </span>
      )}
    </div>
  );
}
