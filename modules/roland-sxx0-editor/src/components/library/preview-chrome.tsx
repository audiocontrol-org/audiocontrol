/**
 * Library preview chrome — shared React primitives that render the
 * lean v3 column-pane chrome used by ItemPreviewPanel and
 * CommonSamplePreviewPanel.
 *
 * The visual primitives (.ac-preview-pane*, .ac-preview-eyebrow-row,
 * .ac-preview-name, .ac-preview-fields*, .ac-pane-actions,
 * .ac-pane-action*) live in roland-sxx0-editor/src/styles/_shared.css.
 *
 * These helpers exist so the two preview panels don't reimplement the
 * same JSX. Per the project's DRY discipline: shared structure stays
 * DRY; per-editor styling is fine.
 */

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------
// Pane wrapper
// ---------------------------------------------------------------

export interface PreviewPaneProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function PreviewPane({ title, subtitle, children }: PreviewPaneProps): JSX.Element {
  return (
    <div className="ac-preview-pane">
      <header className="ac-preview-pane-head">
        <h3 className="ac-preview-pane-head-title">{title}</h3>
        {subtitle && <span className="ac-preview-pane-head-sub">{subtitle}</span>}
      </header>
      <div className="ac-preview-pane-body">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------
// Item identity (eyebrow + name)
// ---------------------------------------------------------------

export interface PreviewIdentityProps {
  kind: string;
  slot?: string;
  name: string;
}

export function PreviewIdentity({ kind, slot, name }: PreviewIdentityProps): JSX.Element {
  return (
    <div>
      <div className="ac-preview-eyebrow-row">
        <span>{kind}</span>
        {slot && (
          <>
            <span className="ac-preview-eyebrow-sep" aria-hidden="true">·</span>
            <span className="ac-preview-eyebrow-slot">{slot}</span>
          </>
        )}
      </div>
      <h4 className="ac-preview-name">{name}</h4>
    </div>
  );
}

// ---------------------------------------------------------------
// Field grid (2-column label/value)
// ---------------------------------------------------------------

export interface FieldDef {
  label: string;
  value: ReactNode;
}

export function FieldGrid({ fields }: { fields: FieldDef[] }): JSX.Element {
  return (
    <div className="ac-preview-fields">
      {fields.map(({ label, value }) => (
        <div key={label} className="ac-preview-field">
          <span className="ac-preview-field-label">{label}</span>
          <span className="ac-preview-field-value">{value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------
// Lean action button (uppercase eyebrow chrome)
// ---------------------------------------------------------------

export interface PaneActionProps {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  testId?: string;
}

export function PaneAction({
  label,
  onClick,
  variant = 'default',
  disabled = false,
  busy = false,
  busyLabel,
  testId,
}: PaneActionProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      data-testid={testId}
      className={cn(
        'ac-pane-action',
        variant === 'primary' && 'ac-pane-action--primary',
        variant === 'danger' && 'ac-pane-action--danger',
      )}
    >
      {busy && <span className="ac-pane-action-spinner" aria-hidden="true" />}
      <span>{busy ? busyLabel ?? 'Working…' : label}</span>
    </button>
  );
}

// ---------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------

export function LoadingState(): JSX.Element {
  return (
    <div className="ac-preview-eyebrow-row" style={{ justifyContent: 'center' }}>
      <span className="ac-pane-action-spinner" aria-hidden="true" />
      <span>Loading</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }): JSX.Element {
  return (
    <div className="ac-preview-eyebrow-row" style={{ color: 'var(--ac-color-rec)' }}>
      Failed to load: {message}
    </div>
  );
}

export function EmptySlotMessage({ message }: { message: string }): JSX.Element {
  return (
    <div className="ac-preview-eyebrow-row" style={{ justifyContent: 'center' }}>
      {message}
    </div>
  );
}
