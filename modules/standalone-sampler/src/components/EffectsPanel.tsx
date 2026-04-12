import { ParameterSlider, CollapsibleSection } from '@audiocontrol/editor-core';
import { sliderTheme, sectionTheme } from '@/components/program-editor/theme';
import { useEffectsStore } from '@/stores/effectsStore';
import { clsx } from 'clsx';

function formatTime(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)}ms`;
  return `${ms.toFixed(2)}s`;
}

function formatPercent(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function formatHz(v: number): string {
  return `${v.toFixed(1)}Hz`;
}

function EnableButton({ enabled, onClick }: { enabled: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      className={clsx(
        'text-xs px-2 py-0.5 rounded',
        enabled ? 'bg-sampler-highlight text-sampler-text' : 'bg-sampler-border text-sampler-muted',
      )}
      onClick={onClick}
    >
      {enabled ? 'On' : 'Off'}
    </button>
  );
}

export function EffectsPanel(): JSX.Element {
  const { effects, updateReverb, updateDelay, updateChorus } = useEffectsStore();

  return (
    <div className="flex flex-col gap-2">
      <CollapsibleSection title="Reverb" defaultOpen={effects.reverb.enabled} theme={sectionTheme}>
        <div className="flex items-center gap-2 mb-2">
          <EnableButton enabled={effects.reverb.enabled} onClick={() => updateReverb({ enabled: !effects.reverb.enabled })} />
        </div>
        {effects.reverb.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <ParameterSlider
              label="Mix"
              value={Math.round(effects.reverb.mix * 127)}
              min={0} max={127}
              onChange={(v) => updateReverb({ mix: v / 127 })}
              formatValue={(v) => formatPercent(v / 127)}
              theme={sliderTheme}
            />
            <ParameterSlider
              label="Decay"
              value={Math.round(effects.reverb.decay * 25.4)}
              min={1} max={127}
              onChange={(v) => updateReverb({ decay: v / 25.4 })}
              formatValue={(v) => formatTime(v / 25.4)}
              theme={sliderTheme}
            />
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Delay" defaultOpen={effects.delay.enabled} theme={sectionTheme}>
        <div className="flex items-center gap-2 mb-2">
          <EnableButton enabled={effects.delay.enabled} onClick={() => updateDelay({ enabled: !effects.delay.enabled })} />
        </div>
        {effects.delay.enabled && (
          <div className="grid grid-cols-3 gap-3">
            <ParameterSlider
              label="Mix"
              value={Math.round(effects.delay.mix * 127)}
              min={0} max={127}
              onChange={(v) => updateDelay({ mix: v / 127 })}
              formatValue={(v) => formatPercent(v / 127)}
              theme={sliderTheme}
            />
            <ParameterSlider
              label="Time"
              value={Math.round(effects.delay.time * 127)}
              min={1} max={127}
              onChange={(v) => updateDelay({ time: v / 127 })}
              formatValue={(v) => formatTime(v / 127)}
              theme={sliderTheme}
            />
            <ParameterSlider
              label="Feedback"
              value={Math.round(effects.delay.feedback * 127)}
              min={0} max={120}
              onChange={(v) => updateDelay({ feedback: v / 127 })}
              formatValue={(v) => formatPercent(v / 127)}
              theme={sliderTheme}
            />
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Chorus" defaultOpen={effects.chorus.enabled} theme={sectionTheme}>
        <div className="flex items-center gap-2 mb-2">
          <EnableButton enabled={effects.chorus.enabled} onClick={() => updateChorus({ enabled: !effects.chorus.enabled })} />
        </div>
        {effects.chorus.enabled && (
          <div className="grid grid-cols-3 gap-3">
            <ParameterSlider
              label="Mix"
              value={Math.round(effects.chorus.mix * 127)}
              min={0} max={127}
              onChange={(v) => updateChorus({ mix: v / 127 })}
              formatValue={(v) => formatPercent(v / 127)}
              theme={sliderTheme}
            />
            <ParameterSlider
              label="Rate"
              value={Math.round(effects.chorus.rate * 12.7)}
              min={1} max={127}
              onChange={(v) => updateChorus({ rate: v / 12.7 })}
              formatValue={(v) => formatHz(v / 12.7)}
              theme={sliderTheme}
            />
            <ParameterSlider
              label="Depth"
              value={Math.round(effects.chorus.depth * 12700)}
              min={1} max={127}
              onChange={(v) => updateChorus({ depth: v / 12700 })}
              formatValue={(v) => formatTime(v / 12700)}
              theme={sliderTheme}
            />
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
