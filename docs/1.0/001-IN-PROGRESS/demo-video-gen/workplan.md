# Demo Video Generator - Workplan

## GitHub Tracking

**GitHub Milestone:** TBD
**GitHub Issues:**
- #265 — Create infrastructure for a demo video generator (parent)
- #267 — Add video preview gallery (Phase 4)
- #268 — Add video publishing and versioning (Phase 5)

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

- [ ] Add Vite as a dev dependency to video-control with a minimal `vite.config.ts`
- [ ] Create gallery HTML page that displays available demos as a card grid
- [ ] Implement dev server plugin or middleware that scans `dist/demos/*/` for existing video outputs
- [ ] Each video card shows: GIF thumbnail, scenario name, duration, playable MP4, links to captions YAML and VO script (if present)
- [ ] Add Make target: `make demo-preview` to start the Vite dev server serving the gallery
- [ ] Gallery auto-refreshes when new videos are generated (Vite HMR or file watching)

**Acceptance:** `make demo-preview` opens a local page listing all generated demos with playable video previews. Adding a new video via `make demo-scenario` causes the gallery to update without restart.

---

### Phase 5: Video Publishing & Versioning

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
