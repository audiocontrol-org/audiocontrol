import type { AcDisclosureTheme } from '@audiocontrol/editor-core';

/**
 * Shared `AcDisclosure` theme bags for the Tones FILTER/AMP tabs.
 *
 * The v2 filter-tab compaction (design SSOT
 * `docs/1.0/001-IN-PROGRESS/roland-bugfix/explorations/04-tones-v2.html`)
 * uses two disclosure presentations:
 *   - SECTION: a titled, open-by-default section collapsible
 *     (`.tones__section--collapsible`).
 *   - TWEAK: a collapsed-by-default pill that hides the numeric
 *     back-channel beneath a graphical editor (`.tones__tweak`).
 *
 * Both live here so `ToneFilterPanel` (section + tweak) and
 * `ToneEnvelopeEditor` (tweak) reference one source of truth — no
 * duplicated theme literals across the two files.
 */

export const TONES_SECTION_DISCLOSURE_THEME: AcDisclosureTheme = {
  container: 'tones__section--collapsible',
  headerButton: 'tones__section-head--summary',
  title: 'tones__section-title',
  icon: 'tones__section-collapsible-marker',
  body: 'tones__section-body',
};

export const TONES_TWEAK_DISCLOSURE_THEME: AcDisclosureTheme = {
  container: 'tones__tweak',
  headerButton: 'tones__tweak-summary',
  labelGroup: 'tones__tweak-label-group',
  title: 'tones__tweak-label',
  hint: 'tones__tweak-hint',
  icon: 'tones__tweak-marker',
  body: 'tones__tweak-body',
};
