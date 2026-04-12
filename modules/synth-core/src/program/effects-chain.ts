import type { EffectsChainParams, ReverbParams, DelayParams, ChorusParams } from '@/types/effects';

/**
 * An active effects chain that sits between the program engine
 * output and the AudioContext destination.
 *
 * Signal flow: input -> chorus -> delay -> reverb -> output
 * Each effect has a parallel dry path mixed with the wet signal.
 */
export interface EffectsChain {
  /** Connect your source to this node. */
  readonly input: AudioNode;
  /** Update all effect parameters. */
  update(params: EffectsChainParams): void;
  /** Disconnect and clean up. */
  dispose(): void;
}

/** Maximum feedback to prevent infinite delay loops. */
const MAX_FEEDBACK = 0.95;

/**
 * Create a Web Audio effects chain.
 *
 * Each effect is a wet/dry parallel mix using GainNodes.
 * Reverb uses a generated impulse response (ConvolverNode).
 * Delay uses DelayNode with feedback loop.
 * Chorus uses a modulated DelayNode via LFO.
 */
export function createEffectsChain(
  ctx: AudioContext,
  params: EffectsChainParams,
  destination?: AudioNode,
): EffectsChain {
  const dest = destination ?? ctx.destination;

  // Build nodes for each effect
  const chorusNodes = createChorusNodes(ctx, params.chorus);
  const delayNodes = createDelayNodes(ctx, params.delay);
  const reverbState = createReverbState(ctx, params.reverb);

  // Wire the chain: input -> chorus -> delay -> reverb -> destination
  const input = ctx.createGain();
  input.gain.value = 1;

  connectEffect(input, chorusNodes);
  connectEffect(chorusNodes.output, delayNodes);
  connectEffect(delayNodes.output, reverbState.nodes);
  reverbState.nodes.output.connect(dest);

  return {
    get input() { return input; },

    update(newParams: EffectsChainParams): void {
      updateChorus(chorusNodes, newParams.chorus);
      updateDelay(delayNodes, newParams.delay);
      updateReverb(ctx, reverbState, newParams.reverb);
    },

    dispose(): void {
      chorusNodes.lfo.stop();
      try { input.disconnect(); } catch { /* ok */ }
      try { chorusNodes.output.disconnect(); } catch { /* ok */ }
      try { delayNodes.output.disconnect(); } catch { /* ok */ }
      try { reverbState.nodes.output.disconnect(); } catch { /* ok */ }
    },
  };
}

// ---------------------------------------------------------------------------
// Effect node structures
// ---------------------------------------------------------------------------

interface EffectNodes {
  dry: GainNode;
  wet: GainNode;
  output: GainNode;
}

interface ChorusNodes extends EffectNodes {
  lfo: OscillatorNode;
  lfoGain: GainNode;
  delay: DelayNode;
}

interface DelayEffectNodes extends EffectNodes {
  delay: DelayNode;
  feedback: GainNode;
}

interface ReverbNodes extends EffectNodes {
  convolver: ConvolverNode;
}

interface ReverbState {
  nodes: ReverbNodes;
  currentDecay: number;
}

function connectEffect(source: AudioNode, effect: EffectNodes): void {
  source.connect(effect.dry);
  source.connect(effect.wet);
}

// ---------------------------------------------------------------------------
// Reverb
// ---------------------------------------------------------------------------

function createReverbState(ctx: AudioContext, params: ReverbParams): ReverbState {
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const output = ctx.createGain();
  const convolver = ctx.createConvolver();

  convolver.buffer = generateImpulseResponse(ctx, params.decay);

  dry.gain.value = params.enabled ? 1 - params.mix : 1;
  wet.gain.value = params.enabled ? params.mix : 0;

  wet.connect(convolver);
  convolver.connect(output);
  dry.connect(output);

  return {
    nodes: { dry, wet, output, convolver },
    currentDecay: params.decay,
  };
}

function updateReverb(ctx: AudioContext, state: ReverbState, params: ReverbParams): void {
  const { nodes } = state;
  nodes.dry.gain.value = params.enabled ? 1 - params.mix : 1;
  nodes.wet.gain.value = params.enabled ? params.mix : 0;

  if (params.decay !== state.currentDecay) {
    nodes.convolver.buffer = generateImpulseResponse(ctx, params.decay);
    state.currentDecay = params.decay;
  }
}

function generateImpulseResponse(ctx: AudioContext, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * decay);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// Delay
// ---------------------------------------------------------------------------

function createDelayNodes(ctx: AudioContext, params: DelayParams): DelayEffectNodes {
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const output = ctx.createGain();
  const delay = ctx.createDelay(5);
  const feedback = ctx.createGain();

  delay.delayTime.value = params.time;
  feedback.gain.value = Math.min(params.feedback, MAX_FEEDBACK);

  dry.gain.value = params.enabled ? 1 - params.mix : 1;
  wet.gain.value = params.enabled ? params.mix : 0;

  wet.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(output);
  dry.connect(output);

  return { dry, wet, output, delay, feedback };
}

function updateDelay(nodes: DelayEffectNodes, params: DelayParams): void {
  nodes.dry.gain.value = params.enabled ? 1 - params.mix : 1;
  nodes.wet.gain.value = params.enabled ? params.mix : 0;
  nodes.delay.delayTime.value = params.time;
  nodes.feedback.gain.value = Math.min(params.feedback, MAX_FEEDBACK);
}

// ---------------------------------------------------------------------------
// Chorus
// ---------------------------------------------------------------------------

function createChorusNodes(ctx: AudioContext, params: ChorusParams): ChorusNodes {
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const output = ctx.createGain();
  const delay = ctx.createDelay(0.1);
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  delay.delayTime.value = 0.005; // base delay
  lfo.frequency.value = params.rate;
  lfoGain.gain.value = params.depth;

  dry.gain.value = params.enabled ? 1 - params.mix : 1;
  wet.gain.value = params.enabled ? params.mix : 0;

  lfo.connect(lfoGain);
  lfoGain.connect(delay.delayTime);
  wet.connect(delay);
  delay.connect(output);
  dry.connect(output);
  lfo.start();

  return { dry, wet, output, delay, lfo, lfoGain };
}

function updateChorus(nodes: ChorusNodes, params: ChorusParams): void {
  nodes.dry.gain.value = params.enabled ? 1 - params.mix : 1;
  nodes.wet.gain.value = params.enabled ? params.mix : 0;
  nodes.lfo.frequency.value = params.rate;
  nodes.lfoGain.gain.value = params.depth;
}
