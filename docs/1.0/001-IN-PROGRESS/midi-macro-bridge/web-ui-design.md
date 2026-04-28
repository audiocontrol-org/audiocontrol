# Web Control Interface — UX/UI Design Reference

This document is the canonical visual + interaction specification for the
embedded web control interface added in Phase 6 of the MIDI Macro Bridge
feature. It captures the design verbatim from the approved feature plan so
implementing sub-phases (6c stylesheet, 6d configuration form, 6e event
stream UI) have a single source of truth to reference rather than re-deriving
choices from the plan file.

## Aesthetic direction: "Studio Rack Utility"

The bridge is virtually a piece of rack-mount studio hardware — a 1U MIDI
patch utility that happens to be software. The interface mirrors that
identity: panel-screened typography, peak-meter LEDs, signal-flow routing
visualization, tape-printer event log. Not a SaaS dashboard. Not a
cliché-dark-mode admin page. Equipment.

The reference frame is something between an MOTU MIDI Express XT front
panel, a Mackie console subgroup section, and a Eurorack utility module.
Confident, dense, technical, slightly imperfect (subtle film grain).

## Typography

- **Body / UI**: `Geist Mono` (variable, 300/400/500/700) — clean technical
  mono, less overexposed than JetBrains Mono / Space Mono. Tabular by
  default. All section headings set in caps with letter-spacing to read as
  silkscreened panel labels.
- **Display readouts** (bar number, transport state): `Departure Mono` —
  a vintage-computer / dot-matrix-LCD face that gives the bar-number panel
  authentic studio-gear character. Used only for the large numeric readouts
  and the master state badge.
- **Self-host the fonts** (woff2) inside `web/fonts/`, embedded with
  `rust-embed`. No CDN — the bridge runs offline.

## Color palette

```
background       #0a0b0a   true-black with imperceptible green undertone (CRT memory)
surface-panel    #161816   one notch up; subtle brushed-metal gradient
surface-recess   #0e0f0e   inset panels (event log, port slots)
border-hairline  #2a2c2a   1px panel seams
text-screenprint #e8e9e2   warm off-white, like silkscreen ink
text-secondary   #6c6e68   aged label text
led-green        #7dffa6   peak-meter green / connected / playing
led-amber        #ffd166   peak-meter caution / configured-but-disconnected
led-red          #ff5b5b   overload / panic
signal-green     #9eff8e   routing lines / live data flowing
accent-warm      #ff9b51   hover / focus / active — single warm accent (tape-saturation orange)
```

LEDs render as 8px round dots with a soft `box-shadow` glow in their colour.
A subtle pulse animation on green when data is flowing. A faster, sharper
flicker on red.

## Visual texture

- 1px subtle film-grain noise overlay on `background` (CSS data URL, ~3%
  opacity).
- Every panel has a 1px hairline border in `border-hairline`, plus a
  subtle vertical brushed-metal gradient from `#181a18` to `#141614`.
- Panel labels are silkscreened: 10px caps, 0.18em tracking,
  `text-secondary`, sitting in the panel's top-left margin.
- Bar-number display has a thin scanline overlay (repeating linear
  gradient at 0.04 opacity) to suggest a backlit segment readout.

## Information architecture

Top-down vertical hierarchy, but the **central row uses signal-flow
left-to-right** to reinforce the user's mental model (sources → bridge →
destinations).

```
[ HEADER STRIP ]
  Identity · Master LED · Version · HALT button

[ TRANSPORT READOUT ]
  Big state badge (STOPPED / PLAYING / LOCATING) · Bar number · Last-event timer

[ ROUTING MATRIX ]
  Sources (left)   →   Bridge (centre)   →   Destinations (right)
  ┌──────────┐         ┌──────────┐          ┌──────────┐
  │ MC-500   │ ──●──→  │ MACHINE  │  ──●──→  │ LUNA     │
  │ LCXL3    │ ──●──→  │  state   │  ──●──→  │ MC-500   │
  └──────────┘         └──────────┘          └──────────┘

[ CONFIGURATION ]
  Collapsed panels per device (MC-500, LCXL3, Backend) — expand to edit
  Single APPLY button (sticky at panel bottom-right when changes pending)

[ EVENT STREAM ]
  Tape-printer style log, ~120px tall, fixed at viewport bottom
```

