/**
 * Tooltip descriptions for S-330 tone parameters
 */

export const TONE_TOOLTIPS = {
  // Basic Info
  originalKey:
    'The MIDI note at which the sample plays at its original pitch. ' +
    'Notes above or below this will be pitch-shifted accordingly.',

  sampleRate:
    'The sample rate at which this tone was recorded (15kHz or 30kHz). ' +
    '30kHz provides higher fidelity but uses more memory.',

  loopMode:
    'How the sample loops during playback. Forward: loops from loop point to end. ' +
    'Alternating: bounces back and forth. One-Shot: plays once, no loop. ' +
    'Reverse: plays backwards.',

  outputAssign:
    'Audio output routing for this tone. Mix sends to the main stereo output. ' +
    'Out 1-8 sends to individual outputs.',

  // Wave Memory
  waveBank:
    'Which wave bank the sample lives in. S-330: A or B. S-550: A through D. ' +
    'Changing this re-points the tone to a different memory region.',

  waveSegmentTop:
    'Index of the first wave-memory segment used by this tone. 0-17.',

  waveSegmentLength:
    'Number of consecutive wave-memory segments this tone occupies. 0-18.',

  // Wave Points
  waveStart:
    'Sample start point in memory. The sample plays from this address.',

  waveLoop:
    'Loop point address. When looping, playback jumps back here from the end point.',

  waveEnd:
    'Sample end point. Playback stops or loops back when reaching this address.',

  loopTune:
    'Fine-tune offset applied to the loop region. ' +
    'Signed value; negative pitches the loop down.',

  // TVF (Filter)
  tvfEnabled:
    'Enable or bypass the time-variant filter. When off, the filter section is bypassed entirely.',

  tvfCutoff:
    'Filter cutoff frequency. Higher values let more high frequencies through.',

  tvfResonance:
    'Filter resonance (Q). Emphasizes frequencies around the cutoff point. ' +
    'High values create a sharp, ringing quality.',

  tvfKeyFollow:
    'How much the cutoff frequency tracks keyboard pitch. ' +
    'Higher values raise the cutoff for higher notes.',

  tvfLfoDepth:
    'Amount of LFO modulation applied to the filter cutoff. ' +
    'Creates wah-wah or sweep effects.',

  tvfEgDepth:
    'Amount of envelope modulation applied to the filter cutoff. ' +
    'Positive values sweep up, negative sweep down.',

  tvfKeyRate:
    'How much keyboard position affects envelope speed. ' +
    'Higher notes can have faster filter envelopes.',

  tvfVelRate:
    'How much velocity affects envelope speed. ' +
    'Harder hits can trigger faster filter envelopes.',

  tvfEgPolarity:
    'Envelope direction. Normal sweeps toward the EG depth setting. ' +
    'Reverse inverts the envelope shape.',

  tvfLevelCurve:
    'Velocity response curve for the filter. Affects how velocity maps to filter depth.',

  // LFO
  lfoRate:
    'LFO speed. Controls how fast the LFO oscillates for vibrato, tremolo, and filter wobble.',

  lfoDelay:
    'Time before LFO modulation begins after a note is played. ' +
    'Useful for delayed vibrato effects.',

  lfoOffset:
    'Starting phase offset of the LFO waveform.',

  lfoSync:
    'Key sync. When enabled, the LFO restarts from the beginning with each new note.',

  lfoMode:
    'LFO behavior. Normal: continuous oscillation. One-Shot: single sweep then stop.',

  lfoPeakHold:
    'Peak hold mode. When enabled, the LFO holds at peak values instead of smoothly oscillating.',

  // Pitch
  transpose:
    'Coarse pitch adjustment in semitones. Shifts the entire tone up or down.',

  fineTune:
    'Fine pitch adjustment in cents (1/100 semitone). Use for subtle tuning corrections.',

  pitchFollow:
    'Pitch keyboard tracking. When enabled, higher keys play higher pitches. ' +
    'Disable for drum sounds that should play at constant pitch.',

  benderEnabled:
    'Enable pitch bend wheel control for this tone.',

  aftertouchEnabled:
    'Enable aftertouch (pressure) response for this tone.',

  // TVA (Amplifier)
  tvaLevel:
    'Tone output volume. The main level control for this tone.',

  tvaLfoDepth:
    'Amount of LFO modulation applied to amplitude. Creates tremolo effect.',

  tvaKeyRate:
    'How much keyboard position affects envelope speed. ' +
    'Higher notes can have faster amplitude envelopes.',

  tvaVelRate:
    'How much velocity affects envelope speed. ' +
    'Harder hits can trigger faster amplitude envelopes.',

  tvaLevelCurve:
    'Velocity response curve for amplitude. Affects how velocity maps to volume.',

  envZoom:
    'Envelope display zoom level on the device\'s CRT. ' +
    '0 = fully zoomed out, 7 = maximum detail. Stored per-tone.',

  // Envelopes
  tvaEnvelope:
    '8-point amplitude envelope. Controls how volume changes over the life of a note. ' +
    'Drag points to adjust levels, drag horizontally for rates.',

  tvfEnvelope:
    '8-point filter envelope. Controls how the filter cutoff changes over time. ' +
    'Drag points to adjust levels, drag horizontally for rates.',

  sustainPoint:
    'The envelope holds at this point while the note is held. ' +
    'After release, the envelope continues from here to the end point.',

  endPoint:
    'The envelope stops at this point. Points beyond the end point are not used. ' +
    'Must be greater than the sustain point.',
} as const;
