# @videocontrol/text-overlay

Generate professional text overlay videos from YAML definitions. Export as ProRes 4444 with alpha channel for compositing in DaVinci Resolve, Final Cut Pro, and other NLEs.

## Features

- **5 overlay templates**: Title, Lower-Third, Callout, Code, Parameter
- **7 transition types**: cut, fade, slide-up/down/left/right, typewriter
- **Multi-section overlays**: Independent timing for each line
- **Custom CSS styles**: Apply any CSS property to overlays
- **YAML-based workflow**: Define overlays in human-readable format
- **ProRes 4444 output**: Full alpha channel support for compositing
- **CLI tools**: render, validate, templates, init commands

## Quick Start

```bash
# From monorepo root
pnpm install

# Start Remotion Studio for preview
pnpm --filter @videocontrol/text-overlay dev

# Generate sample project file
pnpm --filter @videocontrol/text-overlay cli init -o my-project.yaml

# Validate a project file
pnpm --filter @videocontrol/text-overlay cli validate my-project.yaml

# Render to ProRes 4444
pnpm --filter @videocontrol/text-overlay cli render my-project.yaml -o output.mov
```

## Project File Format

```yaml
project:
  name: "My Video Overlays"
  resolution: [1920, 1080]
  framerate: 30
  # duration is optional - calculated from overlay timings if not specified

defaults:
  font: "Inter"
  transition:
    in: fade
    out: fade
    duration: 0.25
  # Default styles applied to all overlays
  style:
    textShadow: "0 2px 10px rgba(0, 0, 0, 0.5)"

theme:
  primary: "#3B82F6"
  secondary: "#1E293B"
  text: "#F8FAFC"
  accent: "#F59E0B"

overlays:
  - type: title
    title: "Welcome"
    in: "0:01.000"
    out: "0:05.000"
    style:
      fontWeight: 900
      letterSpacing: "0.05em"

  - type: lower-third
    title: "Speaker Name"
    subtitle: "Job Title"
    in: "0:06.000"
    out: "0:12.000"
    position: bottom-left
```

## CLI Commands

### `textoverlay render <project>`
Render a YAML project to video.

```bash
pnpm --filter @videocontrol/text-overlay cli render project.yaml -o output.mov
pnpm --filter @videocontrol/text-overlay cli render project.yaml -o frames/ --format png-sequence
pnpm --filter @videocontrol/text-overlay cli render project.yaml --range 0:45-1:00
```

Options:
- `-o, --output <path>`: Output file path (default: output.mov)
- `--format <format>`: prores, png-sequence, or webm (default: prores)
- `--range <range>`: Time range to render (e.g., 0:45-1:00)
- `--concurrency <n>`: Parallel render threads (default: 4)

### `textoverlay validate <project>`
Validate a YAML project without rendering.

```bash
pnpm --filter @videocontrol/text-overlay cli validate project.yaml
```

### `textoverlay templates`
List available overlay templates and their properties.

```bash
pnpm --filter @videocontrol/text-overlay cli templates
```

### `textoverlay init`
Generate a sample project file.

```bash
pnpm --filter @videocontrol/text-overlay cli init > my-project.yaml
pnpm --filter @videocontrol/text-overlay cli init -o my-project.yaml
```

## Overlay Templates

### Title
Centered title text with optional subtitle.

```yaml
- type: title
  title: "Main Title"
  subtitle: "Optional subtitle"
  in: "0:01.000"
  out: "0:05.000"
  fontSize: 120
  transition:
    in: fade
    out: fade
    duration: 0.5
```

### Lower-Third
Name/title bar at bottom of screen.

```yaml
- type: lower-third
  title: "Speaker Name"
  subtitle: "Role or Title"
  in: "0:06.000"
  out: "0:12.000"
  position: bottom-left  # bottom-left, bottom-center, bottom-right, top-left, top-center, top-right, center
```

### Callout
Positioned label with optional arrow pointing to a target.

```yaml
- type: callout
  title: "Look here!"
  in: "0:15.000"
  out: "0:20.000"
  position: [800, 300]
  arrow: true
  arrow_target: [600, 400]
```

### Code
Syntax-highlighted code block using Shiki.

```yaml
- type: code
  title: |
    function example() {
      return "hello";
    }
  in: "0:25.000"
  out: "0:35.000"
  syntax: typescript
  theme: github-dark
  position: center
```

### Parameter
Key-value display for measurements or settings.

```yaml
- type: parameter
  label: "Threshold"
  value: "-18"
  unit: "dB"
  in: "0:40.000"
  out: "0:50.000"
  position: [100, 100]
```

## Multi-Section Overlays

Any overlay can have multiple sections with independent timing. Each section inherits `in`, `out`, and `transition` from the parent if not specified. Use the optional `title` field for a heading above sections.

```yaml
- type: lower-third
  title: "Speaker"      # Optional heading above sections
  in: "0:06.000"
  out: "0:12.000"
  position: bottom-left
  transition:
    in: fade
    out: fade
  sections:
    - text: "Your Name"
      in: "0:06.000"    # Fades in first
    - text: "Your Title"
      in: "0:06.500"    # Fades in 0.5s later
    - text: "Your Company"
      in: "0:07.000"    # Fades in 1s later
      style:
        fontStyle: italic
```

The `title` field is the primary text content for all overlay types. For multi-section overlays, `title` serves as an optional heading above the sections.

## Custom Styles

Apply any CSS property (camelCase) to overlays or sections:

```yaml
- type: title
  title: "Styled Title"
  in: "0:01.000"
  out: "0:05.000"
  style:
    fontWeight: 900
    letterSpacing: "0.05em"
    textTransform: uppercase
    textShadow: "0 0 20px rgba(255, 0, 0, 0.8)"
```

Style inheritance order (later overrides earlier):
1. Template defaults
2. `defaults.style` (project-wide)
3. `overlay.style` (per-overlay)
4. `section.style` (per-section)

## Transitions

All overlays support entry and exit transitions:

| Transition | Description |
|------------|-------------|
| `cut` | Instant on/off (default) |
| `fade` | Opacity fade |
| `slide-up` | Slide in from below |
| `slide-down` | Slide in from above |
| `slide-left` | Slide in from right |
| `slide-right` | Slide in from left |
| `typewriter` | Characters appear sequentially |

```yaml
transition:
  in: slide-up
  out: fade
  duration: 0.3
```

## Timecode Formats

Overlays use timecodes to specify timing:

- `"MM:SS.mmm"` - Minutes, seconds, milliseconds (e.g., "1:30.500")
- `"SS.mmm"` - Seconds and milliseconds (e.g., "45.250")
- `123` - Frame number

## Development

```bash
# Start Remotion Studio
pnpm --filter @videocontrol/text-overlay dev

# Type check
pnpm --filter @videocontrol/text-overlay typecheck

# Run CLI tests
pnpm --filter @videocontrol/text-overlay test:cli
```

## Project Structure

```
src/
├── cli/           # CLI entry point and commands
├── parser/        # YAML parsing and Zod schemas
├── templates/     # Remotion overlay components
├── transitions/   # Animation utilities
├── composition/   # Main Remotion composition
└── utils/         # Timing utilities
```

## License

MIT
