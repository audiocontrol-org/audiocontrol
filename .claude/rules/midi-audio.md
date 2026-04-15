---
paths:
  - "modules/sampler-midi/**"
  - "modules/sampler-devices/**"
  - "modules/ardour-midi-maps/**"
  - "modules/canonical-midi-maps/**"
  - "modules/launch-control-xl3/**"
  - "modules/live-max-cc-router/**"
---

# MIDI/Audio Guidelines

- Follow MIDI specification standards
- Support both 7-bit and 14-bit CC values
- Handle NRPN/RPN parameters correctly
- Real-time audio code must be allocation-free
- Respect MIDI clock and timing constraints
- Preserve proprietary sampler format specifications exactly
- Use the `midisnoop` binary (installed in PATH) to observe MIDI conversations
