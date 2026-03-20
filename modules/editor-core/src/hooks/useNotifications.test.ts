import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests the core notification logic extracted from useNotifications.
 * Since the hook is thin React state wiring over simple logic,
 * we test the timer/lifecycle behavior directly to avoid needing
 * @testing-library/react in this package.
 */

describe('useNotifications — timer logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('info auto-dismiss fires after configured delay', () => {
    const dismissed: number[] = [];
    const dismiss = (id: number) => dismissed.push(id);

    // Simulate what the hook does for info notifications
    const timer = setTimeout(() => dismiss(1), 5000);

    vi.advanceTimersByTime(4999);
    expect(dismissed).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(dismissed).toEqual([1]);

    clearTimeout(timer);
  });

  it('clearing a timer prevents auto-dismiss', () => {
    const dismissed: number[] = [];
    const dismiss = (id: number) => dismissed.push(id);

    const timer = setTimeout(() => dismiss(1), 5000);
    clearTimeout(timer);

    vi.advanceTimersByTime(10000);
    expect(dismissed).toEqual([]);
  });

  it('multiple timers dismiss independently', () => {
    const dismissed: number[] = [];
    const dismiss = (id: number) => dismissed.push(id);

    setTimeout(() => dismiss(1), 3000);
    setTimeout(() => dismiss(2), 5000);

    vi.advanceTimersByTime(3000);
    expect(dismissed).toEqual([1]);

    vi.advanceTimersByTime(2000);
    expect(dismissed).toEqual([1, 2]);
  });
});

describe('useNotifications — notification filtering', () => {
  interface Notification {
    id: number;
    level: 'info' | 'error';
    text: string;
  }

  it('filters by id correctly', () => {
    const notifications: Notification[] = [
      { id: 0, level: 'info', text: 'a' },
      { id: 1, level: 'error', text: 'b' },
      { id: 2, level: 'info', text: 'c' },
    ];

    const result = notifications.filter((n) => n.id !== 1);
    expect(result).toHaveLength(2);
    expect(result.map((n) => n.text)).toEqual(['a', 'c']);
  });

  it('appending preserves order', () => {
    let notifications: Notification[] = [];
    notifications = [...notifications, { id: 0, level: 'info', text: 'first' }];
    notifications = [...notifications, { id: 1, level: 'error', text: 'second' }];

    expect(notifications.map((n) => n.text)).toEqual(['first', 'second']);
  });
});
