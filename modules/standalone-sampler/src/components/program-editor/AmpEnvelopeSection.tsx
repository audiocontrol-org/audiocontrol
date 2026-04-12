import { ParameterSlider, CollapsibleSection } from '@audiocontrol/editor-core';
import type { AmpEnvelopeParams } from '@audiocontrol/synth-core';
import { sliderTheme, sectionTheme } from '@/components/program-editor/theme';
import { formatTime } from '@/lib/format-utils';

interface AmpEnvelopeSectionProps {
  envelope: AmpEnvelopeParams;
  onChange: (envelope: Partial<AmpEnvelopeParams>) => void;
}

function formatLevel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// Map slider 0-127 to time 0-5s (exponential curve for finer low-end control)
function sliderToTime(v: number): number {
  return Math.pow(v / 127, 2) * 5;
}

function timeToSlider(t: number): number {
  return Math.round(Math.sqrt(t / 5) * 127);
}

export function AmpEnvelopeSection({ envelope, onChange }: AmpEnvelopeSectionProps): JSX.Element {
  return (
    <CollapsibleSection title="Amp Envelope" defaultOpen theme={sectionTheme}>
      <div className="grid grid-cols-4 gap-3">
        <ParameterSlider
          label="Attack"
          value={timeToSlider(envelope.attack)}
          min={0}
          max={127}
          onChange={(v) => onChange({ attack: sliderToTime(v) })}
          formatValue={(v) => formatTime(sliderToTime(v))}
          theme={sliderTheme}
        />
        <ParameterSlider
          label="Decay"
          value={timeToSlider(envelope.decay)}
          min={0}
          max={127}
          onChange={(v) => onChange({ decay: sliderToTime(v) })}
          formatValue={(v) => formatTime(sliderToTime(v))}
          theme={sliderTheme}
        />
        <ParameterSlider
          label="Sustain"
          value={Math.round(envelope.sustain * 127)}
          min={0}
          max={127}
          onChange={(v) => onChange({ sustain: v / 127 })}
          formatValue={(v) => formatLevel(v / 127)}
          theme={sliderTheme}
        />
        <ParameterSlider
          label="Release"
          value={timeToSlider(envelope.release)}
          min={0}
          max={127}
          onChange={(v) => onChange({ release: sliderToTime(v) })}
          formatValue={(v) => formatTime(sliderToTime(v))}
          theme={sliderTheme}
        />
      </div>
    </CollapsibleSection>
  );
}
