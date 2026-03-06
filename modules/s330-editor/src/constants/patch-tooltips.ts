/**
 * Tooltip descriptions for S-330 patch parameters
 */

export const PATCH_TOOLTIPS = {
  keyMode:
    'Determines how the two tone layers interact. ' +
    'Normal: Single layer. V-Sw: Velocity switches between layers. ' +
    'X-Fade: Crossfade based on velocity. V-Mix: Velocity controls layer mix. ' +
    'Unison: Both layers play together with detune.',

  keyAssign:
    'Voice allocation mode. Rotary: Cycles through available voices for each new note. ' +
    'Fix: Always uses the same voice for the same key (better for monophonic lines).',

  benderRange:
    'Pitch bend range in semitones. Sets how far the pitch bends when the wheel is fully deflected.',

  aftertouchAssign:
    'What parameter aftertouch (channel pressure) controls. ' +
    'Modulation: LFO depth. Volume: Output level. ' +
    'Bend+/Bend-: Pitch up or down. Filter: TVF cutoff.',

  aftertouchSens:
    'Aftertouch sensitivity. Higher values make the assigned parameter respond more strongly to pressure.',

  octaveShift:
    'Shifts all notes up or down by octaves (-2 to +2).',

  outputAssign:
    'Audio output routing. Out 1-8 sends to individual outputs. ' +
    'TONE uses each tone\'s individual output assignment.',

  level:
    'Patch output volume (0-127). This is the main volume control for the patch.',

  detune:
    'Unison detune amount. Only active in Unison key mode. ' +
    'Creates a thicker sound by slightly detuning the second layer.',

  velocityThreshold:
    'Velocity switch point. Only active in V-Sw key mode. ' +
    'Notes below this velocity play layer 1, above play layer 2.',

  velocityMixRatio:
    'Velocity mix balance. Only active in V-Mix key mode. ' +
    'Controls how velocity affects the balance between the two layers.',
} as const;
