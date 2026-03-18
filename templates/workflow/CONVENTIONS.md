# Workflow Module Conventions

## Directory Layout

```
modules/<workflow-name>/
├── src/
│   ├── index.ts              # Algorithm/type exports (no React dependency)
│   ├── types.ts              # Shared types
│   ├── ui/
│   │   ├── index.ts          # React component exports
│   │   ├── <Component>.tsx   # Main workflow component
│   │   ├── utils.ts          # cn() and other UI utilities
│   │   └── hooks/            # React hooks
│   └── workers/              # Web Workers (if needed)
├── dev/
│   ├── vite.config.ts        # Standalone dev server config
│   ├── index.html            # Dev harness HTML
│   ├── main.tsx              # Dev harness entry point
│   └── environment.ts        # Browser environment wiring
├── package.json              # Two-part exports (. and ./ui)
├── tsup.config.ts            # Two entry points matching exports
├── tsconfig.json
└── vitest.config.ts
```

## Two-Part Exports

Every workflow module has two entry points:

1. **`.` (root)** — Algorithm and type exports. No React dependency.
   ```ts
   import { SomeType } from '@audiocontrol/<workflow>';
   ```

2. **`./ui`** — React components and hooks.
   ```ts
   import { WorkflowComponent } from '@audiocontrol/<workflow>/ui';
   ```

This separation allows non-React consumers (CLI tools, Node scripts) to use
algorithms and types without pulling in React.

## Environment Capabilities

Workflow components receive capabilities via props or context — never import
browser globals directly.

```tsx
// Good — receives AudioPlayback via prop
interface MyWorkflowProps {
  audio?: AudioPlayback;
}

// Bad — imports browser global
import { AudioContext } from '...';
```

Available capabilities (from `@audiocontrol/editor-core`):

| Interface | Purpose |
|-----------|---------|
| `FileIO` | File picking, reading, writing, directory listing |
| `AudioPlayback` | Audio buffer playback, seek, state observation |
| `MidiTransport` | MIDI port access and SysEx communication |

## Dev Harness

Each workflow module includes a `dev/` directory with a standalone Vite app.
The harness:

- Wires up browser environment implementations
- Provides synthetic test data (no device connection needed)
- Runs on its own port (3332+)
- Uses `@/` path alias pointing to `../src/`

Run with: `cd modules/<workflow> && pnpm dev`

## Integration with sampler-editor

Workflow modules are rendered under `/workflows/*` routes in the sampler editor:

1. Add dependency to `sampler-editor/package.json`
2. Add route in `WorkflowsPage.tsx`
3. Wrap with `WorkflowEnvironmentProvider` for capability injection
4. Add card link in the workflow hub

## Testing

- Contract tests for environment interfaces live in `editor-core`
- Unit tests for algorithms go in the root `src/` (no React needed)
- Component tests (if needed) use mock environment implementations

## Port Assignments

| Module | Dev Port |
|--------|----------|
| sampler-editor | 3330 |
| sample-chopper | 3331 |
| loop-editor | 3332 |
| (next workflow) | 3333 |
