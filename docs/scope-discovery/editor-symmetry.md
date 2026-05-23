# Cross-editor symmetry matrix

Rows are adoption conventions declared in `docs/scope-discovery/adopter-manifests.yaml`; columns are editor modules under `modules/*-editor/`. Cells show adoption status: `✓ N/N` = all files in the editor matching the manifest glob import the canonical path; `⚠ A/E (H holdout(s))` = partial adoption with `H` files holding out; `✗` = the editor was targeted by the glob but has zero matched files or zero adopters; `—` = the manifest does not target this editor (n/a).

No adopter-manifest entries are registered yet; the matrix is empty.

Each refactor commit that PROMOTES a primitive to a shared location SHOULD append an entry to `docs/scope-discovery/adopter-manifests.yaml`. `make check-editor-symmetry-write` rewrites this file from the registry.

