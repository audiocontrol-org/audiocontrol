# Video Demos

Guidelines for creating demo video scenarios in the `video-control` module. This is the single source of truth for demo video authoring -- CLAUDE.md directs agents here.

## Authoring process

Demo videos are authored **script-first**. The voiceover script determines the pacing, not the animation.

### 1. Write the voiceover script

Before writing any scenario code, write the full narration for each step. Each step gets:
- A spoken line (what the narrator says)
- An estimated read time (at natural speaking pace, ~150 words per minute)

### 2. Validate timing against speech

Read each line aloud (or estimate at ~150 wpm). If the narration for a step takes 4 seconds to speak, the step must be at least 5-6 seconds long -- the viewer needs the narration *plus* time to watch the action. If a step's narration can't be spoken in the time allotted, the video is too fast. Adjust the video to fit the script, not the other way around.

### 3. Implement the scenario

Write the scenario code with timing derived from the script. Each `waitForTimeout` and drag duration should match or exceed the narration time for that step.

### 4. Review the video against the script

Play the video while reading the script aloud. If you fall behind, the pacing is wrong.

## Pacing

Every interaction in a demo video needs breathing room. The viewer must:

1. **See** what's about to happen (anticipation)
2. **Watch** the action itself
3. **Understand** what just happened (absorption)

Budget **5-8 seconds per interaction**. A demo with 7 interactions should be 35-56 seconds, not 13.

A video that rushes through interactions teaches nothing. Clarity matters more than brevity.

### Timing reference

| Phase | Duration | Purpose |
|-------|----------|---------|
| Title card | 3-4s | Establish context, narrator introduces the feature |
| Pre-action beat | 1-2s | Narrator describes what's about to happen |
| Action (click, drag) | 1-3s | Perform the interaction visibly |
| Post-action beat | 2-3s | Narrator explains the result |
| Final hold | 3-4s | Narrator wraps up, viewer absorbs end state |

### Drag interactions

Drag motions must be smooth and deliberate. Use 15-20 intermediate mouse positions with 60-100ms delays between steps. A drag that completes in 200ms is invisible; one that takes 1.5-2s is watchable.

## Scenario structure

Scenarios are TypeScript files in `modules/video-control/scenarios/`. Each exports:

```typescript
export const metadata: ScenarioMetadata = {
  name: 'scenario-slug',        // used for output directory name
  description: 'What this demos',
  mode: 'harness',              // 'harness' (no hardware) or 'device'
  outputTier: 'silent',         // 'silent', 'captioned', or 'scripted'
};

export const run = async (page: Page): Promise<void> => {
  // build UI, drive interactions
};
```

### Modes

- **harness**: Builds the UI directly in the browser with `page.evaluate()` and fixture data. No server, no hardware, no dependencies on editor modules. Runs anywhere.
- **device**: Connects to real hardware via the editor's dev server. Requires specific hardware. Skipped in CI.

### Output tiers

- **silent**: Raw video only (MP4 + GIF)
- **captioned**: Video + text-overlay YAML for compositing
- **scripted**: Video + YAML + proposed voiceover script

## Building the UI in harness mode

Harness scenarios construct a visual replica of the editor UI using vanilla DOM inside `page.evaluate()`. This means no React, no imports from editor modules, no bundling.

Match the editor's visual style:
- Background: `#111827` (gray-900)
- Panel backgrounds: `rgba(17, 24, 39, 0.7)` with `#374151` borders
- Active/selected: `#93c5fd` border, `0 0 8px rgba(147, 197, 253, 0.4)` glow
- Text: white primary, `#9ca3af` secondary, `#6b7280` labels
- Font: `system-ui, -apple-system, sans-serif`

Use `data-*` attributes on interactive elements so the scenario can locate them for mouse interactions.

## tsx/esbuild compatibility

tsx transforms function declarations inside `page.evaluate()` callbacks by injecting `__name()` calls that don't exist in the browser. The scenario runner defines `__name` as a passthrough via `addInitScript`, but prefer arrow functions inside evaluate blocks to avoid the issue entirely.

## Running scenarios

```bash
make demo-scenario SCENARIO=hello-world     # single scenario
make demo-all                               # all harness scenarios
```

Output goes to `modules/video-control/dist/demos/<scenario-name>/` containing the source WebM, converted MP4, and GIF.
