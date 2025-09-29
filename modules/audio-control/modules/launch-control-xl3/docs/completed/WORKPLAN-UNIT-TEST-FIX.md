# Workplan: Unit Test Quality Remediation

## Problem Statement

### Audit Findings Summary
The Launch Control XL3 library's unit tests contain critical quality issues that make them unsuitable for CI/CD automation:

1. **Real-time operations** - Tests use actual time delays instead of synthetic clocks
2. **Non-deterministic behavior** - Tests can fail randomly due to timing dependencies
3. **Improper mocking** - Some tests may touch real system resources
4. **Minimal coverage** - Only one unit test file exists after recent cleanup
5. **Async timing issues** - Uses `vi.waitFor()` and `queueMicrotask()` causing potential race conditions

### Impact on CI/CD
- Tests are slow (10+ seconds for minimal coverage)
- Tests may fail randomly in CI environments
- Cannot run in parallel safely
- Integration tests mixed with unit tests

## Current State Analysis

### Existing Test Files
```
test/
├── core/
│   ├── SysExParser.test.ts      # Has some issues
│   └── backends/
│       └── WebMidiBackend.test.ts # Has timing issues
├── device/
│   └── DeviceManager.test.ts     # Has async issues
├── unit/
│   └── handshake.test.ts         # Main issues identified
├── utils/
│   ├── bitwise.test.ts          # Appears clean
│   ├── helpers.test.ts          # Appears clean
│   └── validators.test.ts       # Appears clean
└── integration/                  # Should be excluded from unit runs
```

### Critical Issues Identified

#### 1. Real-Time Dependencies in handshake.test.ts
**Location**: Lines 125-149
```typescript
// PROBLEM: Uses vi.waitFor with async callbacks
await vi.waitFor(() => {
  const calls = sendSpy.mock.calls;
  return calls.length >= 2;
});
```

#### 2. System Clock Usage
**Location**: MockMidiBackend (multiple locations)
```typescript
// PROBLEM: Uses real Date.now()
timestamp: Date.now()
```

#### 3. Microtask Race Conditions
**Location**: MockMidiBackend simulateDeviceResponse()
```typescript
// PROBLEM: Non-deterministic timing
queueMicrotask(() => {
  this.simulateNovationSynAck();
});
```

#### 4. Console Output in Tests
**Issue**: Tests output warnings/errors to console
```
stderr | test/core/backends/WebMidiBackend.test.ts
Warning: Failed to close MIDI port Launch Control XL3: Close failed
```

## Implementation Phases

### Phase 1: Fix Existing Test Quality Issues (Priority: CRITICAL)
**Duration:** 1-2 days
**Goal:** Make all existing unit tests deterministic and fast

#### Task 1.1: Fix handshake.test.ts Timing Issues
- Replace all `vi.waitFor()` with deterministic flows
- Mock `Date.now()` or use fake timer system time
- Remove `queueMicrotask()` dependencies
- Ensure all tests use `vi.useFakeTimers()` properly

#### Task 1.2: Fix WebMidiBackend.test.ts
- Suppress or properly handle port close warnings
- Ensure no real MIDI operations occur
- Mock all external dependencies

#### Task 1.3: Fix DeviceManager.test.ts
- Remove real-time waits
- Mock all MIDI backend operations
- Ensure deterministic test flow

#### Task 1.4: Fix SysExParser.test.ts
- Review and fix any timing dependencies
- Ensure pure unit testing (no I/O)

### Phase 2: Implement Test Utilities (Priority: HIGH)
**Duration:** 1 day
**Goal:** Create reusable test utilities for consistent testing

#### Task 2.1: Create Synthetic Clock Utility
```typescript
// test/utils/synthetic-clock.ts
export class SyntheticClock {
  private time: number = 0;

  now(): number { return this.time; }
  advance(ms: number): void { this.time += ms; }
  reset(): void { this.time = 0; }
}
```

#### Task 2.2: Create Deterministic Mock Backend
```typescript
// test/mocks/DeterministicMidiBackend.ts
export class DeterministicMidiBackend implements MidiBackend {
  private responseQueue: Array<() => void> = [];

  queueResponse(response: () => void): void {
    this.responseQueue.push(response);
  }

  processNextResponse(): void {
    const response = this.responseQueue.shift();
    if (response) response();
  }
}
```

#### Task 2.3: Create Test Helper Functions
```typescript
// test/helpers/test-utils.ts
export function setupFakeTimers() {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
}
```

### Phase 3: Increase Unit Test Coverage (Priority: HIGH)
**Duration:** 3-4 days
**Goal:** Achieve >80% code coverage with quality unit tests

#### Task 3.1: Create Missing Unit Tests
Files to create:
- `test/unit/LaunchControlXL3.test.ts` - Main controller class
- `test/unit/DeviceManager.test.ts` - Device management logic
- `test/unit/MidiInterface.test.ts` - MIDI interface abstraction
- `test/unit/SysExParser.test.ts` - SysEx message parsing
- `test/unit/ControlMapper.test.ts` - Control mapping logic
- `test/unit/LedController.test.ts` - LED control logic
- `test/unit/CustomModeManager.test.ts` - Custom mode management

#### Task 3.2: Test Template Implementation
Each test file should follow this pattern:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupFakeTimers } from '../helpers/test-utils';

