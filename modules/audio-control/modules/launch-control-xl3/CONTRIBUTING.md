# Contributing to @ol-dsp/launch-control-xl3

Thank you for your interest in contributing to the Launch Control XL 3 TypeScript library! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to maintain a welcoming and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository** and clone your fork
2. **Install dependencies**: `pnpm install`
3. **Create a branch**: `git checkout -b feature/your-feature-name`
4. **Make your changes** following the guidelines below
5. **Test your changes**: `npm test`
6. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- A Launch Control XL 3 device (for integration testing)
- Git

### Installation

```bash
# Clone your fork
git clone https://github.com/your-username/launch-control-xl3.git
cd launch-control-xl3

# Install dependencies
pnpm install

# Run tests
npm test

# Start development mode
npm run dev
```

## Development Guidelines

### Code Style

- **TypeScript**: Use strict mode with all safety flags enabled
- **Imports**: Always use `@/` import pattern for internal modules
- **Formatting**: Run `npm run lint:fix` before committing
- **Naming**: Use clear, descriptive names for variables and functions

### Architecture Principles

1. **Interface-first design**: Define interfaces before implementations
2. **Dependency injection**: Use constructor injection for testability
3. **Composition over inheritance**: Build complex behavior from simple parts
4. **Platform-agnostic**: Keep core logic independent of specific MIDI backends

### File Organization

```
src/
├── core/           # Core functionality (SysEx, MIDI, etc.)
├── device/         # Device management
├── mapping/        # Control mapping
├── led/            # LED control
├── modes/          # Custom mode management
├── cli/            # CLI tool
└── types/          # TypeScript type definitions
```

### Testing

- **Unit tests**: Required for all new functionality
- **Integration tests**: For device-specific features
- **Coverage**: Aim for 80%+ code coverage
- **Mocking**: Use dependency injection, not module stubbing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Making Changes

### Adding Features

1. **Discuss first**: Open an issue to discuss major changes
2. **Follow patterns**: Match existing code patterns and conventions
3. **Add tests**: Include unit tests for new functionality
4. **Update docs**: Update README and API documentation
5. **Add examples**: Provide usage examples when appropriate

### Bug Fixes

1. **Reproduce**: Add a failing test that reproduces the bug
2. **Fix**: Implement the fix
3. **Verify**: Ensure the test passes
4. **Regression**: Check that no other tests break

### Protocol Changes

The SysEx protocol implementation is critical. Changes should:

1. Be backed by hardware testing
2. Include comprehensive tests
3. Update protocol documentation
4. Maintain backward compatibility when possible

## Commit Guidelines

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Test additions or fixes
- **chore**: Maintenance tasks

### Examples

```
feat(led): add rainbow animation support

Implements rainbow color cycling animation for button LEDs
with configurable duration and repeat options.

Closes #123
```

```
fix(sysex): correct custom mode data parsing

Fixes issue where custom mode colors were incorrectly
parsed from SysEx responses.
```

## Pull Request Process

1. **Update your branch**: Rebase on latest main branch
2. **Run tests**: Ensure all tests pass
3. **Check coverage**: Verify adequate test coverage
4. **Update docs**: Include documentation updates
5. **Clean commits**: Squash or organize commits logically
6. **PR description**: Clearly describe changes and motivation

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Documentation updated
- [ ] Examples work (`npm run example:basic`)
- [ ] Commit messages follow guidelines
- [ ] PR description is clear and complete

## Testing with Hardware

### Integration Tests

```bash
# With device connected
npm run test:integration

# Skip hardware tests
SKIP_HARDWARE_TESTS=true npm test
```

### Manual Testing

Use the CLI tool for manual testing:

```bash
npm run cli -- connect
npm run cli -- monitor
npm run cli -- led-test
```

## Documentation

### API Documentation

- Update `docs/API.md` for API changes
- Include JSDoc comments for public methods
- Provide usage examples

### README Updates

- Keep feature list current
- Update examples for new features
- Maintain troubleshooting section

## Release Process

Releases are managed by maintainers:

1. Version bump following semver
2. Update CHANGELOG.md
3. Create git tag
4. GitHub Actions handles npm publishing

## Getting Help

- **Issues**: Use GitHub issues for bugs and features
- **Discussions**: GitHub Discussions for questions
- **Protocol**: See `docs/PROTOCOL.md` for SysEx details

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- README acknowledgments
- Release notes

Thank you for contributing!