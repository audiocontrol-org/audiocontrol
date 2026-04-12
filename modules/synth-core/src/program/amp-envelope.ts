import type { AmpEnvelopeParams } from '@/types/program-playback';

/**
 * An active ADSR envelope controlling a GainNode.
 *
 * Call `triggerAttack` on noteOn, `triggerRelease` on noteOff.
 * The envelope drives the gain value from 0 through attack/decay/sustain,
 * then fades to 0 on release.
 */
export interface AmpEnvelope {
  /** The GainNode this envelope controls — connect it into the signal chain. */
  readonly gainNode: GainNode;
  /** Start the attack phase. Call once on noteOn. */
  triggerAttack(velocity: number): void;
  /** Start the release phase. Call once on noteOff. Returns time in seconds until silent. */
  triggerRelease(): number;
  /** Immediately silence and disconnect. */
  dispose(): void;
}

/**
 * Create an ADSR amp envelope backed by a Web Audio GainNode.
 *
 * Signal chain: source → [filter] → gainNode → destination
 * The gainNode's gain parameter is automated by the ADSR schedule.
 */
export function createAmpEnvelope(
  ctx: AudioContext,
  params: AmpEnvelopeParams,
): AmpEnvelope {
  const gainNode = ctx.createGain();
  gainNode.gain.value = 0;

  return {
    get gainNode() {
      return gainNode;
    },

    triggerAttack(velocity: number): void {
      const peak = velocity / 127;
      const sustainLevel = params.sustain * peak;
      const now = ctx.currentTime;

      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(0, now);

      if (params.attack > 0) {
        gainNode.gain.linearRampToValueAtTime(peak, now + params.attack);
      } else {
        gainNode.gain.setValueAtTime(peak, now);
      }

      const decayStart = now + params.attack;
      if (params.decay > 0) {
        gainNode.gain.linearRampToValueAtTime(sustainLevel, decayStart + params.decay);
      } else {
        gainNode.gain.setValueAtTime(sustainLevel, decayStart);
      }
    },

    triggerRelease(): number {
      const now = ctx.currentTime;
      const release = Math.max(params.release, 0.005); // minimum 5ms to avoid clicks

      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(0, now + release);

      return release;
    },

    dispose(): void {
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      try { gainNode.disconnect(); } catch { /* already disconnected */ }
    },
  };
}
