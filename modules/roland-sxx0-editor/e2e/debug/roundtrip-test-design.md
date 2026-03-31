# Roundtrip E2E Test Design: Create → Import → Export → Verify

This document provides the complete blueprint for designing atomic roundtrip e2e tests for the roland-sxx0-editor. Tests will follow the pattern:
1. Create a fixture in the OPFS library
2. Import the fixture from library to device  
3. Export the fixture back from device to library
4. Compare the original vs. exported fixture

---

## Table of Contents

1. [User Flow: Import (Library → Device)](#user-flow-import-library--device)
2. [User Flow: Export (Device → Library)](#user-flow-export-device--library)
3. [OPFS Fixture Format & Structure](#opfs-fixture-format--structure)
4. [Test Implementation Patterns](#test-implementation-patterns)
5. [Data-TestID Reference](#data-testid-reference)
6. [Known Gaps & Limitations](#known-gaps--limitations)
7. [Running Isolated Tests](#running-isolated-tests)

---

## User Flow: Import (Library → Device)

### Step 1: Navigate to Library Page
- **UI Path**: Home page → Click nav link with `data-testid="library-nav-link"`
- **Expected State**: App displays LibraryPage with three panels:
  - Left: DeviceMemoryPanel (tones/patches loaded on device)
  - Center: LibraryTreePanel (sets, individual tones/patches, drum kits)
  - Right: ItemPreviewPanel (details + action buttons)

### Step 2: Connect to OPFS Backend
**IMPORTANT**: Must be done BEFORE writing fixture files so app loads fixtures correctly.
- **UI Path**: LibraryPage → Look for connection UI at the top (or in settings)
- **Button**: `data-testid="library-backend-opfs"`
- **Expected State**: Status indicator shows connected (class `.ac-library-connection-status` appears)
- **Note**: The app loads library contents when this button is clicked. Fixtures must exist in OPFS before this step.

### Step 3: Select a Tone from Library
- **Panel**: Center (LibraryTreePanel)
- **Option A - From Individual Tones**:
  - Expand "Individual Tones" section (hierarchical tree)
  - Click a tone entry (e.g., `test-tone-01`)
  - Selected tone appears in right panel (ItemPreviewPanel)

- **Option B - From a Set**:
  - Expand "Sets" section
  - Click a set name
  - Set expands showing contained tones
  - Click a tone entry
  - Tone appears in right panel

### Step 4: Click "Import to Device" Button
- **Location**: Right panel (ItemPreviewPanel) - TonePreview component
- **Button**: `data-testid="import-to-device-button"`
- **Expected State**: ImportLibraryToneDialog opens

### Step 5: Configure Import Parameters in Dialog
Dialog: `ImportLibraryToneDialog`

**Fields**:
| Field | data-testid | Type | Notes |
|-------|------------|------|-------|
| Target (dropdown) | (no testid) | select | Selects device memory group (e.g., "S-330 Tones") |
| Target Tone Slot | `target-slot-select` | select | Which device slot to overwrite (T01-T32 for S-330) |
| Slot Occupied Warning | `slot-occupied-warning` | div | Warning if selected slot already has a tone |
| Wave Bank (dropdown) | (no testid) | select | Which bank (0-3) to allocate wave data |
| Segment (dropdown) | (no testid) | select | Which segments to allocate |
| Find Best Fit (button) | (no testid) | button | Opens BestFitPicker overlay |
| Import Progress | `import-progress` | div | Shows progress bar during operation |
| Cancel Button | (no testid) | button | Text "Cancel" |
| Confirm Button | `confirm-import-button` | button | Text "Import Tone" or "Import Patch + N Tones" |

**Success Screen**:
- `data-testid="import-success"` - Displayed after successful import

### Step 6: Complete Import
- Click `confirm-import-button`
- Progress bar appears in `import-progress`
- Dialog shows success screen with `import-success` testid
- Dialog auto-closes after brief delay
- Tone now appears in device memory (left panel, DeviceMemoryPanel)

### Patch Import (Similar Flow)
Same steps 1-6 but for patches:
- Library → select patch
- Button: `import-to-device-button` (in patch preview)
- Dialog: `ImportLibraryPatchDialog`
- The dialog additionally shows:
  - Required tones that will be imported automatically
  - `missing-tone-warning` if referenced tones not found
  - Target Patch Slot: `target-slot-select`
  - Confirm button text: "Import Patch + N Tones"

---

## User Flow: Export (Device → Library)

### Step 1: Navigate to Tones Page (or Patches)
- **UI Path**: LibraryPage → Click nav link `a[href$="/tones"]` or `a[href$="/patches"]`
- **Expected State**: Displays tone/patch grid with entries

### Step 2: Locate Tone/Patch Item
- **Selector**: `[data-testid^="tone-item-"]` (for tones) or `[data-testid^="patch-item-"]` (for patches)
- **Sub-element - Name**: `[data-testid="tone-name"]` or `[data-testid="patch-name"]`

### Step 3: Click Export Button
- **Button**: `data-testid="export-tone-button"` or `data-testid="export-patch-button"`
- **Expected State**: ExportToneDialog or ExportPatchDialog opens

### Step 4: Configure Export Parameters in Dialog
Dialog: `ExportToneDialog` or `ExportPatchDialog`

**Tone Export Fields**:
| Field | data-testid | Type | Notes |
|-------|------------|------|-------|
| Dialog Wrapper | `export-dialog` | div | Main dialog container |
| Tone Name Input | (no testid) | input | Pre-filled with tone name, max 32 chars |
| Tone Info (readonly) | (no testid) | div | Displays sample rate, loop mode, original key, TVF |
| Progress Bar | (no testid) | div | Shows during export operation |
| Cancel Button | `export-cancel` | button | Closes dialog without exporting |
| Confirm Button | `export-confirm` | button | Starts export operation |

**Patch Export Fields** (same as tone, but):
- Shows patch info: key mode, level, bender range, output assign
- Shows "Dependent Tones: N tone(s) will be exported"
- Patch is saved to a directory `{patchName}/`

**Success Screen**:
- Text: "Tone exported successfully!" or "Patch bundle exported successfully!"
- Detail: "Saved as `{toneName}.yaml`" or "Saved to `{patchName}/` with N tone(s)"

### Step 5: Complete Export
- Click `export-confirm`
- Progress bar appears briefly
- Success screen displayed
- Dialog auto-closes
- Exported files now in OPFS library at:
  - **Tone**: `library/s330/tones/{toneName}.yaml` + `{toneName}.wav`
  - **Patch**: `library/s330/patches/{patchName}/patch.yaml` + tone files

---

## OPFS Fixture Format & Structure

### Directory Layout
```
OPFS Root (navigator.storage.getDirectory())
└── library/
    ├── s330/
    │   ├── tones/
    │   │   ├── test-tone-01.yaml
    │   │   ├── test-tone-01.wav
    │   │   ├── test-tone-02.yaml
    │   │   ├── test-tone-02.wav
    │   │   └── subdirectories/ (optional, hierarchical)
    │   ├── patches/
    │   │   ├── test-patch-01/
    │   │   │   ├── patch.yaml
    │   │   │   ├── T01.yaml
    │   │   │   ├── T01.wav
    │   │   │   ├── T02.yaml
    │   │   │   └── T02.wav
    │   │   └── test-patch-02/
    │   │       └── ...
    │   └── sets/
    │       ├── test-set-01/
    │       │   ├── manifest.yaml
    │       │   ├── T01.yaml
    │       │   ├── T01.wav
    │       │   └── ...
    │       └── ...
    └── s550/
        └── (same structure)
```

### Tone YAML Format

**File**: `{toneName}.yaml`

```yaml
format: sampler-tone
device: s330
version: 1
name: "Test Tone"              # Max 12 chars, displayed in UI
wave:
  file: "test-tone.wav"         # Filename reference
  sampleRate: 44100             # Hz
  loopMode: forward             # oneShot, forward, alternating, reverse
  startPoint: 0                 # Sample offset (optional)
  endPoint: 44100               # Sample offset (optional)
  loopPoint: 0                  # Sample offset (optional)
s330:
  originalKey: 60               # MIDI note 0-127 (middle C = 60)
  outputAssign: 0               # 0=Mix, 1-7=outputs
  sourceTone: 0                 # 0-31 (optional)
  transpose: 0                  # -64 to +63 (optional)
  fineTune: 0                   # -64 to +63 (optional)
  benderEnabled: true           # (optional)
  aftertouchEnabled: true       # (optional)
  pitchFollow: true             # (optional)
  # Optional: LFO, TVF, TVA parameters
  lfo:
    rate: 64                    # 0-127
    sync: true
    delay: 0                    # 0-127
    mode: normal                # normal, one-shot
    polarity: true              # (optional)
    offset: 0                   # (optional)
  tvf:
    cutoff: 127                 # 0-127
    resonance: 0                # 0-127
    keyFollow: 0                # 0-127
    lfoDepth: 0                 # (optional)
    egDepth: 0                  # 0-127
    egPolarity: normal          # normal, reverse
    enabled: false              # on/off
    envelope:                   # (optional)
      levels: [0, 127, 127, 0, 0, 0, 0, 0]
      rates: [1, 1, 1, 1, 1, 1, 1, 1]
      sustainPoint: 2
      endPoint: 3
  tva:
    level: 127                  # 0-127
    lfoDepth: 0                 # (optional)
    keyRate: 0                  # (optional)
    velRate: 0                  # (optional)
    levelCurve: 0               # (optional)
    envelope:                   # 8-point required
      levels: [0, 127, 127, 64, 0, 0, 0, 0]
      rates: [1, 1, 64, 10, 1, 1, 1, 1]
      sustainPoint: 3
      endPoint: 4
```

**For S-550**, use `s550:` key instead of `s330:`, with `sourceTone: 0-63` (64 tones instead of 32).

### Tone WAV File Format

**File**: `{toneName}.wav`

- PCM WAV file (16-bit or 24-bit)
- Sample rate MUST match `wave.sampleRate` in YAML
- Can be mono or stereo
- Length determines memory allocation (segments calculated as: segments_needed = ceil(byte_length / 2 / 32768))

**Creating a test WAV**:
```typescript
// Minimal 1-second silence at 44100 Hz
const sampleRate = 44100;
const duration = 1.0; // seconds
const samples = sampleRate * duration;
const wavData = new Uint8Array(44 + samples * 2); // 44-byte header + samples

// WAV header (minimal)
const header = 'RIFF'.split('').map(c => c.charCodeAt(0));
// ... (use audiocontrol's createWav() helper instead of manual header)
```

Use the helper: `import { createWav } from '@audiocontrol/sampler-library/browser';`

### Patch YAML Format

**File**: `{patchName}/patch.yaml`

```yaml
format: sampler-patch
device: s330
version: 1
name: "Test Patch"              # Max 12 chars
level: 100                       # 0-127 (optional)
s330:
  keyMode: normal               # normal, v-sw, x-fade, v-mix, unison (optional)
  benderRange: 2                # 0-12 (optional)
  aftertouchSens: 64            # 0-127 (optional)
  aftertouchAssign: volume      # modulation, volume, bend+, bend-, filter (optional)
  velocityThreshold: 1          # 0-127 (optional)
  keyAssign: rotary             # rotary, fix (optional)
  outputAssign: 0               # 0=Mix, 1-7=outputs, 8=TONE (optional)
  # Layer assignments: 109-element arrays (one per MIDI note 0-108)
  # Each element is a tone index (0-31 for S-330) or -1 for no assignment
  toneLayer1: [0, 0, 0, ... (109 total)]  # (optional)
  toneLayer2: [0, 0, 0, ... (109 total)]  # (optional)
```

**Simplified Format** (recommended for tests):
```yaml
format: sampler-patch
device: s330
version: 1
name: "Test Patch"
level: 100
# No s330 extension needed - uses defaults
```

### Set Manifest Format

**File**: `{setName}/manifest.yaml`

```yaml
format: sampler-set
version: 1
name: "Test Set"
tones:
  - slot: 0
    file: T01.yaml
    waveAllocation:
      bank: 0
      segmentTop: 0
      segmentLength: 2
  - slot: 1
    file: T02.yaml
    waveAllocation:
      bank: 0
      segmentTop: 2
      segmentLength: 2
patches:
  - slot: 0
    file: P01.yaml
```

**Tone files** in the set directory use naming: `T01.yaml`, `T02.yaml`, etc. (matching the slot numbers).

---

## Test Implementation Patterns

### Pattern 1: Simple Tone Roundtrip

```typescript
import { test, expect, type Page } from '@playwright/test';
import {
  connectToDevice,
  connectToOPFS,
  navigateToLibrary,
  waitForAppReady,
} from './helpers/connection-helper';
import {
  initializeOPFS,
  cleanupOPFS,
  populateFixtures,
  readFile,
  getDirectory,
} from './helpers/opfs-helpers';

test('tone roundtrip: create → import → export → verify', async ({ page }) => {
  // 1. Setup: Initialize app and MIDI connection
  await page.goto('/roland/s330/editor');
  await waitForAppReady(page);
  await connectToDevice(page);
  
  // 2. Prepare OPFS with a tone fixture BEFORE connecting library
  const fixtureYaml = `
format: sampler-tone
device: s330
version: 1
name: RoundtripTest
wave:
  file: test.wav
  sampleRate: 44100
  loopMode: forward
s330:
  originalKey: 60
  outputAssign: 0
`;

  // Create a minimal WAV (1 second silence)
  const wavData = createMinimalWav(44100, 1);
  
  await page.evaluate(async (fixtures) => {
    const root = await navigator.storage.getDirectory();
    await populateFixtures(root, fixtures);
  }, {
    library: {
      s330: {
        tones: {
          'roundtrip-test.yaml': { content: fixtureYaml },
          'roundtrip-test.wav': { content: wavData },
        },
      },
    },
  });

  // 3. Navigate and connect library
  await navigateToLibrary(page);
  await connectToOPFS(page);
  
  // Wait for library to load
  await page.waitForTimeout(2000);
  
  // 4. Import: Select tone from library and import to device slot T01
  await page.locator('[data-testid="library-nav-link"]').click();
  
  // Expand individual tones and select our fixture
  const toneItem = page.locator('text=roundtrip-test');
  await toneItem.click();
  
  // Click import button
  await page.locator('[data-testid="import-to-device-button"]').click();
  const importDialog = page.locator('text=Import Library Tone');
  await expect(importDialog).toBeVisible();
  
  // Select target slot (default T01)
  await page.locator('[data-testid="target-slot-select"]').selectOption('0');
  
  // Click confirm
  await page.locator('[data-testid="confirm-import-button"]').click();
  
  // Wait for import success
  await expect(page.locator('[data-testid="import-success"]')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);
  
  // 5. Export: Navigate to Tones page, find the imported tone, export it
  await page.goto('/roland/s330/editor/tones');
  
  // Wait for tones to load
  const toneItems = page.locator('[data-testid^="tone-item-"]');
  await expect(toneItems.first()).toBeVisible({ timeout: 5000 });
  
  // Click export on the tone (should be at T01)
  await page.locator('[data-testid^="tone-item-"][data-testid$="-0"] [data-testid="export-tone-button"]').click();
  
  const exportDialog = page.locator('[data-testid="export-dialog"]');
  await expect(exportDialog).toBeVisible();
  
  // Use default name (device tone name)
  await page.locator('[data-testid="export-confirm"]').click();
  
  // Wait for export complete
  await expect(exportDialog).not.toBeVisible({ timeout: 10000 });
  
  // 6. Verify: Check that exported tone exists and matches original
  const exportedYaml = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const libraryDir = await root.getDirectoryHandle('library');
    const s330Dir = await libraryDir.getDirectoryHandle('s330');
    const tonesDir = await s330Dir.getDirectoryHandle('tones');
    
    // Find the exported file (name depends on tone name)
    const entries = [];
    for await (const entry of tonesDir.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.yaml')) {
        entries.push(entry.name);
      }
    }
    
    // Read the first/expected file
    if (entries.length === 0) throw new Error('No exported tones found');
    
    const fileHandle = await tonesDir.getFileHandle(entries[0]);
    const file = await fileHandle.getFile();
    return await file.text();
  });
  
  // Parse and verify key fields
  expect(exportedYaml).toContain('format: sampler-tone');
  expect(exportedYaml).toContain('device: s330');
  // Compare name, sample rate, loop mode, etc.
});

// Helper: Create minimal 1-second WAV
function createMinimalWav(sampleRate: number, duration: number): Uint8Array {
  const samples = sampleRate * duration;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * channels * bytesPerSample;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);
  
  // RIFF header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Data is all zeros (silence)
  
  return uint8;
}
```

### Pattern 2: Patch Roundtrip with Dependent Tones

Patches automatically import/export required tones. The flow is similar but:
- Patch dialog shows: "Import Patch + 2 Tones" (if patch references 2 tones)
- Patch export creates: `{patchName}/patch.yaml` + tone files
- Verify both patch and tones exist in library after export

### Pattern 3: Isolated Test with --grep

```bash
# Run only tests matching "roundtrip"
npm run test:e2e -- --grep "roundtrip"

# Run single test file
npm run test:e2e -- modules/roland-sxx0-editor/e2e/roundtrip.spec.ts

# Run with verbose output
npm run test:e2e -- --grep "roundtrip" --verbose
```

---

## Data-TestID Reference

### Navigation
| Element | TestID | Type | Notes |
|---------|--------|------|-------|
| Library nav link | `library-nav-link` | a[href] | Navigate to LibraryPage |
| Library backend OPFS button | `library-backend-opfs` | button | Connect to OPFS storage |

### Library Tree (Center Panel)
| Element | TestID | Type | Notes |
|---------|--------|------|-------|
| Tone item in tree | `tone-item-{index}` | div | Clickable tone entry |
| Patch item in tree | `patch-item-{index}` | div | Clickable patch entry |
| Set item in tree | `set-item-{name}` | div | Clickable set entry |

### Item Preview (Right Panel)
| Element | TestID | Type | Notes |
|---------|--------|------|-------|
| Import button | `import-to-device-button` | button | Opens import dialog |
| Export button (tone) | `export-tone-button` | button | Opens export dialog |
| Export button (patch) | `export-patch-button` | button | Opens export dialog |

### Import Dialogs
| Element | TestID | Type | Dialog |
|---------|--------|------|--------|
| Success screen | `import-success` | div | Both tone & patch |
| Target slot select | `target-slot-select` | select | Both tone & patch |
| Slot occupied warning | `slot-occupied-warning` | p | Both tone & patch |
| Import progress | `import-progress` | div | Both tone & patch |
| Confirm button | `confirm-import-button` | button | Both tone & patch |
| Missing tone warning | `missing-tone-warning` | div | Patch import only |

### Export Dialogs
| Element | TestID | Type | Dialog |
|---------|--------|------|--------|
| Dialog wrapper | `export-dialog` | div | Both tone & patch |
| Cancel button | `export-cancel` | button | Both tone & patch |
| Confirm button | `export-confirm` | button | Both tone & patch |

### Tones/Patches Page
| Element | TestID | Type | Notes |
|---------|--------|------|-------|
| Tone item | `tone-item-{index}` | div | Grid/list entry |
| Tone name | `tone-name` | span/div | Display name |
| Export button | `export-tone-button` | button | Trigger export |
| Patch item | `patch-item-{index}` | div | Grid/list entry |
| Patch name | `patch-name` | span/div | Display name |
| Export button | `export-patch-button` | button | Trigger export |

### Device Memory Panel (Left Panel)
| Element | TestID | Type | Notes |
|---------|--------|------|-------|
| Tone slot item | `device-tone-{index}` | div | Draggable tone |
| Patch slot item | `device-patch-{index}` | div | Draggable patch |

---

## Known Gaps & Limitations

### 1. Missing TestIDs for Import Dialog Fields
The following controls in ImportLibraryToneDialog lack testids:
- Target dropdown (label: "Target")
- Wave Bank dropdown
- Segment dropdown
- Find Best Fit button
- BestFitPicker overlay

**Workaround**: Use Playwright selectors like:
```typescript
// Find the second select (after target slot)
const waveBankSelect = page.locator('select').nth(1);

// Find button by text
await page.locator('button:has-text("Find Best Fit")').click();
```

### 2. Library Tree Selection is Hierarchical
The library supports nested directories for tones/patches. Selecting a nested item requires:
```typescript
// If tone is in library/s330/tones/subfolder/tone-name.yaml
// Must expand all ancestor directories first (or click directly if visible)
```

No expansion testids exist. You may need to scroll or use locator matching.

### 3. WAV File Creation
No built-in fixture helper for generating test WAV files. Current approach:
- Embed minimal WAV bytes in test code
- Use `createWav()` helper from sampler-library (but it requires OPFS context)
- Pre-generate WAV files and commit them to repo (not ideal)

**Recommendation**: Add a test helper `createTestWav(sampleRate, durationSeconds, loopMode)` to generate WAVs in Node.

### 4. No Direct YAML Parsing in Browser Context
OPFS helpers can read YAML files as text, but parsing must happen in Node/test context:
```typescript
// In browser context
const yamlText = await readFile(...);

// Back in Node context
import YAML from 'yaml';
const parsed = YAML.parse(yamlText);
```

The library-service has YAML helpers (`parseYaml`, `stringifyYaml`) but they're not exposed in test helpers.

### 5. Device Memory Takes Time to Load
After import, tones appear in left panel but with a delay:
```typescript
// Wait for the tone to appear in device memory
await expect(page.locator('[data-testid="device-tone-0"]')).toBeVisible({
  timeout: 5000,
});
```

No hook to know when device state is fully synchronized.

### 6. Export Names Are Auto-Derived
When exporting, the dialog pre-fills the tone/patch name from the device object. For roundtrip tests:
- Original fixture name: `roundtrip-test`
- Imported to device: `RoundtripTest` (as display name)
- Exported from device: Uses the device object's name (may differ from original file name)
- After export: File is `{device-name}.yaml` not `roundtrip-test.yaml`

**For roundtrip verification**: Compare YAML content (structure/params), not file names.

### 7. Library Connection UI May Vary
The OPFS connection button location/style not deeply tested. Current selector:
```typescript
await page.locator('[data-testid="library-backend-opfs"]').click();
```

If this fails, check the actual LibraryPage implementation for where the button is rendered.

---

## Running Isolated Tests

### Basic Command
```bash
# From repo root
npm run test:e2e -- --grep "pattern"

# Example: Run only roundtrip tests
npm run test:e2e -- --grep "roundtrip"
```

### With Configuration
See `/scripts/run-http-midi-e2e.sh` for hardware tests. For OPFS-only roundtrip tests:

```bash
# Run without hardware (if app supports mock MIDI)
npm run test:e2e -- \
  --grep "roundtrip" \
  --project chromium \
  modules/roland-sxx0-editor/e2e/roundtrip.spec.ts
```

### Debugging a Test
```bash
# Run with headed browser (see what's happening)
npm run test:e2e -- --grep "roundtrip" --headed

# Run with debug mode (opens inspector)
npm run test:e2e -- --grep "roundtrip" --debug

# Show full logs
npm run test:e2e -- --grep "roundtrip" --verbose
```

### Retry Failed Test
```bash
# Retry only failed tests
npm run test:e2e -- --grep "roundtrip" --retries 2
```

### Filter by Test Name
```bash
# Exact test name
npm run test:e2e -- --grep "^tone roundtrip: create → import → export → verify$"

# Multiple patterns
npm run test:e2e -- --grep "(roundtrip|import|export)"
```

---

## Summary Checklist for Test Design

- [x] Understand import flow: library → select → import dialog → configure → device
- [x] Understand export flow: device tones page → export dialog → configure → library
- [x] YAML structure for tones (format, device, s330 extension, wave params)
- [x] YAML structure for patches (format, device, s330 extension, tone layers)
- [x] OPFS directory layout (library/{device}/{type}/{files})
- [x] WAV file requirements (sample rate, bit depth, length)
- [x] Data-testids for critical UI elements
- [x] Helper function patterns (OPFS, connection, navigation)
- [x] Known gaps and workarounds
- [x] Test patterns (setup → fixture → import → export → verify)
- [x] Running isolated tests with --grep

---

## Next Steps

1. **Create a fixture factory**: Helper that generates valid tone/patch YAML + WAV files
2. **Implement base roundtrip test**: Single tone, simple parameters
3. **Add variants**: Tone with LFO/TVF, patch with multiple tones, nested directories
4. **Add comparison logic**: Verify exported tone matches original (within reasonable tolerance for encoding)
5. **Document in test file**: Add JSDoc comments explaining the fixture format and test flow
6. **Handle edge cases**: Overwriting existing slots, slot allocation, memory pressure

