# Attic Migration Notes

**Purpose:** Detailed technical guidance for extracting and refactoring code from the attic
**Audience:** Developers migrating archived code to active packages
**Last Updated:** 2025-10-04

---

## Table of Contents

1. [Web Code Migration Strategy](#web-code-migration-strategy)
2. [Express Server Analysis](#express-server-analysis)
3. [MIDI Code Migration](#midi-code-migration)
4. [Code Dependencies](#code-dependencies)
5. [Migration Checklist](#migration-checklist)

---

## Web Code Migration Strategy

### Overview

The web interface code (916 lines) was built with Next.js App Router but needs to be refactored to a Vite-based stack for several reasons:

1. **Lighter Dependencies** - Vite has much smaller footprint than Next.js
2. **Better DX** - Faster dev server, better HMR
3. **Framework Flexibility** - Can choose React, Vue, or Svelte
4. **Modern Tooling** - ESM-first, better tree-shaking

### Next.js Route Analysis

#### Configuration Routes (22 lines)
**Files:**
- `config/route.ts` - GET config
- `config/save/route.ts` - POST config save
- `config/server/route.ts` - GET server config

**Functionality:**
- Retrieve and save application configuration
- Server-side config management

**Migration Path:**
```typescript
// Current: Next.js App Router
export async function GET(request: Request) {
  const config = await getConfig();
  return Response.json(config);
}

// Future: Vite + Express/tRPC
// Option 1: REST API
app.get('/api/config', async (req, res) => {
  const config = await getConfig();
  res.json(config);
});

// Option 2: tRPC (recommended for type safety)
export const configRouter = router({
  get: publicProcedure.query(async () => {
    return await getConfig();
  }),
  save: publicProcedure
    .input(configSchema)
    .mutation(async ({ input }) => {
      return await saveConfig(input);
    }),
});
```

#### Translator Routes (471 lines)
**Files:**
- `t/akaidisk/route.ts` - Read Akai disk
- `t/audiodata/[...path]/route.ts` - Get audio data
- `t/cd/[...path]/route.ts` - Change directory
- `t/chop/route.ts` - Chop samples
- `t/list/[...path]/route.ts` - List files
- `t/meta/[...path]/route.ts` - Get metadata
- `t/mkdir/[...path]/route.ts` - Create directory
- `t/progress/route.ts` - Track progress
- `t/rm/[...path]/route.ts` - Remove files
- `t/syncremote/route.ts` - Sync remote
- `t/translate/route.ts` - Translate formats

**Key Functionality:**
1. **Disk Operations** - Read Akai disk images, navigate directories
2. **File Operations** - List, create, delete files/directories
3. **Translation** - Convert between sampler formats
4. **Audio Processing** - Chop samples, get audio data
5. **Progress Tracking** - Real-time operation progress

**Dependencies:**
```typescript
// These routes depend on:
import { akaitools } from '@/akaitools/akaitools';
import { translateS3k } from '@/lib/lib-translate-s3k';
import { translateS56k } from '@/lib/lib-translate-s56k';
import { jobsManager } from '@/lib/lib-jobs';
```

**Migration Strategy:**

##### Option 1: REST API with Express
```typescript
// Create dedicated API server in sampler-web-ui/server/
import express from 'express';
import { createExtractor } from '@audiocontrol/sampler-export';
import { createTranslator } from '@audiocontrol/sampler-translate';

const app = express();

app.post('/api/translate', async (req, res) => {
  const { inputPath, outputPath, format } = req.body;
  const translator = createTranslator({ format });

  const result = await translator.translate(inputPath, outputPath);
  res.json(result);
});

app.get('/api/disk/list/:path*', async (req, res) => {
  const path = req.params.path || '/';
  const extractor = createExtractor();

  const files = await extractor.listFiles(path);
  res.json({ files });
});
```

##### Option 2: tRPC (Recommended)
```typescript
// sampler-web-ui/server/routers/translator.ts
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { createTranslator } from '@audiocontrol/sampler-translate';

export const translatorRouter = router({
  translate: publicProcedure
    .input(z.object({
      inputPath: z.string(),
      outputPath: z.string(),
      format: z.enum(['sfz', 'decentsampler', 'mpc']),
    }))
    .mutation(async ({ input }) => {
      const translator = createTranslator({ format: input.format });
      return await translator.translate(input.inputPath, input.outputPath);
    }),

  listDiskFiles: publicProcedure
    .input(z.object({
      path: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const extractor = createExtractor();
      return await extractor.listFiles(input.path || '/');
    }),
});
```

##### Option 3: Electron (Desktop App)
If targeting desktop app:
```typescript
// Use Electron IPC instead of HTTP
import { ipcMain } from 'electron';
import { createTranslator } from '@audiocontrol/sampler-translate';

ipcMain.handle('translate', async (event, { inputPath, outputPath, format }) => {
  const translator = createTranslator({ format });
  return await translator.translate(inputPath, outputPath);
});
```

### Express Server Code

#### Files Analysis

**server.ts (159 lines):**
```typescript
// Current structure (approximate):
import express from 'express';
import { Brain } from './brain';

const app = express();
const brain = new Brain();

app.use(express.json());
app.use('/api', brain.createRoutes());

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

**brain.ts (193 lines):**
The "Brain" appears to be an orchestration layer that:
1. Coordinates between different services
2. Manages application state
3. Handles complex multi-step operations
4. Provides unified API for frontend

**Migration Questions:**
1. Is this Express server actually used, or was it superseded by Next.js?
2. Does "Brain" orchestration duplicate Next.js route logic?
3. Are there unique features here not in Next.js routes?

**Investigation Steps:**
```bash
# Search for active usage
grep -r "import.*server" ../
grep -r "Brain" ../
grep -r "localhost:3000" ../

# Check if server script exists
grep "\"server\":" ../package.json
grep "ts-node.*server" ../package.json
```

**Migration Paths:**

##### If Server is Still Used:
```typescript
// Create dedicated backend package: sampler-backend
// Or integrate into sampler-web-ui/server/

// Modernize Express setup
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createOrchestrator } from './orchestrator';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Use orchestrator pattern
const orchestrator = createOrchestrator();
app.use('/api', orchestrator.createRoutes());

export { app };
```

##### If Server is Obsolete:
Delete from attic after confirming no usage.

### UI Components

#### theme.ts (10 lines)
Material-UI theme configuration.

**Migration:**
```typescript
// If continuing with Material-UI in Vite:
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  // Copy theme config from attic
});

// If switching to Tailwind CSS:
// Delete theme.ts, use tailwind.config.js instead
```

#### middleware.ts (18 lines)
Next.js middleware for request interception.

**Migration:**
```typescript
// If using Vite + Express:
// Convert to Express middleware
import { Request, Response, NextFunction } from 'express';

export function middleware(req: Request, res: Response, next: NextFunction) {
  // Port logic from Next.js middleware
  next();
}

// If using Vite only:
// Convert to Vite plugin or remove if not needed
```

---

## Express Server Analysis

### Brain.ts Orchestration

The Brain orchestrator likely handles:

#### 1. Multi-Service Coordination
```typescript
// Example orchestration pattern:
class Brain {
  constructor(
    private extractor: DiskExtractor,
    private translator: Translator,
    private backup: BackupService,
  ) {}

  async translateDisk(diskPath: string, outputPath: string) {
    // 1. Extract disk
    const extracted = await this.extractor.extract(diskPath);

    // 2. Translate files
    const translated = await this.translator.translate(extracted);

    // 3. Create backup
    await this.backup.create(translated, outputPath);

    return { success: true };
  }
}
```

#### 2. State Management
```typescript
// May manage application state:
class Brain {
  private state = {
    currentDisk: null,
    currentJob: null,
    progress: 0,
  };

  updateProgress(job: string, progress: number) {
    this.state.currentJob = job;
    this.state.progress = progress;
    this.emit('progress', { job, progress });
  }
}
```

#### 3. Event Handling
```typescript
// May implement event emitter pattern:
class Brain extends EventEmitter {
  async startJob(job: Job) {
    this.emit('job:started', job);
    // ... execute job
    this.emit('job:completed', job);
  }
}
```

**Migration Strategy:**

If orchestration is needed, refactor to service pattern:
```typescript
// sampler-web-ui/server/services/orchestrator.ts
export interface OrchestratorServices {
  extractor: DiskExtractor;
  translator: Translator;
  backup: BackupService;
}

export function createOrchestrator(services: OrchestratorServices) {
  return {
    async translateDisk(diskPath: string, outputPath: string) {
      // Use dependency injection instead of class
      const extracted = await services.extractor.extract(diskPath);
      const translated = await services.translator.translate(extracted);
      await services.backup.create(translated, outputPath);

      return { success: true };
    },
  };
}
```

### api.ts (10 lines)
Likely just type definitions or API route registration.

**Migration:**
If it's types, move to shared types package.
If it's routes, merge into main router.

---

## MIDI Code Migration

### roland-jv-1080.ts (331 lines)

#### What It Does
MIDI device implementation for Roland JV-1080 synthesizer.

#### Structure
```typescript
// Typical MIDI device structure:
export class RolandJV1080 {
  constructor(private midiPort: MIDIPort) {}

  async sendSysex(data: Uint8Array) {
    // Send system exclusive message
  }

  async requestPatch(bank: number, patch: number) {
    // Request patch data
  }

  async parsePatchData(data: Uint8Array) {
    // Parse received patch
  }
}
```

#### Migration to sampler-midi

**Step 1: Copy and Rename**
```bash
cd sampler-midi/src/devices
cp ../../sampler-attic/src/midi/roland-jv-1080.ts ./jv-1080.ts
```

**Step 2: Update Imports**
```typescript
// Change deprecated imports
import { MIDIDevice } from '@/midi/device';  // OLD
import { MIDIDevice } from '@/devices/base'; // NEW

// Use workspace packages
import { createMidiPort } from '@audiocontrol/sampler-midi';
```

**Step 3: Align with Current Architecture**
```typescript
// Match existing device pattern from sampler-midi
import { DeviceInterface, DeviceConfig } from '@/types';

export interface JV1080Config extends DeviceConfig {
  // JV-1080 specific config
}

export function createJV1080(config: JV1080Config): DeviceInterface {
  return {
    async initialize() { /* ... */ },
    async sendMessage(data: Uint8Array) { /* ... */ },
    async requestData(type: string) { /* ... */ },
  };
}
```

**Step 4: Add Tests**
```typescript
// sampler-midi/test/devices/jv-1080.test.ts
import { describe, it, expect } from 'vitest';
import { createJV1080 } from '@/devices/jv-1080';

describe('JV-1080 Device', () => {
  it('should initialize device', async () => {
    const device = createJV1080({ port: 'mock' });
    await expect(device.initialize()).resolves.not.toThrow();
  });

  it('should send sysex message', async () => {
    // Test sysex functionality
  });
});
```

**Step 5: Update Package Exports**
```typescript
// sampler-midi/src/index.ts
export { createJV1080 } from '@/devices/jv-1080';
export type { JV1080Config } from '@/devices/jv-1080';
```

**Step 6: Add CLI Support (Optional)**
```typescript
// sampler-midi/src/cli/jv1080-cli.ts
import { Command } from 'commander';
import { createJV1080 } from '@/devices/jv-1080';

export function registerJV1080Commands(program: Command) {
  program
    .command('jv1080:patch')
    .description('Request patch from JV-1080')
    .option('-b, --bank <number>', 'Bank number')
    .option('-p, --patch <number>', 'Patch number')
    .action(async (options) => {
      const device = createJV1080({ port: options.port });
      const patch = await device.requestPatch(options.bank, options.patch);
      console.log('Patch data:', patch);
    });
}
```

---

## Code Dependencies

### What Each Attic File Depends On

#### Next.js Routes
**External:**
- `next` - Framework
- `@vercel/edge` - Edge runtime (some routes)

**Internal (now in packages):**
- `@audiocontrol/sampler-export` - Disk extraction
- `@audiocontrol/sampler-translate` - Format conversion
- `@audiocontrol/sampler-lib` - Utilities

#### Express Server
**External:**
- `express` - Web framework
- `cors`, `helmet` - Middleware (likely)

**Internal:**
- Same as Next.js routes

#### JV-1080
**External:**
- `webmidi` or `node-midi` - MIDI library

**Internal:**
- MIDI device base class (may need to be extracted too)

### Reverse Dependencies

**Who depends on archived code?**

Run these searches:
```bash
# Search all packages for imports from src-deprecated
grep -r "src-deprecated" sampler-*/src/ lib-runtime/src/

# Search for specific archived modules
grep -r "roland-jv-1080" sampler-*/src/
grep -r "ts/app/server" sampler-*/src/
grep -r "app/api" sampler-*/src/
```

**Expected Result:** None (code should be isolated in attic)

If any found, those are blocking dependencies that must be resolved first.

---

## Migration Checklist

### Pre-Migration

- [ ] Verify code is actually needed (not obsolete)
- [ ] Identify all dependencies (internal and external)
- [ ] Check for reverse dependencies (who imports this)
- [ ] Determine target package
- [ ] Review current package architecture

### During Migration

#### For Web Code:
- [ ] Create new package or integrate into existing
- [ ] Choose stack (Vite, framework, API approach)
- [ ] Update imports to use @/ pattern and workspace packages
- [ ] Convert Next.js patterns to chosen framework
- [ ] Add proper error handling
- [ ] Implement logging
- [ ] Add input validation

#### For MIDI Code:
- [ ] Copy file to sampler-midi/src/devices/
- [ ] Update imports
- [ ] Align with current device interface
- [ ] Add TypeScript types
- [ ] Add comprehensive tests
- [ ] Update package exports
- [ ] Add CLI commands (if needed)
- [ ] Document device specifications

### Post-Migration

- [ ] All tests pass
- [ ] TypeScript compiles with no errors
- [ ] Code coverage meets standards (80%+)
- [ ] Documentation updated
- [ ] CLI help text added (if applicable)
- [ ] Integration tests added
- [ ] Performance benchmarks met
- [ ] Code reviewed
- [ ] **Delete migrated file from attic**

### Attic Cleanup

When file successfully migrated:
```bash
# Mark file as migrated in README
# Update ATTIC-NOTES.md
# Delete file from attic
rm sampler-attic/src/[category]/[file].ts

# If entire category emptied, delete directory
rm -rf sampler-attic/src/[category]/

# If entire attic emptied:
rm -rf sampler-attic/
# Remove from pnpm-workspace.yaml
```

---

## Common Patterns

### Converting Next.js Routes to tRPC

**Before (Next.js):**
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const result = await doSomething(body);
  return Response.json(result);
}
```

**After (tRPC):**
```typescript
export const myRouter = router({
  doSomething: publicProcedure
    .input(mySchema)
    .mutation(async ({ input }) => {
      return await doSomething(input);
    }),
});
```

### Converting Class-Based to Interface-Based

**Before (Class):**
```typescript
export class MyService {
  constructor(private dep: Dependency) {}

  async doSomething() {
    return this.dep.execute();
  }
}
```

**After (Interface + Factory):**
```typescript
export interface MyServiceInterface {
  doSomething(): Promise<Result>;
}

export interface MyServiceConfig {
  dependency?: Dependency;
}

export function createMyService(config: MyServiceConfig = {}): MyServiceInterface {
  const dep = config.dependency ?? createDefaultDependency();

  return {
    async doSomething() {
      return dep.execute();
    },
  };
}
```

### Adding Proper Type Safety

**Before (Loose Types):**
```typescript
async function processData(data: any) {
  return data.something;
}
```

**After (Strict Types):**
```typescript
import { z } from 'zod';

const dataSchema = z.object({
  something: z.string(),
  optional: z.number().optional(),
});

type Data = z.infer<typeof dataSchema>;

async function processData(data: unknown): Promise<string> {
  const validated = dataSchema.parse(data);
  return validated.something;
}
```

---

## Questions and Decisions

### Web Interface Stack Decision Matrix

| Criteria | Next.js (Current) | Vite + React | Vite + Vue | Electron |
|----------|------------------|--------------|------------|----------|
| **Bundle Size** | Large | Medium | Small | N/A |
| **Dev Experience** | Good | Excellent | Excellent | Good |
| **Type Safety** | Good | Good | Good | Good |
| **Learning Curve** | Medium | Low | Medium | High |
| **Desktop Integration** | None | None | None | Excellent |
| **Distribution** | Web only | Web only | Web only | Desktop app |

**Recommendation:** Vite + React with tRPC for type safety

**Reasoning:**
1. Smaller bundle than Next.js
2. Faster development with HMR
3. Team likely familiar with React
4. tRPC provides end-to-end type safety
5. Can add Electron later if needed

### JV-1080 Support Decision

**Questions to Answer:**
1. Are there active users of JV-1080 functionality?
2. Is JV-1080 part of the project's scope?
3. Does maintaining it provide value?

**Decision Tree:**
```
Is JV-1080 actively used?
├─ YES → Is it in project scope?
│  ├─ YES → Migrate to sampler-midi
│  └─ NO → Move to separate package or delete
└─ NO → Delete from attic
```

---

## Best Practices

### When Migrating

1. **Start Small** - Migrate one file at a time
2. **Test First** - Write tests before refactoring
3. **Update Incrementally** - Small, reviewable changes
4. **Document As You Go** - Update docs with each migration
5. **Verify Deletion** - Ensure no imports before deleting from attic

### Code Quality Standards

All migrated code must meet:
- [ ] TypeScript strict mode (no `any`)
- [ ] 80%+ test coverage
- [ ] JSDoc comments on public APIs
- [ ] Interface-first design (no class inheritance)
- [ ] Dependency injection for testability
- [ ] Proper error handling with descriptive messages

### Performance Requirements

Migrated code should maintain or improve:
- [ ] Response time (API endpoints < 100ms for simple operations)
- [ ] Memory usage (< 500MB for typical operations)
- [ ] Bundle size (frontend code)
- [ ] Startup time (server initialization < 2s)

---

## Resources

### Documentation
- [Next.js to Vite Migration Guide](https://vitejs.dev/guide/migration.html)
- [tRPC Documentation](https://trpc.io/docs)
- [Vitest Testing Guide](https://vitest.dev/guide/)

### Internal References
- `sampler-midi/src/devices/` - Device implementation examples
- `sampler-export/src/cli/` - CLI command examples
- `sampler-translate/src/` - Translation implementation patterns

### Tools
- `tsx` - TypeScript execution for Node.js
- `vitest` - Testing framework
- `zod` - Schema validation
- `tRPC` - Type-safe RPC

---

**Last Updated:** 2025-10-04
**Next Review:** After first migration attempt
**Contact:** Project maintainer for migration decisions
