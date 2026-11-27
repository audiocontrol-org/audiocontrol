# PRD: LUNA controller maps (map contract 2)

## Problem

A LUNA Add On drives a hardware control surface and maps its controls to plugin parameters.
Two facts shape the data:

- In the surface's fixed-address mode, control addresses do not change. A map therefore
  names controls (`encoder_1_1`) instead of carrying MIDI addresses.
- A host such as the Add On must hold no controller facts. Port names, control addresses,
  wire-protocol message templates, mode reports, feedback values and role bindings are all
  data in this module. The host speaks semantic intent (a control moved, a role fired,
  follow this value, show this label, indicate this state) and interprets the data.

Contract 1 (`CanonicalMidiMap`) describes a MIDI-address-to-parameter mapping and cannot
express any of this. Contract 2 is a new, separate set of documents. Contract 1 behaviour is
unchanged.

## The contract

Three document kinds, all carrying `contract: 2`:

| Document | Purpose |
|----------|---------|
| Surface profile (`kind: surface`) | Device, exact LUNA port names, the control list with addresses, and the protocol: claim, release, mode report, follow, label, announce, indicate message templates. |
| Surface layout (`kind: layout`) | Plugin-independent role bindings (a button press, optionally while another button is held) and feedback values for `{state}`. |
| Controller map | Metadata, the target plugin, and pages of control-to-parameter assignments. |

Message templates are either `{ sysex: "<hex pairs and placeholders>" }` or a CC message.
Placeholders: `{cc}` and `{channel}` (the target control's address), `{value}`
(`round(normalized * 127)`), `{state}` (a feedback value from the layout) and `{text}`
(ASCII bytes). The parser rejects any other placeholder, and rejects a placeholder that
cannot be filled where it is used (for example `{text}` as a CC value).

Types are in `modules/canonical-midi-maps/src/types/contract-2.ts`.

## Parser behaviour

- `parseSurfaceProfile(yaml)`, `parseSurfaceLayout(yaml, surface)` and
  `parseControllerMap(yaml, surface, layout)` return `{ ok: true, value }` or
  `{ ok: false, errors }`. Errors are `path: message` strings with the YAML path.
- A contract other than 2 is rejected: `contract 3 is not supported (supported: 2)`.
- `contractOf(yaml)` returns the top-level `contract`, or `undefined`, so a build can pick a
  parser or refuse.
- Cross-document checks: every referenced control exists in the surface; layout bindings
  (and their `with` control) are buttons; no two controls share a channel and cc; a
  `follows` control requires `protocol.follow`; no two bindings are the same press; feedback
  needs a binding; a map page may not assign a control the layout binds; no two assignments
  to one control on a page; `mode` only on button assignments; `luna_plugin_ids` is not
  empty.

## Non-goals

- No change to contract 1 files, schema or parser.
- No runtime, MIDI or LUNA code here. The Add On consumes these types in a separate
  repository.

## References

- Plan: https://github.com/audiocontrol-org/luna-addons/blob/plan/controller-maps-product/docs/superpowers/plans/2026-11-27-controller-maps-product.md
- Design: https://github.com/audiocontrol-org/luna-addons/blob/main/docs/superpowers/specs/2026-11-26-controller-maps-design.md
- Issue: https://github.com/audiocontrol-org/audiocontrol/issues/475
