# akai-ux-improvement

Restructure the Akai S3000XL editor from memory-oriented pages to workflow-oriented editing with full CRUD, zone mapping, and visual polish.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Audit and Plan | Complete | See [phase1-audit.md](./phase1-audit.md) |
| Phase 2: Program Editor Workflow | Complete | Dense grid layout, CRUD on list items |
| Phase 3: Keygroup and Zone Mapping | Complete | Interactive envelope editors, zone overview |
| Phase 4: Multi-Editor | Complete | Extraction deferred until Roland needs it |
| Phase 5: Visual Polish | Complete | Design system, responsive header, accessibility |
| Phase 6: Memory Browser CRUD Parity | Complete | |
| Phase 7: Memory-to-Library Drag & Drop | Complete | |
| Phase 8: Library Promotion Fix | Complete | Promotion verified via e2e tests |
| Phase 9: Sample Editor | Complete | List-detail layout, dense grid, 20 unit tests |
| Phase 10: Remove Compare Page | Complete | |
| Phase 11: Persistent Editor Cache | Complete | zustand persist + sessionStorage, CacheAge indicator |
| Phase 12: Program Download Fix | Complete | Expandable programs + atomic sample rename |
| Phase 13: Sample Clone | Complete | cloneSample via SDS, UI in both SamplesPage and DeviceMemoryPanel |
| Phase 14: Device Sample Loading | Complete | Strategy-based SDS loading, action bar in SamplesPage |
| Phase 15: Save to Device | Complete | SaveTargetDialog, device overwrite/new, loop header-only save |
| Phase 16: Bidirectional Library | Complete | SaveTargetDialog, chopper→device, library send-to-device |
| Phase 17: Audio Editing E2E Tests | Complete | 3 Playwright e2e tests (loop/sample/chopper editor flows) |

## Links

| Item | Link |
|------|------|
| Branch | `feature/akai-ux-improvement` |
| Worktree | `~/work/audiocontrol-work/audiocontrol-akai-ux-improvement` |
| PRD | [prd.md](./prd.md) |
| Workplan | [workplan.md](./workplan.md) |
| Parent Issue | [#216](https://github.com/audiocontrol-org/audiocontrol/issues/216) |
| PR (phases 1-13) | [#289](https://github.com/audiocontrol-org/audiocontrol/pull/289) |
| PR (phases 14-17) | [#295](https://github.com/audiocontrol-org/audiocontrol/pull/295) |
