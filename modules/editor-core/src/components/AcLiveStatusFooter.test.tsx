import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, render } from '@testing-library/react';
import { AcLiveStatusFooter } from './AcLiveStatusFooter';

afterEach(() => {
  cleanup();
});

describe('AcLiveStatusFooter', () => {
  describe('rendering', () => {
    it('renders the slim band markup with led + text spans and the canonical root class', () => {
      const html = renderToStaticMarkup(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={null} />,
      );
      expect(html).toContain('ac-live-status-footer');
      expect(html).toContain('ac-live-status-footer__led');
      expect(html).toContain('ac-live-status-footer__text');
    });

    it('split-announcement a11y contract — visible chrome has NO role/aria-live; dedicated visually-hidden announcement span carries them (AUDIT-20260525-16)', () => {
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={null} />,
      );
      // Visible chrome: root + text span must NOT carry live-region
      // attributes (the 100ms tick would otherwise spam announcements).
      const root = container.querySelector('.ac-live-status-footer');
      expect(root).not.toBeNull();
      expect(root?.getAttribute('role')).toBeNull();
      expect(root?.getAttribute('aria-live')).toBeNull();
      const text = container.querySelector('.ac-live-status-footer__text');
      expect(text).not.toBeNull();
      expect(text?.getAttribute('role')).toBeNull();
      expect(text?.getAttribute('aria-live')).toBeNull();
      // Dedicated announcement: in the DOM (so screen readers see it)
      // and carries the live-region attributes. Visually hidden via
      // .ac-sr-only utility.
      const announcement = container.querySelector('.ac-live-status-footer__announcement');
      expect(announcement).not.toBeNull();
      expect(announcement?.getAttribute('role')).toBe('status');
      expect(announcement?.getAttribute('aria-live')).toBe('polite');
      expect(announcement?.classList.contains('ac-sr-only')).toBe(true);
    });

    it('appends a custom className to the root', () => {
      const html = renderToStaticMarkup(
        <AcLiveStatusFooter
          deviceLabel="S3000XL"
          lastEditAt={null}
          className="custom-extra"
        />,
      );
      expect(html).toContain('class="ac-live-status-footer custom-extra"');
    });

    it('hides the LED indicator from assistive tech (aria-hidden)', () => {
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={null} />,
      );
      const led = container.querySelector('.ac-live-status-footer__led');
      expect(led?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('state="live" (default)', () => {
    it('renders READY state when lastEditAt is null', () => {
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={null} />,
      );
      const text = container.querySelector('.ac-live-status-footer__text');
      expect(text?.textContent).toContain('READY');
      expect(text?.textContent).toContain('S3000XL');
      expect(text?.textContent).not.toContain('ago');
    });

    it('renders LIVE status with elapsed-time string when lastEditAt is set', () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={now - 400} />,
      );
      const text = container.querySelector('.ac-live-status-footer__text');
      expect(text?.textContent).toContain('LIVE');
      expect(text?.textContent).toContain('writing to S3000XL');
      expect(text?.textContent).toMatch(/0\.[34]s ago/);
      vi.useRealTimers();
    });

    it('updates the elapsed-time readout via internal tick after lastEditAt is set', () => {
      const start = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(start);
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={start} />,
      );
      const text = container.querySelector('.ac-live-status-footer__text');
      expect(text?.textContent).toMatch(/0\.0s ago/);
      act(() => {
        vi.setSystemTime(start + 500);
        vi.advanceTimersByTime(150);
      });
      expect(text?.textContent).toMatch(/0\.[56]s ago/);
      vi.useRealTimers();
    });

    it('reflects state="live" on the data-state attribute', () => {
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={null} state="live" />,
      );
      const root = container.querySelector('.ac-live-status-footer');
      expect(root?.getAttribute('data-state')).toBe('live');
    });
  });

  describe('state="offline"', () => {
    it('renders the offline indicator regardless of lastEditAt', () => {
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={Date.now()} state="offline" />,
      );
      const text = container.querySelector('.ac-live-status-footer__text');
      const root = container.querySelector('.ac-live-status-footer');
      expect(text?.textContent).toContain('OFFLINE');
      expect(text?.textContent).toContain('device disconnected');
      expect(root?.getAttribute('data-state')).toBe('offline');
    });

    it('does NOT tick when offline (no setState-after-unmount risk from idle interval)', () => {
      const start = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(start);
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={start} state="offline" />,
      );
      const text = container.querySelector('.ac-live-status-footer__text');
      const before = text?.textContent;
      act(() => {
        vi.setSystemTime(start + 2_000);
        vi.advanceTimersByTime(500);
      });
      expect(text?.textContent).toBe(before);
      vi.useRealTimers();
    });
  });

  describe('state="error"', () => {
    it('renders the errorMessage in the text slot and sets data-state="error"', () => {
      const { container } = render(
        <AcLiveStatusFooter
          deviceLabel="S3000XL"
          lastEditAt={Date.now()}
          state="error"
          errorMessage="SCSI timeout — write failed"
        />,
      );
      const text = container.querySelector('.ac-live-status-footer__text');
      const root = container.querySelector('.ac-live-status-footer');
      expect(text?.textContent).toBe('SCSI timeout — write failed');
      expect(root?.getAttribute('data-state')).toBe('error');
    });

    it('falls back to "ERROR" placeholder when state="error" but no errorMessage given', () => {
      const { container } = render(
        <AcLiveStatusFooter
          deviceLabel="S3000XL"
          lastEditAt={Date.now()}
          state="error"
        />,
      );
      const text = container.querySelector('.ac-live-status-footer__text');
      expect(text?.textContent).toBe('ERROR');
    });
  });

  describe('time formatting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows fractional seconds below 60s', () => {
      const start = Date.now();
      vi.setSystemTime(start);
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S-330" lastEditAt={start - 12_300} />,
      );
      const text = container.querySelector('.ac-live-status-footer__text');
      expect(text?.textContent).toContain('12.3s ago');
    });

    it('shows minutes + integer seconds above 60s', () => {
      const start = Date.now();
      vi.setSystemTime(start);
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S-550" lastEditAt={start - 83_000} />,
      );
      const text = container.querySelector('.ac-live-status-footer__text');
      expect(text?.textContent).toContain('1m 23s ago');
    });
  });

  describe('lifecycle', () => {
    it('clears the interval on unmount (no setState-after-unmount)', () => {
      const start = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(start);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { unmount } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={start} />,
      );
      unmount();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('unmounted'),
        expect.anything(),
      );
      errorSpy.mockRestore();
      vi.useRealTimers();
    });

    it('reacts to lastEditAt changes — switching from null to a timestamp starts ticking', () => {
      const start = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(start);
      const { container, rerender } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={null} />,
      );
      const text = container.querySelector('.ac-live-status-footer__text');
      expect(text?.textContent).toContain('READY');
      rerender(<AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={start} />);
      expect(text?.textContent).toContain('LIVE');
      vi.useRealTimers();
    });
  });

  describe('split-announcement live-region behavior (AUDIT-20260525-16)', () => {
    it('does NOT churn the live-region announcement during 100ms visual ticks', () => {
      // 50 ticks over 5s with a fixed lastEditAt: the visual text MUST
      // tick (proves the timer is running), the announcement text MUST
      // stay frozen (proves the live region is not polluted).
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={now} state="live" />,
      );

      const announcement = container.querySelector('.ac-live-status-footer__announcement');
      expect(announcement).not.toBeNull();
      const initialAnnouncementText = announcement!.textContent;
      // Rising-edge from initial mount with non-null lastEditAt =>
      // announcement is "Edit confirmed."
      expect(initialAnnouncementText).toBe('Edit confirmed.');

      const visualText = container.querySelector('.ac-live-status-footer__text');
      const initialVisualText = visualText!.textContent;
      expect(initialVisualText).toMatch(/0\.0s ago/);

      // Advance 5 seconds in 100ms increments (50 ticks).
      for (let i = 0; i < 50; i++) {
        act(() => {
          vi.setSystemTime(now + 100 * (i + 1));
          vi.advanceTimersByTime(100);
        });
      }

      // Announcement text MUST be identical (no rising-edge events
      // occurred — lastEditAt didn't change, state didn't change).
      expect(announcement!.textContent).toBe(initialAnnouncementText);
      expect(announcement!.textContent).toBe('Edit confirmed.');

      // Visual text MUST have ticked forward (proves the 100ms timer is
      // actually running — without this assertion a bug that froze the
      // timer entirely would also "pass" the no-churn check). Allow
      // ±100ms slop because setSystemTime + advanceTimersByTime can
      // interleave a tick before/after the system-time bump.
      expect(visualText!.textContent).not.toBe(initialVisualText);
      expect(visualText!.textContent).toMatch(/(4\.9|5\.0|5\.1)s ago/);

      vi.useRealTimers();
    });

    it('updates the announcement once on the rising edge of a new lastEditAt', () => {
      const start = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(start);

      // First mount: lastEditAt=null => empty announcement (no rising
      // edge yet — initial-mount with null is the "ready" state and
      // should not narrate anything).
      const { container, rerender } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={null} state="live" />,
      );
      const announcement = container.querySelector('.ac-live-status-footer__announcement');
      expect(announcement!.textContent).toBe('');

      // First edit: lastEditAt transitions null -> timestamp. Rising
      // edge fires; announcement becomes "Edit confirmed."
      rerender(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={start} state="live" />,
      );
      expect(announcement!.textContent).toBe('Edit confirmed.');

      // Second edit (different timestamp): rising edge fires again.
      // Even though the announcement text is the same string, the
      // setState call still happens — assistive tech that watches for
      // mutations will re-announce. We assert the state actually
      // updated by switching to a different state value first, then
      // back, to prove the rising-edge handler runs.
      rerender(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={start} state="offline" />,
      );
      expect(announcement!.textContent).toBe('Device offline.');
      rerender(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={start + 5_000} state="live" />,
      );
      expect(announcement!.textContent).toBe('Edit confirmed.');

      vi.useRealTimers();
    });

    // State-transition matrix: rising-edge from `live` to each
    // non-live state should produce the documented announcement.
    // Parameterized to keep the DRY constraint — each row exercises
    // exactly one state branch of `computeAnnouncement`.
    const stateTransitionCases = [
      {
        label: 'state="offline"',
        nextProps: { lastEditAt: 'start' as const, state: 'offline' as const },
        expected: 'Device offline.',
      },
      {
        label: 'state="error" (with errorMessage)',
        nextProps: {
          lastEditAt: 'start' as const,
          state: 'error' as const,
          errorMessage: 'SCSI timeout — write failed',
        },
        expected: 'Device error: SCSI timeout — write failed.',
      },
    ] as const;

    for (const { label, nextProps, expected } of stateTransitionCases) {
      it(`switches announcement to "${expected}" on ${label}`, () => {
        const start = Date.now();
        vi.useFakeTimers();
        vi.setSystemTime(start);
        const { container, rerender } = render(
          <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={start} state="live" />,
        );
        const announcement = container.querySelector('.ac-live-status-footer__announcement');
        expect(announcement!.textContent).toBe('Edit confirmed.');
        const resolvedLastEditAt = nextProps.lastEditAt === 'start' ? start : nextProps.lastEditAt;
        rerender(
          <AcLiveStatusFooter
            deviceLabel="S3000XL"
            lastEditAt={resolvedLastEditAt}
            state={nextProps.state}
            errorMessage={'errorMessage' in nextProps ? nextProps.errorMessage : undefined}
          />,
        );
        expect(announcement!.textContent).toBe(expected);
        vi.useRealTimers();
      });
    }
  });
});
