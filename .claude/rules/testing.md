---
paths:
  - "test/**"
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "src/**/*.spec.ts"
  - "src/**/*.spec.tsx"
---

# Testing Architecture

See [TESTING.md](/TESTING.md) for the overall testing architecture. Three test categories:

| Category | Location | Tooling | Hardware |
|----------|----------|---------|----------|
| Unit | `test/unit/` | vitest + jsdom | No |
| UI | `test/ui/` | Playwright + test harness | No |
| E2E | `test/e2e/` | Playwright + real app | Yes |

Detailed methodology: [TESTING-UNIT.md](/TESTING-UNIT.md) | [TESTING-UI.md](/TESTING-UI.md) | [TESTING-E2E.md](/TESTING-E2E.md)

**Migration in progress:** Unit tests currently live as `src/**/*.test.tsx`, E2E tests in `e2e/`. New tests go in `test/<category>/`. See GitHub issue for migration tracking.

When developing UI features:
1. Create a test harness page (`src/pages/Test<Feature>Page.tsx`) with factory data
2. Write Playwright specs in `test/ui/<feature>.spec.ts` **as you build, not after**
3. Every manually verified interaction must become a test spec — ad-hoc screenshots without specs are throwaway work

**When fixing a bug, write a failing test FIRST:**
1. Ask: "what layer does this bug live in?" — that determines the test category
   - Pure function logic → unit test
   - UI interaction + state management → UI test (Playwright + test harness)
   - Device communication / round-trip → e2e test (real hardware at s3k.local:7033)
2. Never default to the easiest test category. If the user reports a device behavior, the test must talk to the device.
3. Verify the test fails, THEN fix the bug, THEN verify the test passes.
4. **Isolate the layer first:** For bugs reported as device behavior, write a Node.js test that talks directly to the device through the client (`modules/e2e-infra/src/node/`). If the Node test reproduces the bug, the problem is in the client/encoding layer. If it passes, the problem is in the UI state management layer. This avoids wasting time on Playwright when the bug is in raw byte encoding.
5. **Never assume the device is at fault.** The device has been in constant service for 30 years. Our code is brand new. Exhaust all possibilities in our code before considering a device bug.

## Before Running Tests

Before running any test command, re-read the E2E Testing rules (`.claude/rules/e2e-testing.md`). Do not improvise test infrastructure. The key rules:
- Use `make test-*` targets — never call tsx, npx, or scripts directly
- Use `run-and-watch.sh` to run e2e make targets
- Never build standalone test runners, throwaway scripts, or ad-hoc harnesses