## Wireframe (full layout)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ▓▓ MIDI MACRO BRIDGE        v1.0  ● running           [ ⏻  HALT ]        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│         STOPPED                       BAR  047                           │
│         ━━━━━━━                       ━━━━━━━━━                          │
│                                       last event 2s                      │
│                                                                          │
├── ROUTING ──────────────────────────────────────────────────────────────┤
│                                                                          │
│   SOURCES                BRIDGE                  DESTINATIONS            │
│  ┌─────────────┐                                ┌──────────────────┐     │
│  │ ● MC-500    │ ──────╮                  ╭─→  │ ● LUNA  (MCU)    │     │
│  │   IAC Bus 1 │       │                  │    │   virtual endpt  │     │
│  └─────────────┘       │   ┌──────────┐   │    └──────────────────┘     │
│                        ├─→ │ MACHINE  │ ──┤                              │
│  ┌─────────────┐       │   │ stopped  │   │    ┌──────────────────┐     │
│  │ ● LCXL3     │ ──────╯   └──────────┘   ╰─→  │ ● MC-500 sync    │     │
│  │   DAW Out   │                                │   IAC Bus 2      │     │
│  └─────────────┘                                └──────────────────┘     │
│                                                                          │
│                                                  ┌──────────────────┐    │
│                                                  │ ● LCXL3 LEDs     │    │
│                                                  │   DAW In         │    │
│                                                  └──────────────────┘    │
│                                                                          │
├── CONFIGURATION ────────────────────────────────────────────────────────┤
│                                                                          │
│  ▾ MC-500            ENABLED   [ ░ on ]                                  │
│      input port  [ IAC Driver Bus 1     ▾ ]  ●                           │
│      sync port   [ IAC Driver Bus 2     ▾ ]  ●                           │
│                                                                          │
│  ▾ LCXL3             ENABLED   [ ░ on ]                                  │
│      input port  [ LCXL3 1 DAW Out      ▾ ]  ●                           │
│      output port [ LCXL3 1 DAW In       ▾ ]  ●                           │
│      host name   [ Bridge                    ]                           │
│                                                                          │
│  ▸ BACKEND           MCU (virtual endpoint)                              │
│                                                                          │
│                                              [  APPLY CHANGES  ]         │
├── EVENT STREAM ─────────────────────────────────────────────────────────┤
│  12:34:58.121  MC-500     Start                                          │
│  12:34:57.003  LCXL3      NudgeForward(1)                                │
│  12:34:55.890  MCU OUT    heartbeat reply                                │
│  12:34:54.220  MC-500     Spp(384)                                       │
│  ...                                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

The transport readout sits prominently at the top because it's the one
thing a musician glances at to confirm "is the bridge alive and in sync?"
Configuration sits below the routing — fold-out panels keep visual weight
low when the user isn't editing.

## Interaction patterns

### Port picking — the ergonomic core of the UI

- Each port slot is rendered as a "patch jack": label on top, dropdown
  below, status LED to the right.
- Dropdown is populated from `GET /api/ports` (input or output side as
  appropriate). Live-refreshed every 2s via htmx polling on the dropdown
  options, plus a manual "Refresh" affordance.
- LED states per slot:
  - **Off** — no port configured
  - **Green steady** — configured port name matches a connected port,
    bridge is wired
  - **Amber** — configured but the named port isn't currently connected
    (cable unplugged, device asleep)
  - **Red** — configured port couldn't be opened (permission, taken by
    another app)
- Selecting a different port from the dropdown does NOT immediately apply.
  It marks the form dirty. The "APPLY CHANGES" button at panel bottom
  becomes prominent (warm-accent pulse).

