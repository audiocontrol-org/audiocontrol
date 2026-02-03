## Installation

```bash
npm install @audiocontrol/sampler-translate
```

### Dependencies

This package depends on:
- `@audiocontrol/sampler-lib` - Core sample manipulation and binary format utilities
- `@audiocontrol/sampler-devices` - Hardware sampler device abstraction and format specs
- `fluent-ffmpeg` - Audio format conversion (requires FFmpeg installed on system)
- `wavefile` - WAV file manipulation
- `music-metadata` - Audio file metadata parsing

**External Requirements**:
- FFmpeg must be installed on your system for audio format conversion
- For S3K translation: akaitools must be available (via sampler-devices)

## Quick Start
