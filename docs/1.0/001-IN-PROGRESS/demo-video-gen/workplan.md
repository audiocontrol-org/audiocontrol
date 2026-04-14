# Demo Video Generator - Workplan

## GitHub Tracking

**GitHub Milestone:** TBD
**GitHub Issues:**
- TBD (to be created via /feature-issues)

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

- [ ] Create `tools/demo-video-gen/` with TypeScript project setup (package.json, tsconfig.json, vitest config)
- [ ] Define the scenario interface: function signature (`(page: Page) => Promise<void>`), metadata type (name, description, mode, duration estimate, output tier)
- [ ] Implement the scenario runner: load scenario module, launch Playwright with `recordVideo` options, execute scenario function, close browser, collect video file
- [ ] Implement ffmpeg conversion: WebM to MP4 (h264, crf 23), WebM to GIF (palette-based, max 15fps for size)
- [ ] Add Make targets: `make demo-scenario SCENARIO=<name>`, `make demo-all`, `make demo-device`
- [ ] Create one "hello world" scenario that opens a page, performs a simple interaction, and exits
- [ ] Define output directory structure: `dist/demos/<scenario-name>/` containing video.mp4, video.gif, and metadata.json

**Acceptance:** Running `make demo-scenario SCENARIO=hello-world` produces MP4 and GIF in `dist/demos/hello-world/`.

---

### Phase 2: Caption Generation

**Goal:** Extend scenario output to include timed captions and VO scripts.

**Tasks:**

- [ ] Extend scenario interface to include captions array: `{ text: string, timestampMs: number, durationMs: number, type: 'title' | 'callout' | 'step' }`
- [ ] Implement YAML generation matching @videocontrol/text-overlay project format
- [ ] Integrate caption output into scenario runner pipeline (output alongside video files)
- [ ] Validate generated YAML against text-overlay schema (structural validation, not runtime)
- [ ] Implement VO script output: generate a plain-text script with timestamps derived from caption data
- [ ] Add output tier selection to Make targets: `TIER=silent|captioned|scripted`

**Acceptance:** Running a scenario with captions produces a `.yaml` file valid for text-overlay and (if tier=scripted) a `.txt` VO script.

---

### Phase 3: First Scenarios

**Goal:** Create real demo scenarios for existing editors.

**Tasks:**

- [ ] Create scenario: S3000XL draggable zones demo (harness mode) -- navigate to zone editor, drag zone boundaries, show visual feedback
- [ ] Create scenario: Roland S-330 library browser (harness mode) -- browse library tree, select items, show metadata panel
- [ ] Create scenario: S3000XL sample transfer (device mode, optional) -- connect to device, initiate transfer, show progress
- [ ] Add captions to all scenarios (callouts for key interactions, step labels for phases)
- [ ] Integrate all scenarios into `make demo-all`
- [ ] Verify harness scenarios run without any device connected
- [ ] Document scenario authoring guide in tools/demo-video-gen/README.md

**Acceptance:** Each scenario produces MP4, GIF, and captions YAML. Harness scenarios run without a device. `make demo-all` runs all harness scenarios and skips device scenarios unless hardware is available.
