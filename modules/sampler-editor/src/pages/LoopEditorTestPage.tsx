/**
 * E2E test fixture page for the loop editor with synth-core integration.
 *
 * Renders LoopEditorDialog with a generated sine wave sample and keyboard
 * note input (no MIDI hardware required). Only used for Playwright E2E tests.
 *
 * Route: /test/loop-editor
 */

import { useState, useEffect, useMemo } from 'react';
import { LoopEditorDialog } from '@/components/library/LoopEditorDialog';
import { createKeyboardNoteInput } from '@audiocontrol/synth-core';
import type { NoteInput } from '@audiocontrol/synth-core';

function generateTestSineWave(frequency: number, sampleRate: number, durationSec: number): Int16Array {
  const length = Math.round(sampleRate * durationSec);
  const buffer = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.round(Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 32767);
  }
  return buffer;
}

const SAMPLE_RATE = 44100;
const ROOT_KEY = 60; // C4

export function LoopEditorTestPage() {
  const [open, setOpen] = useState(true);
  const samples = useMemo(() => generateTestSineWave(261.63, SAMPLE_RATE, 2.0), []);

  const [keyboardInput, setKeyboardInput] = useState<NoteInput | null>(null);
  useEffect(() => {
    const input = createKeyboardNoteInput(ROOT_KEY);
    setKeyboardInput(input);
    return () => input.dispose();
  }, []);

  return (
    <div data-testid="loop-editor-test-page">
      <h1>Loop Editor E2E Test Fixture</h1>
      <p data-testid="keyboard-input-status">
        Keyboard input: {keyboardInput ? 'active' : 'initializing'}
      </p>
      {!open && (
        <button
          data-testid="reopen-dialog"
          onClick={() => setOpen(true)}
        >
          Reopen Dialog
        </button>
      )}
      <LoopEditorDialog
        open={open}
        onOpenChange={setOpen}
        samples={samples}
        sampleRate={SAMPLE_RATE}
        sampleName="E2E Test Sine (C4)"
        loopStart={4410}
        loopEnd={88200}
        rootKey={ROOT_KEY}
        noteInput={keyboardInput}
        onSave={(loopStart, loopEnd) => {
          const el = document.getElementById('save-result');
          if (el) el.textContent = JSON.stringify({ loopStart, loopEnd });
        }}
      />
      <div id="save-result" data-testid="save-result" />
    </div>
  );
}
