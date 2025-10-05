# audio-tools Documentation

This directory contains all documentation for the audio-tools project, organized by version and type.

## Structure

```
docs/
├── 1.0.0/                          # Version 1.0.0 documentation
│   ├── implementation/             # Implementation reports and work plans
│   │   └── cleanup/                # Code cleanup feature (pre-v1.0.0)
│   │       ├── workplan.md         # Master cleanup work plan
│   │       ├── task-6.1-*.md       # Build validation report
│   │       ├── task-6.2-*.md       # Quality gates report
│   │       └── task-6.3-*.md       # Cross-platform testing reports
│   └── reference/                  # Technical specifications
│       ├── Akai_S1000_SysEx_format.pdf
│       ├── akp-spec.txt
│       └── ...
└── README.md                       # This file
```

## Version 1.0.0

### Implementation Documentation

- **[Cleanup Workplan](1.0.0/implementation/cleanup/workplan.md)** - Master plan for pre-v1.0.0 code cleanup
  - Phase 1: Initial Audit
  - Phase 2: Deprecated Code Migration
  - Phase 3: Refactoring
  - Phase 4: Test Coverage
  - Phase 5: Documentation
  - Phase 6: Quality Validation (current)

### Reference Documentation

Technical specifications for Akai sampler formats:
- S1000, S2000, S2800, S3000XL SysEx documentation
- AKP file format specification

## Contributing

When adding documentation:
1. Place in appropriate version directory (`docs/X.Y.Z/`)
2. Use feature-scoped subdirectories for implementation docs
3. Follow naming convention: `docs/X.Y.Z/implementation/<feature>/<document>.md`
4. Update this README.md with links to new documentation
