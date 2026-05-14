# synthesize-tone-fixture

Regenerate (or initialize) the outbound `sendToneData` byte sequence for a
tone-write fixture by replaying an on-disk prelude and applying the
canonical encoder.

## Why this script exists

The tone-write fixtures under `test/fixtures/{s330,s550}/` capture a full
round-trip: a TonesPage mount (RQD + 8 tones loaded back) followed by a
single `sendToneData(0, mutate(tone0))` writeback. The prelude is
device-dependent (the bytes the device sends back during load); the
writeback is pure encoder output (deterministic given the mutated tone).
When the codec changes — e.g., the `#408` Phase A dedup of `tvaLfoDepth`
/ `tva.lfoDepth` — the prelude stays valid but the writeback bytes drift,
and a literal hardware re-record is overkill.

## Modes

- **regen** (default): rewrite an EXISTING fixture's writeback in place
  using the current encoder plus the scenario mutation. Prelude stays
  verbatim. Used when a codec change drifts the writeback bytes.

- **init** (`--init --from-base <suffix>`): create a NEW fixture under
  `<fixturesDir>/<device>/tone-0-<scenario>.ndjson` by copying the prelude
  from the base fixture (`tone-0-<from-base>.ndjson` in the same device
  subdir) and synthesizing the writeback from the scenario's mutation.
  Used when adding a new scenario (e.g. `#408` Phase B adding 5 new
  affordance fixtures) without re-recording against hardware. The base
  fixture's prelude is reused because all tone-write fixtures share the
  same TonesPage mount sequence — only the writeback bytes differ per
  scenario.

Both modes replay the prelude in-memory, apply the same scenario-specific
mutation that a fresh hardware capture would have applied, encode via the
canonical S330/S550 `encodeTone`, and write the outbound portions of the
writeback block. The result is byte-identical to what a fresh hardware
recording would produce because:

1. The prelude (loadToneRange responses) is preserved verbatim from the
   base / target fixture.
2. The mutation is shared (`TONE_WRITE_SCENARIOS` is imported, not
   duplicated).
3. The encoder is the same `encodeTone` the production client calls.
4. The framing — WSD/DAT/EOD with sized nibbles + DAT chunk-address
   stride — mirrors `sendDataAttempt` in `s-series-client.ts` (the only
   authoritative implementation).

## When synthesis is appropriate

- The prelude is already on disk (either in the target fixture for regen,
  or in a sibling base fixture for init).
- The codec (or the `mutate` function) is the only thing that changed.
- The new scenario's mutation only changes tone-payload bytes (no
  device-side state mutation that would alter subsequent prelude
  responses on a fresh capture).

## When synthesis is NOT appropriate

- The device's response sequence (prelude) needs to change. The prelude
  bytes are not derivable without hardware — capture a fresh fixture via
  the recording infra instead.
- The fixture transitions between scenarios that materially change device
  state. Synthesis assumes the prelude is for the SAME tone index and
  that `mutate(prelude_tone_0)` is what was originally sent.

## Determinism contract

Given an unchanged on-disk prelude (either the target fixture's own or
the base fixture in `--init` mode) AND an unchanged `TONE_WRITE_SCENARIOS`
entry for the scenario AND an unchanged `encodeTone`, this tool produces
byte-identical output across runs. If `--check` reports a diff after no
source changes, that is a bug in this script, the scenarios array, or
the encoder.

## CLI

```
tsx scripts/synthesize-tone-fixture.ts \
  --scenario <suffix>       \   # e.g., 'tva-lfo-depth'
  --device   <s330|s550>    \   # subdirectory under <fixtures-dir> for path lookup;
                                #   default: s330. Device-specific limits are derived
                                #   from the fixture header regardless of this flag.
  --fixtures-dir <path>     \   # required; root containing s330/ and s550/ scenario
                                #   subdirs (e.g. test/fixtures)
  [--init --from-base <suffix>] # create a NEW fixture under <device>/tone-0-<scenario>
                                #   .ndjson by copying the prelude from <device>/
                                #   tone-0-<from-base>.ndjson. The new fixture's header
                                #   inherits device + deviceId from the base; only
                                #   `name`, `description`, and `capturedAt` are
                                #   updated. Required together with --init.
  [--check]                     # exit non-zero if regenerated != on-disk
                                #   (not compatible with --init — there is nothing on
                                #   disk to diff against on first creation)
```

## Exit codes

- `0` — success (file written, or `--check` found no diff)
- `1` — diff detected in `--check` mode, or invocation/runtime error
