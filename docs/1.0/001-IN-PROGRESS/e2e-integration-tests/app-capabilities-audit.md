# Application Capabilities Audit: Roland S-330/S-550 Editor

**Generated:** 2026-03-29
**Purpose:** Comprehensive audit of all capabilities for E2E test planning

## Pages/Routes

The application has 5 main pages:

### 1. Home Page (`/`) - MIDI Connection Setup
- **Requires Hardware:** Yes (device connected via MIDI)
- **Features:**
  - Device type selection (S-330 / S-550)
  - MIDI port selection (input/output dropdowns)
  - Device ID configuration (1-17)
  - Transport selection (Web MIDI / HTTP MIDI Server)
  - SysEx permission validation
- **Status:** Gated entry point - must connect before accessing other pages

### 2. Patches Page (`/patches`) - Patch Viewing & Editing
- **Requires Hardware:** Yes
- **Features:**
  - View and edit all patches (S-330: 16, S-550: 32)
  - Progressive bank loading (8 patches per bank)
  - Patch name editing
  - Key mode selection (normal, v-sw, x-fade, v-mix, unison)
  - Bender range configuration
  - Tone zone assignment and editing
  - Parameter ranges (velocity, key zones, tone layer mixing)
  - Bank reload capability
  - Export patch to library
- **Status:** Fully implemented

### 3. Tones Page (`/tones`) - Tone Viewing & Editing
- **Requires Hardware:** Yes
- **Features:**
  - View and edit all tones (S-330: 32, S-550: 64)
  - Progressive bank loading (8 tones per bank)
  - Tone name and sample rate editing
  - Original key/transposition
  - Wave parameters (start, end, loop points, loop mode)
  - LFO configuration
  - TVA (amplifier) envelope editor with 8 points
  - TVF (filter) envelope editor with 8 points
  - Pitch bend range and aftertouch controls
  - Loop editor UI with audio preview
  - Sample export as WAV download
  - Sample import from local file
  - Export tone to library
- **Status:** Fully implemented

### 4. Play Page (`/play`) - Multi-mode Configuration
- **Requires Hardware:** Yes
- **Features:**
  - Configure 8 MIDI parts (A-H, channels 1-8)
  - Set patch assignment per part
  - Configure MIDI channel routing (1-16)
  - Set output routing (1-8 individual outputs)
  - Adjust part level/volume (0-127)
  - Load and display function parameters
- **Status:** Fully implemented

### 5. Library Page (`/library`) - Library Management
- **Requires Hardware:** Yes (device connected) + Library connection
- **Layout:** Three-panel design
  - Left Panel: Device Memory (tones/patches on device)
  - Center Panel: Library Browser (tree view)
  - Right Panel: Preview pane with actions
- **Features:**
  - Load/save complete sets to/from library
  - Import individual tones from library to device
  - Import individual patches from library to device
  - Import drum kit bundles (v1 and v2 formats)
  - Import common samples (chopped samples)
  - Export device tones to library
  - Export device patches to library
  - Directory operations (create, rename, delete, move)
  - Loop editor integration for library samples
  - Sample chopper (slice editor)
  - Sample editor (audio modification)
  - Drum kit slice editor
- **Status:** Marked as "Experimental" - core functionality present

---

## Core MIDI Operations

All operations support both S-330 and S-550 via device-agnostic `SamplerClientInterface`.

### Device Communication (Requires Hardware)
- MIDI input/output port selection
- Device ID configuration (0-16 protocol, displayed as 1-17)
- SysEx handshake and validation
- Transport selection (Web MIDI vs HTTP MIDI)

### Patch Operations (Requires Hardware)
- Load patches from device (progressive bank loading)
- Edit patch names
- Configure patch parameters (key mode, bender range, etc.)
- Edit tone zone assignments (velocity/key ranges)
- Send patch changes to device via DT1 SysEx

### Tone Operations (Requires Hardware)
- Load tones from device (progressive bank loading)
- Edit tone names and parameters
- Edit wave parameters (start, end, loop points, loop mode)
- Edit envelope parameters (TVA, TVF)
- Sample export as WAV file
- Sample import from WAV file
- Send tone changes to device via DT1 SysEx

### Multi-mode Operations (Requires Hardware)
- Load function parameters (part assignments)
- Configure MIDI parts (channel, patch, output, volume)
- Send parameter updates to device

