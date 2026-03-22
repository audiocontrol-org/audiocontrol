import { describe, it, expect } from 'vitest';
import { createVoiceAllocator } from '@/voice/create-voice-allocator';
import { createMockOscillatorFactory } from '@/testing/mock-oscillator-factory';

function setup(config?: { maxPolyphony?: number; retrigger?: boolean }) {
  const { impl: factory, controls } = createMockOscillatorFactory();
  const allocator = createVoiceAllocator(factory, config);
  return { allocator, controls };
}

describe('createVoiceAllocator', () => {
  it('creates an oscillator on noteOn', () => {
    const { allocator, controls } = setup();
    allocator.noteOn(60, 100);

    expect(controls.getActiveOscillators()).toHaveLength(1);
    expect(controls.getActiveOscillators()[0]?.note).toBe(60);
    expect(allocator.getActiveNotes()).toEqual(new Set([60]));
  });

  it('supports polyphonic playback', () => {
    const { allocator, controls } = setup();
    allocator.noteOn(60, 100);
    allocator.noteOn(64, 100);
    allocator.noteOn(67, 100);

    expect(controls.getActiveOscillators()).toHaveLength(3);
    expect(allocator.getActiveNotes()).toEqual(new Set([60, 64, 67]));
  });

  it('stops oscillator on noteOff', () => {
    const { allocator, controls } = setup();
    allocator.noteOn(60, 100);
    allocator.noteOff(60);

    expect(controls.getActiveOscillators()).toHaveLength(0);
    expect(allocator.getActiveNotes()).toEqual(new Set());

    const created = controls.getCreatedOscillators();
    expect(created[0]?.stopCalls).toHaveLength(1);
    expect(created[0]?.stopCalls[0]?.fadeTimeSec).toBe(0.02);
  });

  it('ignores noteOff for notes not playing', () => {
    const { allocator, controls } = setup();
    allocator.noteOff(60);
    expect(controls.getCreatedOscillators()).toHaveLength(0);
  });

  it('retriggers same note by default', () => {
    const { allocator, controls } = setup();
    allocator.noteOn(60, 100);
    allocator.noteOn(60, 80);

    const created = controls.getCreatedOscillators();
    expect(created).toHaveLength(2);
    expect(created[0]?.stopCalls).toHaveLength(1);
    expect(created[0]?.stopCalls[0]?.fadeTimeSec).toBe(0.005);
    expect(controls.getActiveOscillators()).toHaveLength(1);
    expect(allocator.getActiveNotes()).toEqual(new Set([60]));
  });

  it('does not retrigger when retrigger is disabled', () => {
    const { allocator, controls } = setup({ retrigger: false });
    allocator.noteOn(60, 100);
    allocator.noteOn(60, 80);

    const created = controls.getCreatedOscillators();
    expect(created).toHaveLength(2);
    // First oscillator was not explicitly stopped by retrigger,
    // but was stolen by the new note for the same key
    expect(allocator.getActiveNotes()).toEqual(new Set([60]));
  });

  it('steals oldest voice when polyphony limit is reached', () => {
    const { allocator, controls } = setup({ maxPolyphony: 2 });
    allocator.noteOn(60, 100);
    allocator.noteOn(64, 100);
    allocator.noteOn(67, 100);

    expect(controls.getActiveOscillators()).toHaveLength(2);
    expect(allocator.getActiveNotes()).toEqual(new Set([64, 67]));

    const created = controls.getCreatedOscillators();
    expect(created[0]?.stopCalls).toHaveLength(1);
  });

  it('stopAll stops all voices', () => {
    const { allocator, controls } = setup();
    allocator.noteOn(60, 100);
    allocator.noteOn(64, 100);
    allocator.noteOn(67, 100);
    allocator.stopAll();

    expect(controls.getActiveOscillators()).toHaveLength(0);
    expect(allocator.getActiveNotes()).toEqual(new Set());

    for (const osc of controls.getCreatedOscillators()) {
      expect(osc.stopCalls).toHaveLength(1);
      expect(osc.stopCalls[0]?.fadeTimeSec).toBe(0.01);
    }
  });

  it('dispose stops all voices', () => {
    const { allocator, controls } = setup();
    allocator.noteOn(60, 100);
    allocator.noteOn(64, 100);
    allocator.dispose();

    expect(controls.getActiveOscillators()).toHaveLength(0);
  });
});
