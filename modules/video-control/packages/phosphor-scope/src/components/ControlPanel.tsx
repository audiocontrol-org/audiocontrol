import { useScopeStore, useFilmStore, useRecordingStore } from '@/stores'
import { Slider, ButtonGroup, ColorSwatch, Section } from '@/components/ui'
import type { VisualizationMode, PhosphorColor, VideoFormat } from '@audiocontrol/video-core'

const MODE_OPTIONS: { value: VisualizationMode; label: string }[] = [
  { value: 'waveform', label: '1 Wave' },
  { value: 'lissajous', label: '2 Lissajous' },
  { value: 'spectrum', label: '3 FFT' },
]

const FORMAT_OPTIONS: { value: VideoFormat; label: string }[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'instagram', label: 'Insta' },
  { value: 'square', label: 'Square' },
]

const PHOSPHOR_COLORS: PhosphorColor[] = ['green', 'amber', 'blue', 'white']

export function ControlPanel() {
  const scope = useScopeStore()
  const film = useFilmStore()
  const recording = useRecordingStore()

  return (
    <aside className="w-64 bg-crt-panel border-l border-crt-border overflow-y-auto flex-shrink-0 hidden lg:block">
      <div className="p-4">
        {/* Mode */}
        <Section title="Mode">
          <ButtonGroup
            options={MODE_OPTIONS}
            value={scope.mode}
            onChange={scope.setMode}
          />
        </Section>

        {/* Phosphor Color */}
        <Section title="Phosphor">
          <ColorSwatch
            colors={PHOSPHOR_COLORS}
            value={scope.color}
            onChange={scope.setColor}
          />
        </Section>

        {/* Beam Settings */}
        <Section title="Beam">
          <Slider
            label="Persistence"
            value={scope.persistence}
            min={0.5}
            max={0.98}
            step={0.01}
            onChange={scope.setPersistence}
          />
          <Slider
            label="Glow Intensity"
            value={scope.glowIntensity}
            min={0}
            max={3}
            step={0.1}
            onChange={scope.setGlowIntensity}
          />
          <Slider
            label="Beam Width"
            value={scope.beamWidth}
            min={0.5}
            max={5}
            step={0.1}
            onChange={scope.setBeamWidth}
          />
          <Slider
            label="Bloom"
            value={scope.bloomRadius}
            min={0}
            max={40}
            step={1}
            onChange={scope.setBloomRadius}
          />
        </Section>

        {/* Signal */}
        <Section title="Signal">
          <Slider
            label="Gain"
            value={scope.gain}
            min={0.1}
            max={4}
            step={0.1}
            onChange={scope.setGain}
          />
          <Slider
            label="Density"
            value={scope.density}
            min={0.25}
            max={3}
            step={0.25}
            onChange={scope.setDensity}
          />
        </Section>

        {/* CRT FX */}
        <Section title="CRT FX">
          <Slider
            label="Scanlines"
            value={scope.scanlineAlpha}
            min={0}
            max={0.3}
            step={0.01}
            onChange={scope.setScanlineAlpha}
          />
          <Slider
            label="Noise"
            value={scope.noiseAmount}
            min={0}
            max={0.1}
            step={0.005}
            onChange={scope.setNoiseAmount}
          />
          <Slider
            label="Flicker"
            value={scope.flickerAmount}
            min={0}
            max={0.1}
            step={0.005}
            onChange={scope.setFlickerAmount}
          />
        </Section>

        {/* Film FX */}
        <Section title="Film FX">
          <Slider
            label="Grain"
            value={film.grain}
            min={0}
            max={1}
            step={0.05}
            onChange={film.setGrain}
            formatValue={(v) => v.toFixed(2)}
          />
          <Slider
            label="Gate Weave"
            value={film.weave}
            min={0}
            max={2}
            step={0.1}
            onChange={film.setWeave}
          />
          <Slider
            label="Flicker"
            value={film.flicker}
            min={0}
            max={0.6}
            step={0.01}
            onChange={film.setFlicker}
          />
          <Slider
            label="Scratches"
            value={film.scratches}
            min={0}
            max={1}
            step={0.05}
            onChange={film.setScratches}
            formatValue={(v) => v.toFixed(2)}
          />
          <Slider
            label="Light Leaks"
            value={film.lightLeaks}
            min={0}
            max={1}
            step={0.05}
            onChange={film.setLightLeaks}
            formatValue={(v) => v.toFixed(1)}
          />
          <Slider
            label="Dust & Hair"
            value={film.dust}
            min={0}
            max={1}
            step={0.05}
            onChange={film.setDust}
            formatValue={(v) => v.toFixed(1)}
          />
          <Slider
            label="Color Fade"
            value={film.colorFade}
            min={0}
            max={0.5}
            step={0.01}
            onChange={film.setColorFade}
          />
        </Section>

        {/* Record */}
        <Section title="Record">
          <ButtonGroup
            options={FORMAT_OPTIONS}
            value={recording.format}
            onChange={recording.setFormat}
          />
        </Section>
      </div>
    </aside>
  )
}
