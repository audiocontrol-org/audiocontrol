import { ParameterSlider, CollapsibleSection, formatSigned } from '@audiocontrol/editor-core';
import type { FilterParams, FilterType } from '@audiocontrol/synth-core';
import { sliderTheme, sectionTheme } from '@/components/program-editor/theme';
import { clsx } from 'clsx';

interface FilterSectionProps {
  filter: FilterParams | undefined;
  onChange: (filter: FilterParams | undefined) => void;
}

const FILTER_TYPES: FilterType[] = ['lowpass', 'highpass', 'bandpass'];
const FILTER_LABELS: Record<FilterType, string> = {
  lowpass: 'LP',
  highpass: 'HP',
  bandpass: 'BP',
};

// Map slider 0–127 to cutoff 20–20000 Hz (exponential)
function sliderToCutoff(v: number): number {
  return 20 * Math.pow(1000, v / 127);
}

function cutoffToSlider(hz: number): number {
  return Math.round(Math.log(hz / 20) / Math.log(1000) * 127);
}

function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}kHz`;
  return `${Math.round(hz)}Hz`;
}

const DEFAULT_FILTER: FilterParams = {
  type: 'lowpass',
  cutoff: 5000,
  resonance: 1,
  envelopeAmount: 0,
};

export function FilterSection({ filter, onChange }: FilterSectionProps): JSX.Element {
  const enabled = filter !== undefined;
  const current = filter ?? DEFAULT_FILTER;

  return (
    <CollapsibleSection title="Filter" defaultOpen={enabled} theme={sectionTheme}>
      <div className="flex items-center gap-3 mb-3">
        <button
          className={clsx(
            'text-xs px-2 py-1 rounded',
            enabled ? 'bg-sampler-highlight text-sampler-text' : 'bg-sampler-border text-sampler-muted',
          )}
          onClick={() => onChange(enabled ? undefined : { ...DEFAULT_FILTER })}
        >
          {enabled ? 'On' : 'Off'}
        </button>

        {enabled && (
          <div className="flex gap-1">
            {FILTER_TYPES.map((type) => (
              <button
                key={type}
                className={clsx(
                  'text-xs px-2 py-1 rounded',
                  current.type === type
                    ? 'bg-sampler-highlight text-sampler-text'
                    : 'bg-sampler-border text-sampler-muted hover:text-sampler-text',
                )}
                onClick={() => onChange({ ...current, type })}
              >
                {FILTER_LABELS[type]}
              </button>
            ))}
          </div>
        )}
      </div>

      {enabled && (
        <div className="grid grid-cols-3 gap-3">
          <ParameterSlider
            label="Cutoff"
            value={cutoffToSlider(current.cutoff)}
            min={0}
            max={127}
            onChange={(v) => onChange({ ...current, cutoff: sliderToCutoff(v) })}
            formatValue={(v) => formatHz(sliderToCutoff(v))}
            theme={sliderTheme}
          />
          <ParameterSlider
            label="Resonance"
            value={Math.round(current.resonance * 4.233)}
            min={0}
            max={127}
            onChange={(v) => onChange({ ...current, resonance: v / 4.233 })}
            formatValue={(v) => `Q ${(v / 4.233).toFixed(1)}`}
            theme={sliderTheme}
          />
          <ParameterSlider
            label="Env Amount"
            value={Math.round((current.envelopeAmount + 4) * (127 / 8))}
            min={0}
            max={127}
            onChange={(v) => onChange({ ...current, envelopeAmount: (v / (127 / 8)) - 4 })}
            formatValue={(v) => formatSigned(v, 64)}
            theme={sliderTheme}
          />
        </div>
      )}
    </CollapsibleSection>
  );
}
