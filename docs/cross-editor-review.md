# Cross-Editor Code Review: S-330, D-110, and JV-1080 Editors

This document provides a comprehensive analysis of the three Roland synthesizer/sampler web editors in the audiocontrol monorepo, identifying code duplication, inconsistent patterns, and opportunities for shared libraries.

## Executive Summary

The three editors share significant structural similarities but have diverged in implementation maturity and patterns:

| Editor | Maturity | Styling | Shared Libs | Key Features |
|--------|----------|---------|-------------|--------------|
| S-330 | Most mature | Tailwind + custom theme | EditorLayout, shared-midi | Video capture drawer, envelope editor, patch/tone management |
| D-110 | Mature | Tailwind + custom theme | EditorLayout, shared-midi | Full tone/partial editor, envelope visualization |
| JV-1080 | Early scaffold | Vanilla CSS | shared-midi only | Basic MIDI connection, system controls |

### Critical Findings

1. **High Code Duplication**: MIDI stores are 80%+ identical across all three editors
2. **Inconsistent UI Components**: Each editor has its own MidiPortSelector, HomePage, and ParameterSlider with minor variations
3. **Missed Shared Library Opportunities**: EditorLayout exists but JV-1080 does not use it
4. **Styling Fragmentation**: Three different CSS/theming approaches

---

## 1. Component Structure Analysis

### App.tsx Patterns

**S-330 (`modules/s330-editor/src/App.tsx`)**
```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
// BrowserRouter is in main.tsx with basename="/roland/s330/editor"
```

**D-110 (`modules/d110-editor/src/App.tsx`)**
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// BrowserRouter is inline with basename="/roland/d110/editor"
```

**JV-1080 (`modules/jv1080-editor/src/App.tsx`)**
```typescript
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
// BrowserRouter is in main.tsx with basename="/roland/jv1080/editor"
```

**Issues Identified:**
- Inconsistent BrowserRouter placement (main.tsx vs App.tsx)
- D-110 has BrowserRouter in App.tsx while others have it in main.tsx

**Recommendation:** Standardize on BrowserRouter in main.tsx for all editors.

---

### Layout Component Patterns

**S-330 and D-110**: Both use the shared `@audiocontrol/editor-tools` EditorLayout component with device-specific themes:

```typescript
// S-330 Layout.tsx
import { EditorLayout, PanicButton, MidiStatusDisplay } from '@audiocontrol/editor-tools';

const s330Theme = {
  bgPrimary: '#0f172a',      // slate-900
  bgPanel: '#1e293b',        // slate-800
  // ...
};

