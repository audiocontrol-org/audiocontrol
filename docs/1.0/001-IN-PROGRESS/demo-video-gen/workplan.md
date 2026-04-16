# Demo Video Generator - Workplan

## GitHub Tracking

**GitHub Milestone:** TBD
**GitHub Issues:**
- #265 — Create infrastructure for a demo video generator (parent)
- #267 — Add video preview gallery (Phase 4)
- #271 — Port videocontrol repo into audiocontrol monorepo (Phase 5)
- #268 — Add video publishing and versioning (Phase 6)
- #269 — Add gallery-triggered video generation (Phase 7)
- #270 — Add text overlay rendering (Phase 8)
- #296 — Add generation progress indicator (Phase 9)

## Technical Approach

Use Playwright's built-in `recordVideo` to capture browser interactions as WebM. Demo scenarios are TypeScript files that each export a function driving Playwright actions and a captions array with timestamps. A scenario runner loads scenarios, launches Playwright, records video, and collects captions. ffmpeg converts WebM to MP4 and GIF. A YAML captions file is output matching @videocontrol/text-overlay's project format. Scenarios declare their mode: harness (test harness with fixture data) or device (real hardware).

### Key Design Decisions

- **Scenario as code:** Each scenario is a TypeScript file exporting a well-typed interface, not a config file or DSL. This gives full access to Playwright's API and TypeScript's type system.
- **Two modes:** Harness mode uses the editor's test harness with fixture data (no device required). Device mode connects to real hardware and is flagged in scenario metadata so CI can skip it.
- **Three output tiers:** Silent (raw video only), captioned (video + text-overlay YAML), scripted (YAML + VO script). Each tier is a superset of the previous.
- **ffmpeg for conversion:** Playwright records WebM natively. ffmpeg handles the conversion to MP4 (broad compatibility) and GIF (embeddable previews).

## Implementation Phases

---

### Phase 1: Infrastructure

**Goal:** Establish the scenario runner, video capture pipeline, and Make targets.

**Tasks:**

- [x] Create `modules/video-control/` with TypeScript project setup (package.json, tsconfig.json)
- [x] Define the scenario interface: function signature (`(page: Page) => Promise<void>`), metadata type (name, description, mode, output tier)
- [x] Implement the scenario runner: load scenario module, launch Playwright with `recordVideo` options, execute scenario function, close browser, collect video file
- [x] Implement ffmpeg conversion: WebM to MP4 (h264, crf 23), WebM to GIF (palette-based, max 15fps for size)
- [x] Add Make targets: `make demo-scenario SCENARIO=<name>`, `make demo-all`, `make demo-device`
- [x] Create one "hello world" scenario that opens a page, performs a simple interaction, and exits
- [x] Define output directory structure: `dist/demos/<scenario-name>/` containing video.mp4, video.gif, and source .webm

- [x] Create VIDEO-DEMOS.md with script-first authoring process and pacing guidelines

**Acceptance:** Running `make demo-scenario SCENARIO=hello-world` produces MP4 and GIF in `dist/demos/hello-world/`.

---

### Phase 2: Caption Generation

**Goal:** Extend scenario output to include timed captions and VO scripts.

**Tasks:**

- [x] Extend scenario interface to include captions array: `{ text: string, timestampMs: number, durationMs: number, type: 'title' | 'callout' | 'step' }`
- [x] Implement YAML generation (hand-built strings, no library dependency)
- [x] Integrate caption output into scenario runner pipeline (output alongside video files)
- [x] Implement VO script output: generate a plain-text script with timestamps derived from caption data
- [x] Add output tier selection to Make targets: `TIER=silent|captioned|scripted` and `--tier` CLI flag

**Acceptance:** Running a scenario with captions produces a `.yaml` file valid for text-overlay and (if tier=scripted) a `.txt` VO script.

---

### Phase 3: First Scenarios

**Goal:** Create real demo scenarios for existing editors.

**Tasks:**

- [x] Create scenario: S3000XL draggable zones demo (harness mode) -- navigate to zone editor, drag zone boundaries, show visual feedback
- [x] Create scenario: Roland S-330 library browser (harness mode) -- browse library tree, select items, show metadata panel
- [ ] Create scenario: S3000XL sample transfer (device mode, optional) -- connect to device, initiate transfer, show progress
- [x] Add captions to all scenarios (callouts for key interactions, step labels for phases)
- [x] Integrate all scenarios into `make demo-all`
- [x] Verify harness scenarios run without any device connected
- [x] Document scenario authoring guide in VIDEO-DEMOS.md

**Acceptance:** Each scenario produces MP4, GIF, and captions YAML. Harness scenarios run without a device. `make demo-all` runs all harness scenarios and skips device scenarios unless hardware is available.

---

### Phase 4: Video Preview Gallery

**Goal:** A local Vite-served gallery page for browsing and previewing generated demo videos without regenerating them.

**Tasks:**

- [x] Add Vite as a dev dependency to video-control with a minimal `vite.config.ts`
- [x] Create gallery HTML page that displays available demos as a card grid
- [x] Implement dev server plugin that scans `dist/demos/*/` for existing video outputs via `/api/demos` endpoint
- [x] Each video card shows: GIF thumbnail, scenario name, duration, playable MP4, links to captions YAML and VO script (if present)
- [x] Add Make target: `make demo-preview` to start the Vite dev server serving the gallery
- [x] Gallery auto-refreshes when new videos are generated (polls `/api/demos` every 5s)

**Acceptance:** `make demo-preview` opens a local page listing all generated demos with playable video previews. Adding a new video via `make demo-scenario` causes the gallery to update without restart.