---

## Library Operations

### Storage Backends
- **Local File System** (File System Access API)
- **OPFS** (Origin Private File System) - used for E2E tests
- **Google Drive** (optional cloud integration)

### Library Structure
```
library/
├── s330/
│   ├── tones/           # Individual tones
│   └── patches/         # Individual patches
├── common/
│   ├── samples/         # Chopped samples
│   └── drum-kits/       # Drum kit bundles
└── sets/                # Complete performance sets
```

### Set Operations (Requires Library Connection)
- Save current device state to library set
- Load complete set from library to device
- Target block selection (S-550 only)
- Wave bank assignment
- Progress tracking

### Tone/Patch Import (Requires Library + Hardware)
- Import individual tone from library to device slot
- Import individual patch from library to device slot
- Slot availability checking
- Preview before import
- Progress tracking

### Drum Kit Import (Requires Library + Hardware)
- v1 format: Individual WAV files per sample
- v2 format: Monolithic WAV + slice definitions
- Automatic MIDI note assignment
- Automatic tone and patch generation

### Directory Operations (Requires Library Connection)
- Create directories in library categories
- Rename directories
- Delete directories (with confirmation)
- Move items between directories

---

## UI Components

### Editor Components
- **ToneEditor** - Full tone parameter editing
- **PatchEditor** - Patch configuration with zone mapping
- **ToneZoneEditor** - Individual zone configuration
- **EnvelopeEditor** - 8-point envelope editing (TVA/TVF)
- **EnvelopeDisplay** - Visual envelope graph
- **ParameterSlider** - Labeled parameter controls
- **LoopEditor** - Loop point visualization and adjustment

### Library Components
- **DeviceMemoryPanel** - Device tones/patches view
- **PluginLibraryTreePanel** - Library browser
- **ItemPreviewPanel** - Preview pane
- **SampleBundlePreviewPanel** - Drum kit preview
- **CommonSamplePreviewPanel** - Chopped sample preview

### Dialogs
- SaveSetDialog, LoadSetDialog
- ImportLibraryToneDialog, ImportLibraryPatchDialog
- ImportSamplesDialog (drum kits)
- ExportToneDialog, ExportPatchDialog
- CreateDirectoryDialog, RenameDirectoryDialog, DeleteDirectoryDialog
- MoveItemDialog
- LoopEditorDialog, SampleChopperDialog, SampleEditorDialog

### List Components
- **ToneList** - Scrollable tone list with bank indicators
- **PatchList** - Scrollable patch list with bank indicators
- **BestFitPicker** - Intelligent tone selection

---

## State Management (Stores)

### MIDI Store
- Connection status
- MIDI adapter instance
- Device ID
- Device type (S-330/S-550)
- Exposed to window for E2E testing access

### Device Data Store
- Cached patches (sparse array)
- Cached tones (sparse array)
- Bank load tracking
- Cache invalidation on device switch

### Editor Store
- Selection state
- Loading state
- Error messages

### Library Store
- Sets list
- UI expansion state
- Loading/error state

---

## Device Configurations

### S-330
- 16 patches (2 banks × 8)
- 32 tones (4 banks × 8)
- 2 wave banks (A, B)
- Patch labels: "P11-P28"
- Tone labels: "T11-T42"

### S-550
- 32 patches (4 banks × 8)
- 64 tones (8 banks × 8, 2 blocks)
- 4 wave banks (A, B, C, D)
- Patch labels with Roman numerals
- Tone labels: Two blocks

---

## Features Summary by Hardware Requirement

### Requires Hardware
- MIDI connection setup and device detection
- Loading patches/tones from device
- Saving patch/tone changes to device
- Sample upload to device
- Sample download from device
- Multi-mode configuration
- Function parameter loading
- Import from library to device
- Export from device to library

### No Hardware Required (UI-Only)
- Envelope editing (local state)
- Parameter configuration (local state)
- Library browsing and organization
- Sample metadata editing
- Loop editor (with pre-loaded data)
- Sample chopper (with pre-loaded data)
- Sample editor (with pre-loaded data)
- Directory management in library

### Experimental/Partial Features
- Library page (core works, UX refinement ongoing)
- Workflows page (referenced but not implemented)
- Virtual front panel (component exists, not integrated)