const layoutConfig: EditorLayoutConfig = {
  editorName: 'S-330',
  editorSubtitle: 'Roland Sampler',
  navItems: [...],
  theme: s330Theme,
  // ...
};
```

**JV-1080**: Does NOT use EditorLayout - has a minimal custom implementation:

```typescript
// JV-1080 Layout.tsx - completely custom, no shared components
export function Layout({ children }: PropsWithChildren): JSX.Element {
  return (
    <div className="app-shell">
      <header className="panel">
        <h1>Roland JV-1080 Editor</h1>
        <nav className="row">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/editor">Editor</NavLink>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

**Issues Identified:**
- JV-1080 does not use the shared EditorLayout, PanicButton, or MidiStatusDisplay
- Missing build info display, proper navigation styling, and header organization
- No MIDI status indicator in header

**Recommendation:** Migrate JV-1080 to use EditorLayout from editor-tools with JV-1080-specific theme.

---

## 2. MIDI Communication Analysis

### MIDI Store Comparison

All three editors have nearly identical MIDI store implementations. Here is the shared pattern:

**Common Structure (90%+ identical):**
```typescript
// localStorage key pattern
const STORAGE_KEY_INPUT = '{device}-midi-input';
const STORAGE_KEY_OUTPUT = '{device}-midi-output';
const STORAGE_KEY_DEVICE_ID = '{device}-device-id';

// Storage helpers (identical across all)
function saveToStorage(inputId, outputId, deviceId): void { ... }
function loadFromStorage(): { inputId, outputId, deviceId } { ... }

// Store interface (nearly identical)
interface MidiState {
  isSupported: boolean;
  browserInfo: { supported: boolean; browser: string; notes: string };
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  status: ConnectionStatus;
  error: string | null;
  selectedInputId: string | null;
  selectedOutputId: string | null;
  deviceId: number;
  midiAccess: MIDIAccess | null;
  openPorts: { input: MIDIInput | null; output: MIDIOutput | null };
  // Device-specific: adapter and/or client
}

// Actions (nearly identical)
interface MidiActions {
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  connect: (inputId: string, outputId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setDeviceId: (id: number) => void;
}
```

**Key Differences:**

| Aspect | S-330 | D-110 | JV-1080 |
|--------|-------|-------|---------|
| Device ID Range | 0-16 (display 1-17) | 17-32 | 0-127 |
| Default Device ID | 0 | 17 | 16 |
| Client Creation | External (from sampler-devices) | Inline (createD110Client) | Inline (new Jv1080Client) |
| sendPanic method | Yes | Yes | No |
| sysExEnabled tracking | Yes | Yes | No |
| selectedInput/Output objects | Yes | Yes | No (only IDs) |

**D-110 Unique:**
- Has `client` in state for the D110ClientInterface
- Recreates client when deviceId changes

**JV-1080 Unique:**
- Uses different action pattern: `setSelectedInputId`/`setSelectedOutputId` instead of storing during connect
- Has `connect()` with no parameters (uses state values)
- Missing `sendPanic` method
- Missing `sysExEnabled` tracking

**Code Duplication Analysis:**

Lines of duplicated code across the three midiStore.ts files:
- saveToStorage/loadFromStorage: ~40 lines (identical except storage keys)
- initialize method: ~40 lines (95% identical)
- refresh method: ~30 lines (98% identical)
- connect method: ~40 lines (80% identical)
- disconnect method: ~20 lines (90% identical)

**Estimated duplicated code: 150+ lines per editor (450+ total)**

**Recommendation:** Create a shared `createMidiStore` factory function in a new `@audiocontrol/editor-midi` package:

```typescript
// Proposed shared factory
interface MidiStoreConfig<TClient> {
  deviceName: string;  // for storage keys and logging
  defaultDeviceId: number;
  deviceIdRange: { min: number; max: number };
  createClient?: (adapter: MidiIO, deviceId: number) => TClient;
  hasLegacyDeviceIdDisplay?: boolean;  // S-330 displays +1
}

export function createMidiStore<TClient>(config: MidiStoreConfig<TClient>) {
  return create<MidiStore>((set, get) => ({
    // Common implementation with config-driven variations
  }));
}
```

---

### MidiPortSelector Component Comparison

**S-330 and D-110**: Nearly identical implementations using Radix UI Select:

```typescript
// Both use Radix UI with nearly identical JSX structure
import * as Select from '@radix-ui/react-select';

// Differences are only in CSS class prefixes:
// S-330: text-s330-text, bg-s330-bg, etc.
// D-110: text-d110-text, bg-d110-surface, etc.
```

**JV-1080**: Simple native `<select>` element:

```typescript
export function MidiPortSelector({ ... }) {
  return (
    <div className="col">
      <label>{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">Select a port...</option>
        {ports.map((port) => (
          <option key={port.id} value={port.id}>
            {port.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

**Issues Identified:**
- S-330 and D-110 have ~100 lines of nearly identical code (differs only in CSS classes)
- JV-1080 uses a much simpler implementation without Radix UI
- No connection status indicator in JV-1080's port selector

**Recommendation:** Create a shared MidiPortSelector in `@audiocontrol/editor-tools`:

```typescript
interface MidiPortSelectorProps {
  label: string;
  ports: MidiPortInfo[];
  value: string | null;
  onChange: (portId: string) => void;
  disabled?: boolean;
  variant?: 'radix' | 'native';  // For progressive enhancement
  // Theme passed via context or CSS variables
}
```

---

## 3. State Management Analysis

### Store Patterns

**S-330 Uses Multiple Stores:**
- `midiStore.ts` - MIDI connection
- `s330Store.ts` - UI state (selection, loading, hardware sync)
- `uiStore.ts` - UI-specific state (drawer, sidebar width)
- `deviceDataStore.ts` - (index reference)

**D-110 Uses Multiple Stores:**
- `midiStore.ts` - MIDI connection with embedded client
- `d110Store.ts` - Full device data (tones, patches, parts) with update methods

**JV-1080 Uses Single Store:**
- `midiStore.ts` - MIDI connection only (no separate UI or device store)

**D-110 Store Analysis:**

The D-110 store is significantly larger (~400 lines) because it includes all tone/patch data management:

```typescript
interface D110State {
  tones: Map<number, D110Tone>;
  systemParams: SystemParams | null;
  partConfigs: PartConfig[];
  patch: D110Patch | null;
  selectedPart: number;
  selectedPartial: number;
  // ... plus UI state
}

// Includes many granular update methods:
updatePartialParams, updatePitchEnvelope, updateTvfEnvelope,
updateTvaEnvelope, updateLfo, updateToneCommon, ...
```

**S-330 Store Analysis:**

The S-330 store is simpler (~130 lines) because it delegates data caching to the S330Client:

```typescript
interface S330State {
  selectedPatchIndex: number | null;
  selectedToneIndex: number | null;
  isLoading: boolean;
  loadingMessage: string | null;
  error: string | null;
  // Hardware sync versioning
  hardwareChangeVersion: number;
  lastHardwareChange: LastHardwareChange;
}
```

**Issues Identified:**
- No consistent pattern for device data storage
- D-110 embeds all data management in store; S-330 delegates to client
- JV-1080 has no device data store at all yet

**Recommendation:** Establish a standard pattern:
1. MIDI connection store (shared factory)
2. Device data store (device-specific, but with common UI state patterns)
3. UI store (if needed for drawer/panel states)

---

## 4. UI Components Analysis

### Parameter Controls

**S-330 ParameterSlider:**
```typescript
interface ParameterSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;  // For hardware sync on drag end
  min?: number;           // default: 0
  max?: number;           // default: 127
  step?: number;
  formatValue?: (value: number) => string;
  disabled?: boolean;
}
// Uses Radix UI Slider, ~65 lines
```

**D-110 ParameterSlider:**
```typescript
// Same interface, nearly identical implementation
// Also exports formatter utilities:
export const formatPercent, formatSigned, formatPitch, formatKeyfollow;
// ~107 lines total
```

**JV-1080**: No ParameterSlider component - uses native `<input type="number">`:
```typescript
<input type="number" min={0} max={127} value={value} onChange={...} />
```

**Issues Identified:**
- S-330 and D-110 ParameterSliders are nearly identical (~60 lines duplicated)
- D-110 has additional formatter utilities that could be shared
- JV-1080 lacks a proper slider component

**Recommendation:** Create shared ParameterSlider in `@audiocontrol/editor-tools`:
- Support both Radix slider and native range input
- Include common formatter utilities
- Theme via CSS variables

---

### Envelope Editors

**S-330 EnvelopeEditor:**
- 8-point envelope (levels + rates arrays)
- Expandable fullscreen mode
- Interactive SVG with drag support
- Sustain point and end point markers
- ~640 lines

**D-110 EnvelopeEditor:**
- 5-stage envelope (ADSR-style with variations)
- Three envelope types: pitch, tvf, tva
- Interactive SVG with drag support
- Table view for precise editing
- ~550 lines

**Issues Identified:**
- Both have complex SVG visualization with similar drag logic
- Core drag handling code is ~80% similar
- Grid rendering and point styling share common patterns

**Recommendation:** Create an abstract envelope visualization component:
```typescript
interface EnvelopeVisualizationProps<T> {
  points: EnvelopePoint[];
  sustainIndex?: number;
  releaseIndex?: number;
  onPointDrag: (index: number, level: number, time: number) => void;
  onDragEnd?: () => void;
  renderPoint?: (point, index, isSelected) => ReactNode;
  theme: EnvelopeTheme;
}
```

---

### Collapsible Sections

**D-110 uses inline CollapsibleSection:**
```typescript
function CollapsibleSection({ title, defaultOpen, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-d110-border rounded-md overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="...">
        <h4>{title}</h4>
        <span>{isOpen ? '-' : '+'}</span>
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
}
```

**S-330 and JV-1080**: No collapsible section component

**Recommendation:** Add to shared editor-tools library.

---

## 5. Hooks and Utilities Analysis

### Custom Hooks

**S-330 Hooks:**
- `useMidi.ts` - Alternative to store-based MIDI (seems unused/legacy)
- `useS330.ts` - S330Client wrapper with fetch operations
- `useFrontPanel.ts` - Front panel button state
- `useMidiLearn.ts` - MIDI learn functionality
- `useParameterListener.ts` - DT1 message parsing

**D-110 Hooks:** None - uses store directly

**JV-1080 Hooks:** None - uses store directly

**Issues Identified:**
- S-330 has both store-based and hook-based MIDI (useMidi seems redundant)
- No shared hook patterns across editors

**Recommendation:**
- Remove redundant `useMidi.ts` from S-330 (store handles it)
- Create shared hooks for common patterns (e.g., parameter change debouncing)

---

### Utility Functions

**S-330 utils.ts (~83 lines):**
```typescript
export function cn(...inputs: ClassValue[]): string;  // Tailwind merge
export function midiNoteToName(note: number): string;
export function formatPercent(value: number): string;
export function formatSigned(value: number): string;
export function formatPan(value: number): string;
export function debounce<T>(fn: T, ms: number): (...args) => void;
export function clamp(value: number, min: number, max: number): number;
export function formatS330Number(index: number): string;  // Device-specific
```

**D-110 utils.ts (~10 lines):**
```typescript
export function cn(...inputs: ClassValue[]): string;  // Only cn function
// Formatters are in ParameterSlider.tsx instead
```

**JV-1080:** No utils.ts file

**Issues Identified:**
- `cn()` function is duplicated in both S-330 and D-110
- Common formatters are scattered: S-330 in utils.ts, D-110 in ParameterSlider.tsx
- JV-1080 has no utilities

**Recommendation:** Create `@audiocontrol/editor-utils` package:
```typescript
// CSS utilities
export { cn } from './cn';

// MIDI formatters
export { midiNoteToName, formatPercent, formatSigned, formatPan } from './formatters';
export { formatKeyfollow, formatPitch } from './formatters';  // From D-110

// Common utilities
export { debounce, clamp } from './utils';
```

---

## 6. Type Definitions Analysis

### MIDI Types

**shared-midi (`modules/shared-midi/src/types.ts`):**
- `MidiPortInfo`, `SysExCallback`, `MidiIO`, `ConnectionStatus`
- `MidiConnectionState`, `WebMidiAccess`, `BrowserCompatibility`

All three editors re-export from shared-midi:
- S-330: `export type S330MidiIO = MidiIO;`
- D-110: `export type D110MidiIO = MidiIO;`
- JV-1080: Imports directly from shared-midi

**Issues Identified:**
- Device-specific type aliases (S330MidiIO, D110MidiIO) add no value
- Could simplify by using MidiIO directly

---

### Device-Specific Types

**D-110 (`core/midi/types.ts` - 278 lines):**
- Complete type definitions for D-110 protocol
- Enums for ToneGroup, AssignMode, OutputAssign, ReverbMode
- Interfaces for tones, partials, patches, envelopes, LFO

**S-330:**
- Types imported from `@audiocontrol/sampler-devices/s330`
- No local type definitions

**JV-1080:**
- Types in `system/systemControls.ts` and `system/fxControls.ts`
- Not in a dedicated types file

**Recommendation:** Standardize type organization:
1. Device protocol types in `@audiocontrol/sampler-devices/{device}`
2. Editor-specific UI types in `src/types/`
3. Re-export convenience types from `src/core/midi/types.ts`

---

## 7. Styling Analysis

### CSS Approaches

**S-330:**
- Tailwind CSS with custom theme
- Theme colors in `tailwind.config.ts` under `s330-*` namespace
- Custom components in `index.css` using `@apply`
- Consistent use of theme variables

**D-110:**
- Tailwind CSS with custom theme
- Theme colors under `d110-*` namespace
- Similar structure to S-330

**JV-1080:**
- Vanilla CSS (no Tailwind)
- Custom CSS classes: `.panel`, `.row`, `.col`, `.status`
- Inline styles in components
- No theme variables

**Color Scheme Comparison:**

| Role | S-330 | D-110 | JV-1080 |
|------|-------|-------|---------|
| Primary BG | slate-900 (#0f172a) | gray-900 (#111827) | Radial gradient (#0e1118) |
| Panel BG | slate-800 (#1e293b) | gray-800 (#1f2937) | Semi-transparent (#161b26) |
| Border | slate-700 (#334155) | gray-700 (#374151) | #3a4255 |
| Text | slate-100 (#f1f5f9) | gray-200 (#e5e7eb) | #ebedf2 |
| Muted | slate-400 (#94a3b8) | gray-500 (#6b7280) | #b6bdd0 |
| Highlight | sky-400 (#38bdf8) | blue-400 (#60a5fa) | #9ed0ff |

**Issues Identified:**
- Three different styling systems
- JV-1080 doesn't use Tailwind at all
- No shared color tokens or design system

**Recommendation:**
1. Migrate JV-1080 to Tailwind
2. Create shared design tokens in a CSS variables file
3. Each editor extends base tokens with device-specific accents

---

## 8. HomePage/Connection Page Analysis

The HomePage (MIDI connection page) is nearly identical across S-330 and D-110 (~230 lines each), differing only in:
- Device name references
- CSS class prefixes
- Device ID range and display format
- Navigation destination after connect

**Duplicated Sections:**
- Browser compatibility warning (~40 lines)
- Secure context warning (~20 lines, S-330 only)
- SysEx warning (~15 lines)
- Error display (~10 lines)
- Port selection grid (~30 lines)
- Action buttons (~30 lines)
- Device ID selector (~40 lines)
- Help card (~30 lines)

**JV-1080 HomePage:** Much simpler (~85 lines), missing:
- Browser compatibility warnings
- SysEx warnings
- Help section
- Continue to editor button
- Styled device ID selector

**Recommendation:** Create a shared `MidiConnectionPage` component:

```typescript
interface MidiConnectionPageConfig {
  deviceName: string;
  deviceIdConfig: {
    min: number;
    max: number;
    default: number;
    displayOffset?: number;  // S-330 displays +1
    helpText: string;
  };
  helpItems: HelpItem[];
  continueRoute: string;
  continueLable: string;
}

export function MidiConnectionPage({ config, midiStore }) { ... }
```

This could reduce ~230 lines x 2 = 460 lines down to ~50 lines per editor (config only).

---

## 9. Recommendations Summary

### Immediate Actions (Low Effort, High Impact)

1. **Migrate JV-1080 to use EditorLayout** from editor-tools
   - Adds consistent header, navigation, and build info
   - Estimated effort: 2-4 hours

2. **Move BrowserRouter to main.tsx** in D-110
   - Consistency with S-330 and JV-1080
   - Estimated effort: 30 minutes

3. **Add sendPanic to JV-1080 midiStore**
   - Copy from S-330/D-110
   - Estimated effort: 30 minutes

### Medium-Term Actions (Create Shared Libraries)

4. **Create shared MidiStore factory** (`@audiocontrol/editor-midi`)
   - Eliminates ~150 lines of duplication per editor
   - Standardizes MIDI connection handling
   - Estimated effort: 1-2 days

5. **Add shared UI components to editor-tools**
   - MidiPortSelector (Radix-based)
   - ParameterSlider with formatters
   - CollapsibleSection
   - Estimated effort: 2-3 days

6. **Create MidiConnectionPage component**
   - Config-driven connection page
   - Handles warnings, port selection, device ID
   - Estimated effort: 1-2 days

7. **Migrate JV-1080 to Tailwind**
   - Enables use of shared components
   - Consistent styling approach
   - Estimated effort: 1 day

### Long-Term Actions (Architecture)

8. **Create shared envelope visualization library**
   - Abstract base for different envelope types
   - Reusable SVG drag handling
   - Estimated effort: 3-5 days

9. **Establish device data store pattern**
   - Common UI state (selection, loading, error)
   - Device-specific data (tones, patches)
   - Estimated effort: Design + migration = 1 week

10. **Create design system tokens**
    - Shared CSS variables for colors, spacing
    - Device-specific theme overrides
    - Estimated effort: 2-3 days

---

## 10. Proposed Shared Package Structure

```
modules/
  editor-core/                     # NEW: Shared editor infrastructure
    src/
      stores/
        createMidiStore.ts         # Factory for MIDI stores
        createUIStore.ts           # Common UI state patterns
      components/
        MidiConnectionPage.tsx     # Config-driven connection page
        MidiPortSelector.tsx       # Shared port selector
        ParameterSlider.tsx        # With formatters
        CollapsibleSection.tsx
        EnvelopeVisualization.tsx  # Base envelope component
      hooks/
        useParameterDebounce.ts
        useHardwareSync.ts
      utils/
        formatters.ts              # MIDI value formatters
        cn.ts                      # Tailwind merge
        clamp.ts
      types/
        store.ts                   # Common store interfaces
        component.ts               # Common component props
      design/
        tokens.css                 # CSS variables
        themes/
          base.css
          s330.css
          d110.css
          jv1080.css
```

---

## 11. Migration Priority Matrix

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| JV-1080 use EditorLayout | High | Low | P1 |
| Standardize BrowserRouter | Medium | Low | P1 |
| Add sendPanic to JV-1080 | Medium | Low | P1 |
| Shared MidiStore factory | High | Medium | P2 |
| Shared MidiPortSelector | Medium | Medium | P2 |
| Shared ParameterSlider | Medium | Medium | P2 |
| MidiConnectionPage component | High | Medium | P2 |
| JV-1080 Tailwind migration | High | Medium | P2 |
| Design system tokens | Medium | Medium | P3 |
| Shared envelope base | Medium | High | P3 |
| Device store patterns | Medium | High | P3 |

---

## 12. Conclusion

The three editors have significant code duplication, particularly in:
- MIDI store implementations (~450 lines duplicated)
- MidiPortSelector components (~200 lines duplicated)
- HomePage connection pages (~400 lines duplicated)
- Utility functions (~60 lines duplicated)

Total estimated duplicated code: **~1,100 lines**

By implementing the shared libraries proposed above, we could:
- Reduce duplicated code by 80%
- Ensure consistent behavior across editors
- Simplify future editor development
- Enable easier theming and customization

The JV-1080 editor is at an ideal stage for applying these patterns from the start, while S-330 and D-110 can be migrated incrementally.
