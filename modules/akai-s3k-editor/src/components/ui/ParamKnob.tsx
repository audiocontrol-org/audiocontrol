/**
 * ParamKnob — compact parameter control with visual value indicator.
 *
 * Displays a parameter as: label above, value bar + number below.
 * The bar shows the value's position within its range at a glance.
 * Click the number to type a precise value.
 *
 * Designed for dense grid layouts where many parameters need to be
 * visible simultaneously (like a hardware synth panel).
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface ParamKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Center-zero display (e.g., pan -50 to +50). Bar fills from center. */
  bipolar?: boolean;
  /** Format the display value (e.g., add "%" or "st") */
  format?: (value: number) => string;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

export function ParamKnob({
  label,
  value,
  min,
  max,
  onChange,
  bipolar,
  format,
}: ParamKnobProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = useCallback(() => {
    const parsed = Number(editValue);
    if (!Number.isNaN(parsed)) {
      onChange(clamp(parsed, min, max));
    }
    setEditing(false);
  }, [editValue, min, max, onChange]);

  const range = max - min || 1;
  const fraction = (value - min) / range;
  const displayValue = format ? format(value) : String(value);

  // Bar fill calculation
  let barStyle: { left: string; width: string };
  if (bipolar) {
    const center = (-min) / range;
    if (fraction >= center) {
      barStyle = { left: `${center * 100}%`, width: `${(fraction - center) * 100}%` };
    } else {
      barStyle = { left: `${fraction * 100}%`, width: `${(center - fraction) * 100}%` };
    }
  } else {
    barStyle = { left: '0%', width: `${fraction * 100}%` };
  }

  return (
    <div className="s3k-param">
      <span className="s3k-param-label">{label}</span>
      <div className="s3k-param-track">
        <div className="s3k-param-fill" style={barStyle} />
        {bipolar && (
          <div className="s3k-param-center" style={{ left: `${((-min) / range) * 100}%` }} />
        )}
      </div>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={editValue}
          min={min}
          max={max}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={commitEdit}
          className="s3k-param-input"
        />
      ) : (
        <button
          className="s3k-param-value"
          onClick={() => {
            setEditValue(String(value));
            setEditing(true);
          }}
          title={`${label}: ${displayValue} (${min}–${max})`}
        >
          {displayValue}
        </button>
      )}
    </div>
  );
}

/** Compact select for enum parameters */
interface ParamSelectProps {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
}

export function ParamSelect({ label, value, options, onChange }: ParamSelectProps): JSX.Element {
  return (
    <div className="s3k-param">
      <span className="s3k-param-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="s3k-param-select"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

/** Compact toggle for boolean parameters */
interface ParamToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ParamToggle({ label, checked, onChange }: ParamToggleProps): JSX.Element {
  return (
    <div className="s3k-param">
      <span className="s3k-param-label">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`s3k-param-toggle ${checked ? 's3k-param-toggle--on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        {checked ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
