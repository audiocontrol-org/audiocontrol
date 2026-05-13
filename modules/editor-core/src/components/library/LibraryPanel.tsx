/**
 * Library panel shell component.
 *
 * Provides the chrome around library content: connection status,
 * tab bar, loading/error/empty states, and refresh control.
 * Content is rendered via children.
 */

import React from 'react';
import { NewFolderIcon } from './TreeIcons';

export interface LibraryTab {
  id: string;
  label: string;
  /** Optional badge count */
  count?: number;
}

export interface LibraryPanelProps {
  /** Optional connection status indicator rendered at the top */
  connectionSlot?: React.ReactNode;
  /** Tab definitions. If omitted or empty, no tab bar is shown. */
  tabs?: LibraryTab[];
  /** Currently active tab ID */
  activeTabId?: string;
  /** Called when a tab is clicked */
  onTabChange?: (tabId: string) => void;
  /** Whether content is loading */
  loading?: boolean;
  /** Error message to display instead of content */
  error?: string;
  /** Message shown when there are no items */
  emptyMessage?: string;
  /** Whether to show the empty message (e.g., when content has no items) */
  isEmpty?: boolean;
  /** Called when refresh button is clicked */
  onRefresh?: () => void;
  /** Called when the new-folder button is clicked. When provided, renders
   *  a new-folder button in the header. The parent component handles
   *  the actual folder creation dialog and logic. */
  onCreateFolder?: () => void;
  /** Panel title */
  title?: string;
  /** Actions rendered in the header (e.g., create folder button) */
  headerActions?: React.ReactNode;
  /** Main content */
  children?: React.ReactNode;
}

export function LibraryPanel({
  connectionSlot,
  tabs,
  activeTabId,
  onTabChange,
  loading,
  error,
  emptyMessage = 'No items',
  isEmpty,
  onCreateFolder,
  onRefresh,
  title,
  headerActions,
  children,
}: LibraryPanelProps): JSX.Element {
  return (
    <div className="ac-library-panel">
      {/* Connection status */}
      {connectionSlot && (
        <div className="ac-library-panel-connection">{connectionSlot}</div>
      )}

      {/* Header */}
      {(title || headerActions || onRefresh || onCreateFolder) && (
        <div className="ac-library-panel-header">
          {title && <span className="ac-library-panel-title">{title}</span>}
          <div className="ac-library-panel-header-actions">
            {headerActions}
            {onCreateFolder && (
              <button
                className="ac-btn ac-btn-sm"
                onClick={onCreateFolder}
                disabled={loading}
                title="New folder"
              >
                <NewFolderIcon />
              </button>
            )}
            {onRefresh && (
              <button
                className="ac-btn ac-btn-sm"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh"
              >
                {loading ? '...' : '↻'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab bar */}
      {tabs && tabs.length > 0 && (
        <div className="ac-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`ac-tab ${activeTabId === tab.id ? 'ac-tab--active' : ''}`}
              onClick={() => onTabChange?.(tab.id)}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ac-tab-badge">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="ac-library-panel-content ac-list-scroll">
        {loading && !children && (
          <div className="ac-library-panel-status">Loading...</div>
        )}
        {error && (
          <div className="ac-library-panel-status ac-text-error">{error}</div>
        )}
        {!loading && !error && isEmpty && (
          <div className="ac-library-panel-status">{emptyMessage}</div>
        )}
        {!error && children}
      </div>
    </div>
  );
}
