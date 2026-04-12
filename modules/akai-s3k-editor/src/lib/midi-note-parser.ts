/**
 * MIDI note name/number conversion.
 *
 * Re-exports canonical implementations from @audiocontrol/editor-core.
 * The formatMidiNote name is kept for backward compatibility with
 * existing consumers in this module.
 *
 * @packageDocumentation
 */

export { parseMidiNote } from '@audiocontrol/editor-core';
export { midiNoteToName as formatMidiNote } from '@audiocontrol/editor-core';
