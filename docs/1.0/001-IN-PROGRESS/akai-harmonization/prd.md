# Akai Harmonization — Product Requirements Document

**Created:** 2026-05-24
**Status:** Draft
**Owner:** audiocontrol team

## Problem Statement

The audiocontrol editor surfaces for `roland-sxx0-editor` and `akai-s3k-editor` were built at different times against different design conventions and are visibly drifting into one-off prototype aesthetics. As more editors land (jv1080, d110, and beyond), the drift compounds — each new editor risks inventing its own primitives instead of reusing canonical ones already established in `editor-core`.

We need two things at once, and they are sequenced:

1. **A shared design-language contract** so every editor feels like a dialect of the same language. Different colors, fonts, and device-specific iconography are acceptable — but structural primitives, interaction shapes, and chrome must be the same across editors. The contract is captured in a `harmonization-spec.md` produced by a `/frontend-design` audit pass with side-by-side screenshots, and is then enforced by migration commits that reshape the akai and roland surfaces to conform.

2. **Application of the scope-discovery tooling** that drained the roland clone baseline (PR #441, merged 2026-05-22) to the akai surface. The 142 existing akai entries in `docs/scope-discovery/clones.yaml` need to be dispositioned; refactor-marked groups need refactor commits per the protocol's Step 0 (canonical-side + tests-proof) discipline; adopter-manifests, anti-patterns, and the editor-symmetry matrix all need akai registered as a first-class participant.

Phase ordering is load-bearing. Running scope-discovery against the un-harmonized akai surface would produce a baseline that gets invalidated the moment harmonization commits land. Harmonization comes first; scope-discovery comes second.

A cross-cutting Phase 0 captures any bug surfaced during the audit, harmonization, or scope-discovery streams. Bugs are fixed in scope, in their own commits, before the surfacing phase advances — per the project's standing agent-discipline rules ("Just for now is bullshit" + "Drive every effort to completion before starting the next").

## User Stories

- As a future-editor builder (jv1080, d110, sample-editor), I want canonical primitives in `editor-core` plus a documented design-language contract so that building a new editor is a matter of composing existing pieces, not inventing new ones.
- As the operator working across multiple device editors, I want the akai and roland surfaces to look and behave like dialects of the same language, so that muscle memory carries between editors and structural inconsistencies stop eroding trust.
- As an implementer landing a primitive in `editor-core`, I want the harmonization-spec to name the canonical side per primitive so that the `canonical_side` declaration in any subsequent refactor commit is a citation, not an invention in flight.
- As a maintainer drainjng the akai clone baseline, I want the surface to be harmonized first so that the dispositions I write against `clones.yaml` survive the next refresh instead of being invalidated by a structural reshape.
- As a scope-discovery-protocol contributor, I want the akai harmonization pass to dogfood the registries, scanners, and editor-symmetry matrix so that protocol gaps surface as paired feedback issues rather than silently rotting.

## Success Criteria

- [ ] **Design-language contract documented.** `harmonization-spec.md` lists every akai page + every roland page, every primitive each page uses, and one of three dispositions per primitive: (a) `adopt-roland-pattern` in akai, (b) `adopt-akai-pattern` in roland, (c) `genuinely-dialect` (color/font/iconography only).
- [ ] **Akai conforms to the canonical primitives.** Every primitive marked `adopt-roland-pattern` is migrated in `akai-s3k-editor`; every primitive marked `adopt-akai-pattern` is propagated to `roland-sxx0-editor`. `editor-core`'s canonical primitives are extended or themed as needed to support per-editor dialect (color/font tokens) without per-editor code-paths.
- [ ] **Editor-symmetry matrix reflects akai as a first-class participant.** `docs/scope-discovery/editor-symmetry.md` lists `akai-s3k-editor` alongside `roland-sxx0-editor` and shows the post-harmonization parity state. Gaps are either closed in this feature or registered as `tracked_holdouts:` entries in `docs/scope-discovery/adopter-manifests.yaml`.
- [ ] **Akai clone baseline is dispositioned.** Every akai-touching entry in `docs/scope-discovery/clones.yaml` (142 existing entries, refreshed against the post-harmonization tree) has a `disposition` (`refactor` / `keep-with-reason` / `ignore-with-justification`). `refactor`-marked groups are closed by refactor commits with the `Closes clones.yaml <id>` marker + `canonical_side` declaration per the protocol.
- [ ] **Anti-patterns + adopter-manifests backfilled for akai.** Any akai-specific anti-patterns identified during the audit land in `docs/scope-discovery/anti-patterns.yaml`. Akai is added as an adopter (or `tracked_holdouts:` entry) in every relevant adopter manifest.
- [ ] **All gates green at every commit.** `make check-css-duplication`, `make check-clone-duplication`, `make check-chevron-sizing`, `make check-anti-patterns`, `make check-adopters`, `make check-editor-symmetry`, plus `pnpm test:scope-discovery`. Controller independently re-runs the load-bearing test gate after every implementer dispatch.

## Scope

### In Scope

- `modules/akai-s3k-editor` — primary write target. Conforms to canonical primitives where the spec says `adopt-roland-pattern`. Source of canonical patterns where the spec says `adopt-akai-pattern`.
- `modules/roland-sxx0-editor` — secondary write target where the akai surface holds the better canonical, or where roland is also drifting and needs the same fix.
- `modules/editor-core` — canonical primitives plus per-editor theme/dialect tokens (CSS custom properties keyed off a root-level class or data-attribute) for color/font/iconography variance.
- `docs/scope-discovery/` — `clones.yaml` dispositions for the 142 akai-touching groups, `adopter-manifests.yaml` backfill for akai, `anti-patterns.yaml` additions, `editor-symmetry.md` extension to include akai.
- A rolling bug-fix table for any bug surfaced by the audit, the harmonization, or the scope-discovery passes. One bug per commit; no sweep refactors.

### Out of Scope

- **`jv1080-editor` harmonization.** The jv1080 editor exists but is not modified in this feature. It will consume the canonical design-language contract when its own harmonization feature lands.
- **`d110-editor`, sample-editor, and any other future editors.** Same logic — they consume the contract established here when they are built or migrated; no work happens to them in this feature.
- **Hardware-protocol or device-communication work.** Akai's SCSI / MIDI / SDS layers are untouched. This feature is editor-UI scope only.
- **The akai-s3000xl-specific device-memory model.** Any harmonization that would require changing the akai device-memory or library data models is out of scope — only the UI presentation layer is in scope. If a harmonization step requires data-model work, it is filed as a follow-up and the UI conforms to the existing model.
- **`modules/launch-control-xl3`.** Out of scope; an uncommitted `CLAUDE.md` edit there is unrelated and should be committed or stashed before branching.

## Dependencies

- **`scope-discovery-protocol`** (merged via PR #454, 2026-05-22). Gates, registries, scanners, and the validator suite are all in place. The clone detector, adopter-manifest scanner, anti-pattern registry, and editor-symmetry matrix tooling all assume the protocol has shipped.
- **`roland-sxx0-editor` post-roland-bugfix-merge state** (PR #456, 2026-05-23). The v3 chrome (SlideDrawer, PageTitleRow, AcChevron, SteppedProgressDrawer, AcRadioTabs, BankHeader, SlotInfo, useExportDialogLifecycle, useStepHistory, etc.) is the current canonical baseline. The harmonization audit starts from this state.
- **`editor-core`'s existing shared primitives.** SlideDrawer, PageTitleRow, AcChevron, useExportDialogLifecycle, useStepHistory, etc. — these are the primitives akai needs to adopt. Adopter-manifests already exists for most of them; akai joins as an adopter (or registered `tracked_holdouts:` entry) per the protocol.

## Open Questions

- [ ] **Akai test-harness coverage.** The Phase 1 `/frontend-design` audit will be slower if many akai pages lack a test-harness route. The Phase 1 task list opens with an inventory of `src/pages/Test*Page.tsx` (or equivalent) under `modules/akai-s3k-editor/`. If coverage is thin, harness-page creation becomes a Phase 1 sub-task.
- [ ] **Theme-token infrastructure.** Does `editor-core` already expose per-editor theme/dialect tokens (CSS custom properties keyed off a root-level class or data-attribute), or does that abstraction need to be introduced during Phase 2? Either way the answer determines how much editor-core scaffolding work Phase 2 includes.
- [ ] **Editor-symmetry matrix participant model.** `editor-symmetry.md` is currently shaped around roland surfaces. Does it cleanly extend to a roland-vs-akai view, or does the matrix renderer (`tools/scope-discovery/editor-symmetry.ts` or equivalent) need extension? If yes, that is a scope-discovery-protocol tooling task surfaced by this feature (dogfooding-feedback loop).
- [ ] **Live editing in akai.** Per the live-editing convention established for roland S-330 / S-550 (parameter edits stream live to device — no save/cancel/undo), does `akai-s3k-editor` follow the same model, or does it have a save/cancel pattern that is actually correct for its device's UX? The audit needs to surface this and the harmonization-spec entry needs to disposition it explicitly.
- [ ] **Plugin-library-browser parity.** Akai has a `PluginLibraryBrowser` shape per the existing test failure issue (#406). The 4-zone storage model in `SAMPLER-LIBRARY.md` is supposed to be cross-editor. Does the akai library UX match roland's, or are they drifting? This is the highest-value cross-editor parity check the audit needs to resolve.

## Appendix

### References

- [Workplan](./workplan.md) — phase breakdown, bug triage table, per-phase acceptance gates.
- [Scope-discovery README](/docs/scope-discovery/README.md) — registries, gate vocabulary, refactor preconditions (Step 0).
- [Scope-discovery LAYOUT](/docs/scope-discovery/LAYOUT.md) — on-disk contract for inventory artifacts.
- [Roland-bugfix feature](/docs/1.0/001-IN-PROGRESS/roland-bugfix/) — sibling feature; the harmonization is structured as a deliberate sibling to that work.
