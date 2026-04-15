# Unit Testing

Unit testing methodology — Vitest, jsdom, React Testing Library.

> Part of the [Testing Architecture](TESTING.md). See also: [UI Testing](TESTING-UI.md) | [E2E Testing](TESTING-E2E.md)

## Directory Structure

```
modules/<editor>/
  test/
    unit/
      components/
        keygroups/
          ZoneOverview.test.tsx
          KeyRangeEditor.test.tsx
        library/
          DeviceMemoryPanel.test.tsx
      lib/
        wav-writer.test.ts
        program-serialization.test.ts
      stores/
        libraryStore.test.ts
  vitest.config.ts
```

Test files mirror the `src/` directory structure. A test for `src/components/keygroups/ZoneOverview.tsx` lives at `test/unit/components/keygroups/ZoneOverview.test.tsx`.

## Naming Conventions

| What | Pattern |
|------|---------|
| Test files | `<SourceFileName>.test.ts` or `.test.tsx` |
| Test location | `test/unit/` mirroring `src/` structure |
| Describe blocks | Name the module or function under test |
| Test names | Describe the behavior, not the implementation |

## Configuration

Each editor has a `vitest.config.ts` at the module root:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.test.{ts,tsx}'],
    exclude: ['test/e2e/**', 'test/ui/**', 'node_modules/**'],
    globals: true,
    setupFiles: ['../editor-core/src/testing/vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

Key points:
- `environment: 'jsdom'` — DOM APIs available without a browser
- `include` targets `test/unit/` only
- `@/` alias resolves to `src/` so test imports match source imports

## Import Patterns

Tests import from the source tree using the `@/` alias, identical to how source files import each other:

```typescript
// Good — uses the @/ alias
import { buildWavFile } from '@/lib/wav-writer';
import { ZoneOverview } from '@/components/keygroups/ZoneOverview';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';

// Bad — relative path breaks when files move
import { buildWavFile } from '../../../src/lib/wav-writer';
```

For cross-module imports, use the workspace package name:

```typescript
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
```

## Test Patterns

### Pure logic

```typescript
import { describe, it, expect } from 'vitest';
import { buildWavFile } from '@/lib/wav-writer';

describe('buildWavFile', () => {
  it('produces a valid 44-byte header for empty samples', () => {
    const buffer = buildWavFile(new Int16Array(0), 44100);
    expect(buffer.byteLength).toBe(44);
  });
});
```

### React components

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoneOverview } from '@/components/keygroups/ZoneOverview';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';

describe('ZoneOverview', () => {
  it('renders empty state when keygroupCount is 0', () => {
    render(
      <ZoneOverview
        keygroups={[]}
        keygroupCount={0}
        selectedKeygroupIndex={null}
        onSelectKeygroup={vi.fn()}
        noteRange={{ min: 0, max: 127 }}
      />,
    );
    expect(screen.getByText('No keygroups to display.')).toBeInTheDocument();
  });
});
```

### Factory helpers

Test data factories live in `src/test-helpers/` and provide realistic defaults with override support:

```typescript
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';

const kg = makeKeygroupHeader({
  LONOTE: 36,
  HINOTE: 72,
  SNAME1: 'BASS DRUM   ',
});
```

## Dependency Injection, Not Module Stubs

Never stub or mock modules. If a component depends on a service, inject the dependency through props or context:

```typescript
// Good — inject the dependency
render(<Editor midiIO={fakeMidiIO} />);

// Bad — module stubbing
vi.mock('@/services/midi-io');
```

This keeps tests honest. If the real interface changes, tests break at compile time.

## Running Tests

```bash
# All unit tests across the monorepo
pnpm test

# Unit tests for one module
pnpm --filter @audiocontrol/akai-s3k-editor test

# Watch mode during development
pnpm --filter @audiocontrol/akai-s3k-editor test:watch

# Run a specific test file
pnpm --filter @audiocontrol/akai-s3k-editor test -- test/unit/lib/wav-writer.test.ts
```

## When a Test Belongs Here

| Scenario | Unit test? |
|----------|-----------|
| Pure function — data transform, encoding, math | Yes |
| React component renders with given props | Yes |
| Component calls a callback on user interaction | Yes |
| Store logic with no side effects | Yes |
| Drag interaction that depends on pixel layout | No — use [UI test](TESTING-UI.md) |
| Round-trip verification with real hardware | No — use [E2E test](TESTING-E2E.md) |
| OPFS or browser storage API behavior | No — use [E2E test](TESTING-E2E.md) |

**Rule of thumb:** if the test needs a real browser or real hardware, it does not belong here.
