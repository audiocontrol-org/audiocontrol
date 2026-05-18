/**
 * LoopEditorToolbar — v3 chrome for the loop-editor header.
 *
 * Layout:
 *   Row 1 — title eyebrow + auto-detect + preview/stop buttons
 *   Row 2 — playback mode toggle + discontinuity + xfade slider
 *   Row 3 — midi toggle + active voices + zoom cluster
 *
 * Built from editor-core v3 primitives:
 *   - `.ac-toolbar-btn` for chrome buttons (auto-detect, preview, smoothing,
 *     zoom reset)
 *   - `.ac-icon-btn` for zoom -/+ icons
 *   - `<AcToggle>` for playback mode + MIDI on/off
 *   - native range styled with `.ac-input` token border for xfade — a full
 *     `AcSlider` row is overkill for this inline strip
 *
 * Testid contract preserved (consumed by loop-editor-production e2e):
 *   preview-loop-btn, playback-mode-{no-loop|loop|smoothed-loop},
 *   discontinuity-indicator, crossfade-length-slider, crossfade-length-value,
 *   midi-toggle. The AcToggle component places dataTestId on the `<label>`;
 *   selection asserts via the `data-active` attribute it sets on the active
 *   option.
 */

import { AcToggle } from '@audiocontrol/editor-core';
import { cn } from './utils';

const MIN_ZOOM = 1;
const MAX_ZOOM = 128;

const PLAYBACK_MODE_OPTIONS = [
  { value: 'no-loop' as const,       label: 'No Loop',  dataTestId: 'playback-mode-no-loop' },
  { value: 'loop' as const,          label: 'Loop',     dataTestId: 'playback-mode-loop' },
  { value: 'smoothed-loop' as const, label: 'Smoothed', dataTestId: 'playback-mode-smoothed-loop' },
] as const;

const MIDI_OPTIONS = [
  { value: 'off' as const, label: 'Off', dataTestId: 'midi-toggle-off' },
  { value: 'on'  as const, label: 'On',  dataTestId: 'midi-toggle-on' },
] as const;

