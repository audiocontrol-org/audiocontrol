/**
 * Generic sample metadata detail panel.
 *
 * Displays common SampleYaml properties in a readable layout.
 * Device-specific actions (load, promote, etc.) are injected
 * via the `actions` slot.
 */

import React from 'react';

export interface SampleMetadata {
  name: string;
  sampleRate: number;
  loopMode?: string;
  loopStart?: number;
  loopEnd?: number;
  rootKey?: string | number;
  tags?: string[];
  description?: string;
  sourceDevice?: string;
  modifiedAt?: string;
}

export interface SampleDetailPanelProps {
  /** The selected sample's metadata */
  sample: SampleMetadata | null;
  /** Optional action buttons rendered below the metadata */
  actions?: React.ReactNode;
}

function MetadataRow({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div className="ac-sample-detail-row">
      <span className="ac-sample-detail-label">{label}</span>
      <span className="ac-sample-detail-value">{value}</span>
    </div>
  );
}

function formatLoopMode(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1).replace(/-/g, ' ');
}

export function SampleDetailPanel({ sample, actions }: SampleDetailPanelProps): JSX.Element {
  if (!sample) {
    return (
      <div className="ac-sample-detail-empty">
        Select a sample to view details
      </div>
    );
  }

  return (
    <div className="ac-sample-detail">
      <h3 className="ac-sample-detail-name">{sample.name}</h3>

      {sample.description && (
        <p className="ac-sample-detail-description">{sample.description}</p>
      )}

      <div className="ac-sample-detail-meta">
        <MetadataRow label="Sample Rate" value={`${sample.sampleRate.toLocaleString()} Hz`} />
        {sample.loopMode && (
          <MetadataRow label="Loop Mode" value={formatLoopMode(sample.loopMode)} />
        )}
        {sample.loopStart !== undefined && (
          <MetadataRow label="Loop Start" value={sample.loopStart.toLocaleString()} />
        )}
        {sample.loopEnd !== undefined && (
          <MetadataRow label="Loop End" value={sample.loopEnd.toLocaleString()} />
        )}
        {sample.rootKey !== undefined && (
          <MetadataRow label="Root Key" value={String(sample.rootKey)} />
        )}
        {sample.sourceDevice && (
          <MetadataRow label="Source" value={sample.sourceDevice} />
        )}
        {sample.modifiedAt && (
          <MetadataRow label="Modified" value={new Date(sample.modifiedAt).toLocaleDateString()} />
        )}
      </div>

      {sample.tags && sample.tags.length > 0 && (
        <div className="ac-sample-detail-tags">
          {sample.tags.map((tag) => (
            <span key={tag} className="ac-sample-detail-tag">{tag}</span>
          ))}
        </div>
      )}

      {actions && (
        <div className="ac-sample-detail-actions">{actions}</div>
      )}
    </div>
  );
}
