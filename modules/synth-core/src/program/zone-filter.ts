import type { FilterParams, AmpEnvelopeParams } from '@/types/program-playback';

/**
 * An active filter in the voice signal chain.
 *
 * Wraps a BiquadFilterNode with optional cutoff modulation from
 * the amp envelope shape. The envelope amount is in octaves — positive
 * values sweep the cutoff up during attack, negative values sweep down.
 */
export interface ZoneFilter {
  /** The BiquadFilterNode — connect it into the signal chain. */
  readonly filterNode: BiquadFilterNode;
  /** Schedule the filter envelope (cutoff modulation). Call on noteOn. */
  triggerAttack(velocity: number): void;
  /** Schedule the release phase of the filter envelope. */
  triggerRelease(): void;
  /** Disconnect. */
  dispose(): void;
}

/**
 * Create a per-zone filter backed by a BiquadFilterNode.
 *
 * If `envelopeAmount` is non-zero, the cutoff frequency is modulated
 * by the same ADSR shape as the amp envelope. The modulation is
 * additive in octaves: cutoff * 2^(amount * envelopeValue).
 */
export function createZoneFilter(
  ctx: AudioContext,
  params: FilterParams,
  ampEnvelopeParams: AmpEnvelopeParams,
): ZoneFilter {
  const filterNode = ctx.createBiquadFilter();
  filterNode.type = params.type;
  filterNode.frequency.value = params.cutoff;
  filterNode.Q.value = params.resonance;

  const hasEnvelope = params.envelopeAmount !== 0;

  function cutoffAtEnvelopeLevel(level: number): number {
    // level is 0–1 from the ADSR shape
    // Shift cutoff by envelopeAmount octaves scaled by envelope level
    return params.cutoff * Math.pow(2, params.envelopeAmount * level);
  }

  return {
    get filterNode() {
      return filterNode;
    },

    triggerAttack(velocity: number): void {
      if (!hasEnvelope) return;

      const peak = velocity / 127;
      const sustainLevel = ampEnvelopeParams.sustain * peak;
      const now = ctx.currentTime;

      filterNode.frequency.cancelScheduledValues(now);
      filterNode.frequency.setValueAtTime(params.cutoff, now);

      // Attack: sweep to peak envelope level
      const peakCutoff = cutoffAtEnvelopeLevel(peak);
      if (ampEnvelopeParams.attack > 0) {
        filterNode.frequency.linearRampToValueAtTime(peakCutoff, now + ampEnvelopeParams.attack);
      } else {
        filterNode.frequency.setValueAtTime(peakCutoff, now);
      }

      // Decay: sweep to sustain envelope level
      const sustainCutoff = cutoffAtEnvelopeLevel(sustainLevel);
      const decayStart = now + ampEnvelopeParams.attack;
      if (ampEnvelopeParams.decay > 0) {
        filterNode.frequency.linearRampToValueAtTime(sustainCutoff, decayStart + ampEnvelopeParams.decay);
      } else {
        filterNode.frequency.setValueAtTime(sustainCutoff, decayStart);
      }
    },

    triggerRelease(): void {
      if (!hasEnvelope) return;

      const now = ctx.currentTime;
      const release = Math.max(ampEnvelopeParams.release, 0.005);

      filterNode.frequency.cancelScheduledValues(now);
      filterNode.frequency.setValueAtTime(filterNode.frequency.value, now);
      filterNode.frequency.linearRampToValueAtTime(params.cutoff, now + release);
    },

    dispose(): void {
      filterNode.frequency.cancelScheduledValues(ctx.currentTime);
      try { filterNode.disconnect(); } catch { /* already disconnected */ }
    },
  };
}