### Apply — deliberate, atomic

- Click APPLY → htmx POST `/api/config` with the form contents.
- During the ~100ms reload, the routing matrix dims to 40% opacity, all
  port LEDs flicker amber, the bar readout shows `----`, and a single line
  `RECONNECTING…` appears in the event stream.
- On success: matrix snaps back, LEDs settle to their new states, success
  pulse on the master LED. On failure: red flash on the master LED, an
  error toast describes which port couldn't open.

### Live event stream — tape-printer aesthetic

- Implemented as Server-Sent Events (`GET /api/events`,
  `text/event-stream`). htmx-friendly via the `hx-sse` extension.
- Each event is one line: timestamp, source tag, event description.
- Source tag is a fixed-width chip with a subtle colour fill keyed to its
  origin (MC-500, LCXL3, MCU OUT, BRIDGE). Makes scanning easy.
- New events appear at the bottom and the stream scrolls; oldest fade away
  after the buffer fills (~200 lines, ring buffer).
- Hovering the stream pauses auto-scroll so the user can read history.
- A small "PAUSE" indicator dot appears in the corner when paused.

### Master LED in header — at-a-glance health

- **Green** — all enabled inputs are connected, MCU output flowing,
  heartbeats from DAW returning.
- **Amber** — at least one configured port disconnected, OR no MCU
  heartbeats received in the last 5s.
- **Red** — bridge in a panic state (event-loop wedged, panic exit pending).
- A tooltip on hover lists the specific reason for amber/red.

### HALT button — destructive but accessible

- Top-right of header in red-LED treatment.
- Hold-to-confirm (3s press), with a circular progress ring filling
  during the hold. Click-without-hold does nothing.
- On confirm: `POST /api/halt` → bridge calls `std::process::exit(2)`.
  When run under `launchd`, the process respawns within 1s.

### Backend mode toggle

- Segmented control: `MCU` / `KEYSTROKES`.
- When `KEYSTROKES` is selected, the panel expands downward to reveal a
  nudge-size numeric input. The panel collapses back when MCU is selected
  (the only mode that needs configuration is keystrokes; MCU is
  parameter-free).

## Visual language: density and rhythm

- **Density**: medium-high. This is utility software, not a marketing
  page. Panels are tightly spaced (16-24px gutters); padding is restrained
  (12px panel padding, 8px control padding).
- **Vertical rhythm**: 4px base unit. Section heights snap to multiples of
  it.
- **Width**: page maxes at 960px and centers. The whole thing looks like a
  single rack unit on screen.
- **Animation**: subtle. Pulse on connected LEDs (1.5s cycle, 0.85→1.0
  opacity). Scroll-into-view easing on new event lines (140ms, ease-out).
  Reconnecting state is the only disruptive animation. No gratuitous
  motion.
- **Cursor**: default. Pointer on interactive elements. No custom cursor.

## v1 scope vs deferred

### v1 minimum (ships in Phase 6)

- Header strip (identity, master LED, HALT button)
- Transport readout (state badge + bar number + last-event timer)
- Routing matrix (visual signal flow with per-port LEDs)
- Configuration panels for MC-500, LCXL3, Backend
- APPLY button with reload-state animation
- Event stream via SSE
- All four LED states per port slot
- Hold-to-confirm HALT
- Self-hosted Geist Mono + Departure Mono
- Studio rack aesthetic (panels, hairlines, screenprint labels, LEDs)

### Deferred (nice-to-haves, not blocking v1)

- Keyboard shortcuts (space=halt-cancel, etc.)
- Theme toggle (we ship dark only)
- Bar/beat/tick precision in transport readout (just bar in v1)
- Per-source colour customisation in event stream
- Export / share config snapshot
- Reorderable / draggable port slots
- Tooltips on every control (only on master LED v1)
- Mobile / touch optimisation
- Diagnostics panel showing raw byte counters
- Multi-instance support
