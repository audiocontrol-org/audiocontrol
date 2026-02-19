/**
 * Shared Editor Layout Component
 *
 * Provides consistent layout structure across all audiocontrol editors.
 * Uses CSS primitives from the design system for styling.
 */

import { type ReactNode, type CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import { BuildInfo, getBuildInfo, type BuildInfoConfig } from './BuildInfo';

export interface NavItem {
  /** Route path */
  to: string;
  /** Display label */
  label: string;
}

export interface EditorLayoutConfig {
  /** Editor name (e.g., "D-110", "S-330") */
  editorName: string;
  /** Editor subtitle (e.g., "Roland LA Synthesizer") */
  editorSubtitle: string;
  /** Navigation items */
  navItems: NavItem[];
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
  /** Main content */
  children: ReactNode;
  /** Additional className for the main wrapper */
  className?: string;
  /** Custom style for main content area (e.g., when sidebar is open) */
  contentStyle?: CSSProperties;
}

export function EditorLayout({
  config,
  headerRight,
  children,
  className = '',
  contentStyle,
}: EditorLayoutProps): JSX.Element {
  const { navItems, editorName, buildInfoConfig, footerText } = config;

  return (
    <div className={`ac-site-shell ${className}`}>
      {/* Header */}
      <header className="ac-site-header">
        <div className="ac-site-header-inner">
          {/* Logo + Navigation */}
          <div className="ac-site-logo">
            <h1 className="ac-site-title">
              <span className="ac-site-title-accent">{editorName}</span> Editor
            </h1>
            <nav>
              <ul className="ac-site-nav">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className="ac-site-nav-link"
                      data-active={undefined}
                    >
                      {({ isActive }) => (
                        <span data-active={isActive || undefined}>{item.label}</span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Right side: custom content + build info */}
          <div className="ac-site-header-actions">
            {headerRight}
            <BuildInfo buildInfo={getBuildInfo()} config={buildInfoConfig} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="ac-site-main" style={contentStyle}>
        {children}
      </main>

      {/* Footer */}
      {footerText && (
        <footer className="ac-site-footer">
          <div className="ac-site-footer-inner">
            {footerText}
          </div>
        </footer>
      )}
    </div>
  );
}

/**
 * Panic button component - shared styling
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
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="ac-btn ac-btn-danger ac-btn-sm"
      title={disabled ? 'Connect to MIDI to enable' : title}
    >
      PANIC
    </button>
  );
}

/**
 * MIDI Status indicator - uses design system primitives
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
  const status = isConnected ? 'connected' : undefined;

  return (
    <div className="ac-status-indicator">
      {/* Status indicator */}
      <div className="ac-status-dot" data-status={status} />
      <span className="ac-status-label" data-status={status}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>

      {/* Port names when connected */}
      {isConnected && (inputName || outputName) && (
        <span className="ac-status-detail">
          {inputName && outputName
            ? `${inputName} ↔ ${outputName}`
            : inputName || outputName}
        </span>
      )}
    </div>
  );
}
