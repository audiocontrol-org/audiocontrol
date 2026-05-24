# Cross-editor symmetry matrix

Rows are adoption conventions declared in `docs/scope-discovery/adopter-manifests.yaml`; columns are editor modules under `modules/*-editor/`. Cells show adoption status: `✓ N/N` = all files in the editor matching the manifest glob import the canonical path; `⚠ A/E (H holdout(s))` = partial adoption with `H` files holding out; `✗` = the editor was targeted by the glob but has zero matched files or zero adopters; `⏳ A/E (T tracked)` = adopter set has only tracked-holdouts (deferred-but-known migrations, each with a `tracked_holdouts:` entry naming the follow-up issue; gate-passing, NOT masked as ✓); `—` = the manifest does not target this editor (n/a).

| Convention | akai-s3k-editor | d110-editor | jv1080-editor | launch-control-xl3-editor | loop-editor | roland-sxx0-editor | sample-editor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| page-title-row (`@audiocontrol/editor-core`) | ✓ 4/4 | — | — | — | — | ✓ 5/5 | — |
| use-export-dialog-lifecycle (`@/hooks/useExportDialogLifecycle`) | — | — | — | — | — | ✓ 3/3 | — |
| bank-header (`@/components/common/BankHeader`) | — | — | — | — | — | ✓ 3/3 | — |
| slot-info (`@/components/common/SlotInfo`) | — | — | — | — | — | ✓ 2/2 | — |
| ac-radio-tabs (`@/components/common/AcRadioTabs`) | — | — | — | — | — | ✓ 2/2 | — |
| destination-eyebrow (`@/components/library/DestinationEyebrow`) | — | — | — | — | — | ✓ 3/3 | — |
| library-device-memory-panel-adapter (`@/plugins/shared/LibraryDeviceMemoryPanel`) | — | — | — | — | — | ✓ 2/2 | — |
| library-preview-panel-adapter (`@/plugins/shared/LibraryPreviewPanelAdapter`) | — | — | — | — | — | ✓ 2/2 | — |
| slide-drawer-library-dialogs (`@audiocontrol/editor-core`) | ✓ 9/9 | — | — | — | — | ✓ 6/6 | — |

