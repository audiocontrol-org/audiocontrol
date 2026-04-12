/**
 * Shared Editor Layout Component
 *
 * Provides consistent layout structure across all audiocontrol editors.
 * Uses CSS primitives from the design system for styling.
 */

import { type ReactNode, type CSSProperties } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  const location = useLocation();

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
                {navItems.map((item) => {
                  // Generate test ID from label: "Library" -> "library-nav-link"
                  // For device-specific pages (Tones, Patches), prefix with "device-"
                  // to distinguish from library pages (library-tones, library-patches)
                  const labelSlug = item.label.toLowerCase().replace(/\s+/g, '-');
                  const isDevicePage = labelSlug === 'tones' || labelSlug === 'patches';
                  const testId = isDevicePage
                    ? `device-${labelSlug}-nav-link`
                    : `${labelSlug}-nav-link`;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={`${item.to}${location.search}`}
                        className="ac-site-nav-link"
                        data-active={undefined}
                        data-testid={testId}
                      >
                        {({ isActive }) => (
                          <span data-active={isActive || undefined}>{item.label}</span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
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
      className="ac-btn ac-btn-sm"
      title={disabled ? 'Connect to MIDI to enable' : title}
    >
      <svg className="ac-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
      All Notes Off
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

      {/* Settings gear to indicate clickability */}
      <svg className="ac-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ opacity: 0.5, marginLeft: '0.5rem' }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  );
}