describe('ClassName', () => {
  setupFakeTimers(); // Handles all timer setup/teardown

  let instance: ClassName;
  let mockDependency: MockType;

  beforeEach(() => {
    mockDependency = createMockDependency();
    instance = new ClassName({ dependency: mockDependency });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle success case', () => {
      // Arrange
      mockDependency.someMethod.mockReturnValue('expected');

      // Act
      const result = instance.methodName();

      // Assert
      expect(result).toBe('expected');
      expect(mockDependency.someMethod).toHaveBeenCalledOnce();
    });

    it('should handle error case', () => {
      // Test error paths
    });
  });
});
```

### Phase 4: Optimize Test Execution (Priority: MEDIUM)
**Duration:** 1 day
**Goal:** Tests run in <5 seconds total

#### Task 4.1: Remove All Sleep/Wait Operations
- No `await new Promise(resolve => setTimeout(resolve, X))`
- No `vi.waitFor()` in unit tests
- No real async operations

#### Task 4.2: Optimize Mock Implementations
- Use synchronous mocks wherever possible
- Pre-compute test data instead of generating
- Minimize object creation in tests

#### Task 4.3: Configure Test Parallelization
```typescript
// vitest.config.ts
export default {
  test: {
    threads: true,
    maxThreads: 4,
    isolate: true,
    mockReset: true,
  }
}
```

## Best Practices to Enforce

### 1. Deterministic Testing Rules
- ✅ Always use `vi.useFakeTimers()` for time-dependent tests
- ✅ Mock `Date.now()`, `performance.now()`, etc.
- ✅ Use synchronous mocks for external dependencies
- ❌ Never use `setTimeout()` with real delays
- ❌ Never use `vi.waitFor()` in unit tests
- ❌ Never use `queueMicrotask()` without control

### 2. Proper Mocking Strategy
```typescript
// GOOD: Dependency injection with mocked interface
const mockBackend = {
  connect: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn(),
  send: vi.fn(),
} satisfies MidiBackend;

// BAD: Mocking entire modules
vi.mock('../../src/core/backends/EasyMidiBackend');
```

### 3. Test Isolation Requirements
- Each test must be independent
- Tests must not share state
- Tests must clean up after themselves
- Tests must not touch file system, network, or real hardware

### 4. Synthetic Time Control
```typescript
// Example: Testing a 5-second timeout
it('should timeout after 5 seconds', async () => {
  const timeoutPromise = instance.connectWithTimeout(5000);

  // Advance fake timers
  await vi.advanceTimersByTimeAsync(4999);
  // Should still be pending

  await vi.advanceTimersByTimeAsync(1);
  // Should now timeout

  await expect(timeoutPromise).rejects.toThrow('Timeout');
});
```

## Success Criteria

### Immediate Goals (Phase 1-2)
- [ ] All unit tests run in <10 seconds
- [ ] Zero flaky tests (100 consecutive runs pass)
- [ ] No real-time operations in unit tests
- [ ] Clean console output (no warnings/errors)

### Short-term Goals (Phase 3-4)
- [ ] >80% code coverage for core modules
- [ ] All public APIs have unit tests
- [ ] Test execution time <5 seconds
- [ ] Tests can run in parallel without issues

### Long-term Goals
- [ ] >90% code coverage overall
- [ ] Mutation testing shows >70% mutation score
- [ ] Zero production bugs related to untested code
- [ ] Tests serve as living documentation

## Testing Anti-Patterns to Avoid

### 1. Testing Implementation Instead of Behavior
❌ **Bad**: Testing private methods or internal state
✅ **Good**: Testing public API and observable behavior

### 2. Overmocking
❌ **Bad**: Mocking everything, including the unit under test
✅ **Good**: Only mock external dependencies and I/O

### 3. Test Interdependence
❌ **Bad**: Tests that depend on execution order
✅ **Good**: Each test sets up its own state

### 4. Snapshot Overuse
❌ **Bad**: Using snapshots for everything
✅ **Good**: Explicit assertions for important values

## Verification Steps

After each phase, verify:

1. **Run tests in CI mode**:
   ```bash
   CI=true pnpm test
   ```

2. **Check for flakiness**:
   ```bash
   for i in {1..10}; do pnpm test || break; done
   ```

3. **Measure execution time**:
   ```bash
   time pnpm test
   ```

4. **Check coverage**:
   ```bash
   pnpm test:coverage
   ```

## Risk Assessment

### High Risk Areas
1. **MockMidiBackend complexity** - May need complete rewrite
2. **Event emitter testing** - Timing-sensitive by nature
3. **Device handshake protocol** - Complex state machine

### Mitigation Strategies
1. Create simplified, deterministic mock implementations
2. Use synchronous event emission in tests
3. Model state machines explicitly with step-by-step testing

## Timeline

- **Week 1**: Phase 1-2 (Fix existing tests, create utilities)
- **Week 2**: Phase 3 (Increase coverage)
- **Week 2-3**: Phase 4 (Optimize execution)

Total estimated effort: **7-10 days**

## Conclusion

This workplan addresses critical quality issues in the Launch Control XL3 unit tests, making them suitable for CI/CD automation. By following these phases, we'll achieve fast, deterministic, comprehensive unit tests that provide confidence in the codebase while enabling rapid development cycles.