---

### Phase 5: Port videocontrol Repo

**Goal:** Port all modules from the standalone `audiocontrol-org/videocontrol` repo into `modules/video-control/` and deprecate the standalone repo. Makes video-core, text-overlay, and phosphor-scope available for subsequent phases.

**Tasks:**

- [x] Clone and inventory `audiocontrol-org/videocontrol` (video-core, text-overlay, phosphor-scope)
- [x] Port modules into `modules/video-control/packages/` (video-core, text-overlay, phosphor-scope)
- [x] Update package names from `@videocontrol/*` to `@audiocontrol/*`
- [x] Update internal cross-references and imports between ported packages
- [x] Wire ported packages into pnpm workspace (update `pnpm-workspace.yaml`)
- [x] Verify all tests pass for ported modules (video-core: 43/43, text-overlay: typecheck pass, phosphor-scope: typecheck pass)
- [x] Update video-control's existing code to use ported text-overlay format (captions YAML now conforms to ProjectSchema)
- [x] Add deprecation notice to `audiocontrol-org/videocontrol` README
- [x] Archive the standalone repo on GitHub

**Acceptance:** All three ported modules build and pass tests within the audiocontrol monorepo. The standalone videocontrol repo is archived with a deprecation notice pointing to the new location.

---

### Phase 6: Video Publishing & Versioning (was Phase 5)

**Goal:** Publish generated videos to durable storage with per-scenario revision history so videos aren't fragile local-only artifacts.

**Tasks:**

- [ ] Research storage backend options (GitHub Releases, S3/R2, Git LFS, Netlify assets, etc.) and document trade-offs
- [ ] Select storage backend based on research findings
- [ ] Implement publish command: `make demo-publish SCENARIO=<name>` uploads video + metadata to storage
- [ ] Add per-scenario revision tracking: each publish records date, git commit hash, and scenario file checksum
- [ ] Implement revision listing: `make demo-versions SCENARIO=<name>` shows revision history
- [ ] Update gallery to display published versions alongside local drafts
- [ ] Add `make demo-publish-all` to publish all current scenarios

**Acceptance:** Running `make demo-publish SCENARIO=s3k-zone-editor` uploads the video to the selected storage backend. Running it again creates a new revision, preserving the previous one. `make demo-versions` lists all revisions with dates and commit hashes.

---

### Phase 7: Gallery-Triggered Generation (was Phase 6)

**Goal:** Regenerate scenario videos from the gallery UI without leaving the browser.

**Tasks:**

- [x] Add `/api/generate` POST endpoint to the Vite dev server that runs a scenario by name (spawns `tsx src/cli.ts` as a child process)
- [x] Add `/api/scenarios` GET endpoint that lists available scenario files from `scenarios/` (name, description, mode, outputTier)
- [x] Add a "Regenerate" button on each gallery card that triggers `/api/generate` and shows a spinner/progress state
- [x] Add a "Generate All" button in the gallery header
- [x] Handle concurrent generation requests (reject with 409 if already running)
- [x] Report generation errors visually in the gallery (red error text on card)

**Acceptance:** Clicking "Regenerate" on a gallery card runs the scenario and the new video appears in the gallery without a page refresh. "Generate All" regenerates all scenarios sequentially.

---

### Phase 8: Text Overlay Rendering (was Phase 7)

**Goal:** Render timed caption overlays onto videos, both as burned-in MP4 and as a live HTML overlay in the gallery player.

**Tasks:**

- [x] Implement ffmpeg caption burn-in: convert captions YAML to ASS subtitles, render into MP4 using ffmpeg subtitle filter
- [x] Produce output variants: `video.mp4` (clean) and `video-captioned.mp4` (text burned in)
- [x] Add `--overlay none|burned|both` CLI option controlling which MP4 variants are produced
- [x] Add `OVERLAY=none|burned|both` Make variable to `demo-scenario` target
- [x] Implement gallery player HTML overlay: parse captions YAML, display timed text synced to video playback position
- [x] Add toggle in gallery UI to switch between: clean video, burned-in video, and live overlay mode
- [x] Style overlay text to match the editor visual theme (semi-transparent background, white text, bottom-aligned)

**Acceptance:** Running `make demo-scenario SCENARIO=s3k-zone-editor OVERLAY=both` produces both clean and captioned MP4 files. The gallery player can display captions as a live overlay synced to video playback. A toggle switches between clean, burned-in, and live overlay views.

---

### Phase 9: Generation Progress Indicator

**Goal:** Fine-grained progress reporting when generating videos from the gallery UI, showing all pipeline steps with elapsed time and ETA.

**Tasks:**

- [x] Define pipeline step identifiers emitted by the runner: `launching-browser`, `recording-scenario`, `finalizing-video`, `converting-mp4`, `converting-gif`, `generating-captions`, `generating-vo-script`, `burning-captions`, `complete`
- [x] Add a progress callback to `RunScenarioOptions` that the runner calls at each step transition
- [x] Update `/api/generate/status` to return: current step, list of all steps with status (pending/running/done), elapsed time per step, total elapsed, and estimated time remaining
- [x] Update the gallery UI to display a step-by-step progress panel on the generating card: checkmark for completed steps, pulsing dot for current step, dimmed for pending steps
- [x] Display elapsed time and ETA at the bottom of the progress panel
- [x] Estimate ETA from hardcoded default durations per step

**Acceptance:** When generating a video from the gallery, the user sees each pipeline step listed with its status (pending/running/done), elapsed time, and ETA. Steps update in real time as the generation progresses.
