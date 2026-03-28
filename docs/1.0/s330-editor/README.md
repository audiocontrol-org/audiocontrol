# S-330 Editor

**Status:** ARCHIVED — Superseded by [s550-support](../s550-support/)
**Updated:** 2026-03-28

---

## Archive Notice

This feature was never implemented. The work described in the PRD was superseded by the **s550-support** feature, which introduced a unified S-series editor architecture with device config registry.

### Why Archived

1. **Never Started** - No code was written for this feature
2. **Architecture Evolution** - The unified `roland-sxx0-editor` approach is superior to per-device modules
3. **S-550 Support Includes S-330** - The unified editor already supports both S-330 and S-550

### What to Use Instead

See [s550-support](../s550-support/) for the implemented unified editor that supports:
- Roland S-330
- Roland S-550
- Future S-series devices via config registry

The unified editor is located at `modules/roland-sxx0-editor/`.

---

## Original Scope (Not Implemented)

The original PRD proposed porting Virtual Front Panel work from ol_dsp repository:

- Port 5 phases of VFP implementation
- Port hardware parameter listener
- Port useFrontPanel React hook
- Progressive loading with progress bar

None of this work was completed. The unified editor approach in s550-support achieved the same goals with a better architecture.

---

## Documentation

These documents describe the original (unimplemented) plan:

- [PRD](./prd.md) - Original requirements (not implemented)
- [Workplan](./workplan.md) - Original phases (not implemented)
- [Implementation Summary](./implementation-summary.md) - Template only
