/**
 * Tooltip descriptions for S-330 tone mapping controls
 */

export const TONE_MAPPING_TOOLTIPS = {
  layer1:
    'Layer 1 defines which tone plays for each MIDI key. ' +
    'In Normal mode, only Layer 1 is used. In dual-layer modes (V-Sw, X-Fade, V-Mix, Unison), ' +
    'Layer 1 is the primary layer.',

  layer2:
    'Layer 2 is the secondary tone layer, used in dual-layer key modes. ' +
    'V-Sw: plays when velocity exceeds threshold. X-Fade: crossfades with Layer 1. ' +
    'V-Mix: mixed based on velocity. Unison: plays with Layer 1 detuned.',

  addZone:
    'Create a new tone zone. A zone maps a range of MIDI keys to a single tone.',

  zone:
    'Click to edit this zone. Each zone assigns a contiguous range of keys to one tone.',

  toneSelector:
    'Select which tone (T11-T42) plays in this key range. ' +
    'Layer 1 can also be set to OFF to leave keys silent.',

  startKey:
    'The lowest MIDI note in this zone. Use the dropdown or click Learn to set via MIDI input.',

  endKey:
    'The highest MIDI note in this zone. Use the dropdown or click Learn to set via MIDI input.',

  learnButton:
    'Click to learn from MIDI input. Play a note on your keyboard to set this key.',

  deleteZone:
    'Remove this zone. The keys will become unassigned (OFF for Layer 1, or tone 0 for Layer 2).',
} as const;