export interface LoopEditorToolbarProps {
  /** Auto-detect trigger; column hides when omitted. */
  onAutoDetect?: () => void;
  isSearching: boolean;
  /** Preview controls (preview button + stop). Hidden when no `audio`. */
  audio: boolean;
  isPlaying: boolean;
  previewMode: 'normal' | 'smoothed' | null;
  onPreviewLoop: () => void;
  onPreviewSmoothed: () => void;
  onStopPreview: () => void;
  /** Playback-mode toggle; hidden when no callback. */
  playbackMode?: 'no-loop' | 'loop' | 'smoothed-loop';
  onPlaybackModeChange?: (mode: 'no-loop' | 'loop' | 'smoothed-loop') => void;
  /** Splice-point discontinuity readout (in the mode row). */
  discontinuity?: { normalizedAmplitudeStep: number; needsSmoothing: boolean } | null;
  /** Xfade length range (in the mode row). */
  crossfadeLength?: number;
  onCrossfadeLengthChange?: (length: number) => void;
  /** MIDI on/off toggle. Hidden when no callback. */
  midiEnabled?: boolean;
  onMidiEnabledChange?: (enabled: boolean) => void;
  activeNoteCount?: number;
  /** Legacy one-shot smoothing button — only renders when the
   *  newer playback-mode callback is absent. */
  onSmoothLoop?: (mode: 'linear' | 'equal-power') => void;
  isSmoothing: boolean;
  /** Zoom cluster. */
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function LoopEditorToolbar({
  onAutoDetect,
  isSearching,
  audio,
  isPlaying,
  previewMode,
  onPreviewLoop,
  onPreviewSmoothed,
  onStopPreview,
  playbackMode,
  onPlaybackModeChange,
  discontinuity,
  crossfadeLength,
  onCrossfadeLengthChange,
  midiEnabled,
  onMidiEnabledChange,
  activeNoteCount,
  onSmoothLoop,
  isSmoothing,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: LoopEditorToolbarProps): JSX.Element {
  return (
    <div className="ac-loop-toolbar">
      {/* Row 1 — identity + primary actions */}
      <div className="ac-loop-toolbar__row">
        <div className="ac-loop-toolbar__title-block">
          <h3 className="ac-loop-toolbar__title">Loop Editor</h3>
          <span
            className="ac-loop-toolbar__eyebrow"
            title="This feature is still being designed and not all the wrinkles have been smoothed out yet."
          >
            Experimental
          </span>
        </div>
        <div className="ac-loop-toolbar__actions">
          {onAutoDetect && (
            <button
              onClick={onAutoDetect}
              disabled={isSearching}
              className="ac-toolbar-btn"
              title="Auto-detect loop points"
            >
              {isSearching ? 'Searching…' : 'Auto-Detect'}
            </button>
          )}
          {audio && !isPlaying && (
            <>
              <button
                onClick={onPreviewLoop}
                className="ac-toolbar-btn"
                title="Preview loop (hear the splice point)"
                data-testid="preview-loop-btn"
              >
                ▶ Preview
              </button>
              <button
                onClick={onPreviewSmoothed}
                className="ac-toolbar-btn"
                title="Preview with crossfade smoothing applied"
              >
                ▶ Smoothed
              </button>
            </>
          )}
          {audio && isPlaying && (
            <button
              onClick={onStopPreview}
              className="ac-toolbar-btn ac-toolbar-btn--primary"
              title="Stop playback"
            >
              ■ Stop{previewMode === 'smoothed' ? ' (smoothed)' : ''}
            </button>
          )}
          {onSmoothLoop && !onPlaybackModeChange && (
            <button
              onClick={() => onSmoothLoop('equal-power')}
              disabled={isSmoothing || isPlaying}
              className="ac-toolbar-btn"
              title="Apply crossfade at loop splice point to eliminate clicks"
            >
              {isSmoothing ? 'Smoothing…' : 'Apply Smoothing'}
            </button>
          )}
        </div>
      </div>

      {/* Row 2 — playback mode + discontinuity + xfade */}
      {onPlaybackModeChange && (
        <div className="ac-loop-toolbar__row ac-loop-toolbar__row--secondary">
          <div className="ac-loop-toolbar__field">
            <span className="ac-field-label">Mode</span>
            <AcToggle
              value={playbackMode ?? 'loop'}
              options={PLAYBACK_MODE_OPTIONS}
              onChange={onPlaybackModeChange}
              ariaLabel="Playback mode"
              name="loop-playback-mode"
            />
          </div>
          {discontinuity && (
            <span
              data-testid="discontinuity-indicator"
              className={cn(
                'ac-loop-toolbar__discontinuity',
                discontinuity.needsSmoothing
                  ? 'ac-loop-toolbar__discontinuity--warn'
                  : 'ac-loop-toolbar__discontinuity--ok',
              )}
              title={`Amplitude step at splice: ${(discontinuity.normalizedAmplitudeStep * 100).toFixed(1)}%`}
            >
              {discontinuity.needsSmoothing ? '⚠' : '✓'}{' '}
              {(discontinuity.normalizedAmplitudeStep * 100).toFixed(1)}%
            </span>
          )}
          {onCrossfadeLengthChange && crossfadeLength !== undefined && (
            <div className="ac-loop-toolbar__field ac-loop-toolbar__field--xfade">
              <span className="ac-field-label">Xfade</span>
              <input
                type="range"
                min={8}
                max={2048}
                step={8}
                value={crossfadeLength}
                onChange={(e) => onCrossfadeLengthChange(parseInt(e.target.value, 10))}
                className="ac-loop-toolbar__xfade-range"
                data-testid="crossfade-length-slider"
                title={`Crossfade length: ${crossfadeLength} samples`}
              />
              <span className="ac-loop-toolbar__xfade-value" data-testid="crossfade-length-value">
                {crossfadeLength}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Row 3 — MIDI + zoom */}
      <div className="ac-loop-toolbar__row ac-loop-toolbar__row--secondary">
        {onMidiEnabledChange && (
          <div className="ac-loop-toolbar__field">
            <span className="ac-field-label">MIDI</span>
            <AcToggle
              value={midiEnabled ? 'on' : 'off'}
              options={MIDI_OPTIONS}
              onChange={(next) => onMidiEnabledChange(next === 'on')}
              ariaLabel="MIDI keyboard playback"
              name="loop-midi-enabled"
              className="ac-loop-toolbar__midi-toggle"
            />
            {midiEnabled && activeNoteCount != null && activeNoteCount > 0 && (
              <span className="ac-loop-toolbar__voices">
                {activeNoteCount} {activeNoteCount === 1 ? 'voice' : 'voices'}
              </span>
            )}
          </div>
        )}
        <div className="ac-loop-toolbar__zoom">
          <span className="ac-field-label">Zoom</span>
          <button
            onClick={onZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="ac-icon-btn"
            title="Zoom out"
            aria-label="Zoom out"
          >−</button>
          <button
            onClick={onZoomReset}
            className="ac-toolbar-btn ac-loop-toolbar__zoom-reset"
            title="Reset zoom"
          >{zoom}x</button>
          <button
            onClick={onZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="ac-icon-btn"
            title="Zoom in"
            aria-label="Zoom in"
          >+</button>
        </div>
      </div>
    </div>
  );
}
