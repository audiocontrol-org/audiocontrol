/**
 * E2E test fixture page for the loop editor with synth-core integration.
 *
 * Renders LoopEditorDialog with generated test signals and keyboard
 * note input (no MIDI hardware required). Only used for Playwright E2E tests.
 *
 * URL params:
 *   ?signal=<name>  — selects the test signal (default: sustain)
 *
 * Available signals: sustain, leading-silence, trailing-silence,
 *   constant-decay, decay-into-sustain, sustain-trailing-decay
 *
 * Route: /test/loop-editor
 */

import { useState, useEffect, useMemo } from 'react';
import { LoopEditorDialog } from '@/components/library/LoopEditorDialog';
import { createKeyboardNoteInput } from '@audiocontrol/synth-core';
import type { NoteInput } from '@audiocontrol/synth-core';

// ---------------------------------------------------------------------------
// Test signal generators (inlined to avoid build coupling)
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 30000;

function tone(i: number, amplitude: number): number {
  const t = i / SAMPLE_RATE;
  const f = Math.sin(2 * Math.PI * 440 * t);
  const h2 = 0.5 * Math.sin(2 * Math.PI * 880 * t);
  const h3 = 0.25 * Math.sin(2 * Math.PI * 1320 * t);
  return (f + h2 + h3) * amplitude * 0.6;
}

const SIGNAL_GENERATORS: Record<string, () => Int16Array> = {
  'sustain': () => {
    const buf = new Int16Array(SAMPLE_RATE * 2);
    for (let i = 0; i < buf.length; i++) buf[i] = Math.round(tone(i, 0.8) * 32767);
    return buf;
  },
  'leading-silence': () => {
    const silence = Math.round(SAMPLE_RATE * 0.3);
    const buf = new Int16Array(SAMPLE_RATE * 2);
    for (let i = silence; i < buf.length; i++) {
      const fadeIn = Math.min(1, (i - silence) / (SAMPLE_RATE * 0.005));
      buf[i] = Math.round(tone(i, fadeIn) * 32767);
    }
    return buf;
  },
  'trailing-silence': () => {
    const toneLen = Math.round(SAMPLE_RATE * 1.5);
    const buf = new Int16Array(SAMPLE_RATE * 2);
    for (let i = 0; i < toneLen; i++) {
      const fadeOut = Math.min(1, (toneLen - i) / (SAMPLE_RATE * 0.005));
      buf[i] = Math.round(tone(i, fadeOut) * 32767);
    }
    return buf;
  },
  'constant-decay': () => {
    const buf = new Int16Array(SAMPLE_RATE * 2);
    const tau = buf.length / Math.log(1000);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = Math.round(tone(i, Math.exp(-i / tau)) * 32767);
    }
    return buf;
  },
  'decay-into-sustain': () => {
    const attack = Math.round(SAMPLE_RATE * 0.01);
    const decay = Math.round(SAMPLE_RATE * 0.19);
    const buf = new Int16Array(SAMPLE_RATE * 2);
    for (let i = 0; i < buf.length; i++) {
      let env: number;
      if (i < attack) env = i / attack;
      else if (i < attack + decay) env = 0.6 + 0.4 * Math.exp(-((i - attack) / decay) * 5);
      else env = 0.6;
      buf[i] = Math.round(tone(i, env) * 32767);
    }
    return buf;
  },
  'sustain-trailing-decay': () => {
    const sustainLen = Math.round(SAMPLE_RATE * 1.5);
    const decayLen = Math.round(SAMPLE_RATE * 0.5);
    const buf = new Int16Array(sustainLen + decayLen);
    for (let i = 0; i < buf.length; i++) {
      const env = i < sustainLen ? 0.8 : 0.8 * Math.exp(-((i - sustainLen) / decayLen) * 5);
      buf[i] = Math.round(tone(i, env) * 32767);
    }
    return buf;
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ROOT_KEY = 60;

export function LoopEditorTestPage() {
  const [open, setOpen] = useState(true);

  const signalName = new URLSearchParams(window.location.search).get('signal') ?? 'sustain';
  const samples = useMemo(() => {
    const gen = SIGNAL_GENERATORS[signalName] ?? SIGNAL_GENERATORS['sustain']!;
    return gen();
  }, [signalName]);

  const [keyboardInput, setKeyboardInput] = useState<NoteInput | null>(null);
  useEffect(() => {
    const input = createKeyboardNoteInput(ROOT_KEY);
    setKeyboardInput(input);
    return () => input.dispose();
  }, []);

  return (
    <div data-testid="loop-editor-test-page">
      <p data-testid="keyboard-input-status">
        Keyboard input: {keyboardInput ? 'active' : 'initializing'}
      </p>
      <p data-testid="signal-name">{signalName}</p>
      {!open && (
        <button data-testid="reopen-dialog" onClick={() => setOpen(true)}>
          Reopen Dialog
        </button>
      )}
      <LoopEditorDialog
        open={open}
        onOpenChange={setOpen}
        samples={samples}
        sampleRate={SAMPLE_RATE}
        sampleName={`Test: ${signalName}`}
        loopStart={Math.round(SAMPLE_RATE * 0.3)}
        loopEnd={Math.round(SAMPLE_RATE * 1.5)}
        rootKey={ROOT_KEY}
        noteInput={keyboardInput}
      />
    </div>
  );
}
