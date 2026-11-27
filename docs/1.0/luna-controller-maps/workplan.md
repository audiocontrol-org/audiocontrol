# Workplan: LUNA controller maps

## GitHub Tracking

| Item | Link |
|------|------|
| Parent issue | [#475](https://github.com/audiocontrol-org/audiocontrol/issues/475) |
| Product plan | [controller-maps-product plan](https://github.com/audiocontrol-org/luna-addons/blob/plan/controller-maps-product/docs/superpowers/plans/2026-11-27-controller-maps-product.md) |
| Design spec | [controller-maps design](https://github.com/audiocontrol-org/luna-addons/blob/main/docs/superpowers/specs/2026-11-26-controller-maps-design.md) |

## Phase A: contract 2 in canonical-midi-maps

- [x] Feature docs and GitHub issue
- [x] Failing tests (`src/contract-2.test.ts`)
- [x] Types (`src/types/contract-2.ts`)
- [x] zod schemas (`src/validators/contract-2-schema.ts`)
- [x] Parsers and cross-document checks (`src/parsers/contract-2-parser.ts`)
- [x] Exports from `src/index.ts`

## Phase B: LUNA Add On

Tracked in the luna-addons repository plan. It consumes these types with `import type` and
calls the parsers at build time.
