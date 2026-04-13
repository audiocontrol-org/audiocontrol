# Unit Testing

Unit testing methodology -- Vitest, jsdom, React Testing Library.

> Part of the [Testing Architecture](TESTING.md). See also: [UI Testing](TESTING-UI.md) | [E2E Testing](TESTING-E2E.md)

**Status: To be documented.**

## Topics to Cover

- Test file naming conventions and organization within `test/unit/`
- Factory helpers and test data patterns
- Test environment configuration (jsdom, Vitest config)
- React Testing Library usage patterns
- Coverage targets and enforcement
- How to run unit tests (pnpm commands, filtering)
- Dependency injection patterns for testability (no module stubbing)
- When a test belongs here vs. in UI or E2E

## Migration Note

Existing unit tests are co-located with source as `src/**/*.test.tsx`. These need migration to `test/unit/` under each module. New unit tests should be written in the target location.
