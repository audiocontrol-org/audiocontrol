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

    it('sets role="status" and aria-live="polite" so edits are announced politely', () => {
      const { container } = render(
        <AcLiveStatusFooter deviceLabel="S3000XL" lastEditAt={null} />,
      );
      const root = container.querySelector('.ac-live-status-footer');
      expect(root?.getAttribute('role')).toBe('status');
      expect(root?.getAttribute('aria-live')).toBe('polite');
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
});
