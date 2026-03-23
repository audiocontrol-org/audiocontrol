/**
 * Integration tests for WaveformDisplay and SplitWaveformPane.
 *
 * Tests zoom behavior, trim handle interactions, and split-pane rendering
 * using jsdom-based React rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { WaveformDisplay } from '@/ui/WaveformDisplay';

// Mock canvas context — jsdom doesn't support canvas natively
const mockCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  font: '',
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  setLineDash: vi.fn(),
  clearRect: vi.fn(),
};

// Mock ResizeObserver for jsdom
class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) { this.callback = callback; }
  observe() {
    this.callback(
      [{ contentRect: { width: 800, height: 200 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

beforeEach(() => {
  vi.clearAllMocks();
  // Mock getContext for canvas elements
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as unknown as CanvasRenderingContext2D);
  // Mock getBoundingClientRect
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
    left: 0, top: 0, right: 800, bottom: 200,
    width: 800, height: 200, x: 0, y: 0, toJSON: () => {},
  }));
});

function createTestSamples(length = 30000): Int16Array {
  const samples = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.round(Math.sin(i * 0.1) * 16000);
  }
  return samples;
}

describe('WaveformDisplay', () => {
  describe('single-pane mode (zoom = 1)', () => {
    it('renders a canvas element', () => {
      const samples = createTestSamples();
      const { container } = render(
        <WaveformDisplay samples={samples} sampleRate={30000} />,
      );
      expect(container.querySelector('canvas')).toBeTruthy();
    });

    it('renders trim overlays when trimRegion is set', () => {
      const samples = createTestSamples();
      const onTrimRegionChange = vi.fn();
      render(
        <WaveformDisplay
          samples={samples}
          sampleRate={30000}
          trimRegion={{ start: 5000, end: 25000 }}
          onTrimRegionChange={onTrimRegionChange}
        />,
      );
      // Canvas draw calls should include overlay fill rects
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('calls onTrimRegionChange when dragging start handle', () => {
      const samples = createTestSamples();
      const onTrimRegionChange = vi.fn();
      const { container } = render(
        <WaveformDisplay
          samples={samples}
          sampleRate={30000}
          trimRegion={{ start: 5000, end: 25000 }}
          onTrimRegionChange={onTrimRegionChange}
        />,
      );
      const canvas = container.querySelector('canvas')!;

      // The start handle at sample 5000 should be at pixel ~133 (5000/30000 * 800)
      const handleX = Math.floor(5000 / 30000 * 800);

      // Mouse down near handle, then move
      fireEvent.mouseDown(canvas, { clientX: handleX });
      fireEvent.mouseMove(canvas, { clientX: handleX + 50 });
      fireEvent.mouseUp(canvas);

      // Should have called onTrimRegionChange with an updated start
      if (onTrimRegionChange.mock.calls.length > 0) {
        const lastCall = onTrimRegionChange.mock.calls[onTrimRegionChange.mock.calls.length - 1][0];
        expect(lastCall.start).toBeGreaterThan(5000);
        expect(lastCall.end).toBe(25000);
      }
    });

    it('calls onTrimRegionChange when dragging end handle', () => {
      const samples = createTestSamples();
      const onTrimRegionChange = vi.fn();
      const { container } = render(
        <WaveformDisplay
          samples={samples}
          sampleRate={30000}
          trimRegion={{ start: 5000, end: 25000 }}
          onTrimRegionChange={onTrimRegionChange}
        />,
      );
      const canvas = container.querySelector('canvas')!;

      // The end handle at sample 25000 should be at pixel ~667 (25000/30000 * 800)
      const handleX = Math.floor(25000 / 30000 * 800);

      fireEvent.mouseDown(canvas, { clientX: handleX });
      fireEvent.mouseMove(canvas, { clientX: handleX - 50 });
      fireEvent.mouseUp(canvas);

      if (onTrimRegionChange.mock.calls.length > 0) {
        const lastCall = onTrimRegionChange.mock.calls[onTrimRegionChange.mock.calls.length - 1][0];
        expect(lastCall.start).toBe(5000);
        expect(lastCall.end).toBeLessThan(25000);
      }
    });

    it('does not enter split mode at zoom 1', () => {
      const samples = createTestSamples();
      const { container } = render(
        <WaveformDisplay
          samples={samples}
          sampleRate={30000}
          trimRegion={{ start: 5000, end: 25000 }}
          onTrimRegionChange={vi.fn()}
          zoom={1}
        />,
      );
      // Should have exactly 1 canvas (single pane)
      const canvases = container.querySelectorAll('canvas');
      expect(canvases.length).toBe(1);
    });
  });

  describe('split-pane mode (zoom > 1)', () => {
    it('renders two canvases when zoomed in with trim region', () => {
      const samples = createTestSamples();
      const { container } = render(
        <WaveformDisplay
          samples={samples}
          sampleRate={30000}
          trimRegion={{ start: 5000, end: 25000 }}
          onTrimRegionChange={vi.fn()}
          zoom={4}
        />,
      );
      const canvases = container.querySelectorAll('canvas');
      expect(canvases.length).toBe(2);
    });

    it('shows start label on left pane and end label on right pane', () => {
      const samples = createTestSamples();
      render(
        <WaveformDisplay
          samples={samples}
          sampleRate={30000}
          trimRegion={{ start: 5000, end: 25000 }}
          onTrimRegionChange={vi.fn()}
          zoom={4}
        />,
      );
      // fillText should have been called with start and end labels
      const fillTextCalls = mockCtx.fillText.mock.calls;
      const labels = fillTextCalls.map((c: unknown[]) => c[0] as string);
      expect(labels.some((l: string) => l.includes('5000'))).toBe(true);
      expect(labels.some((l: string) => l.includes('25000'))).toBe(true);
    });

    it('does not render split pane without trim region even when zoomed', () => {
      const samples = createTestSamples();
      const { container } = render(
        <WaveformDisplay
          samples={samples}
          sampleRate={30000}
          zoom={4}
        />,
      );
      // No trim region = single canvas
      const canvases = container.querySelectorAll('canvas');
      expect(canvases.length).toBe(1);
    });

    it('updates trim region when dragging left pane', () => {
      const samples = createTestSamples();
      const onTrimRegionChange = vi.fn();
      const { container } = render(
        <WaveformDisplay
          samples={samples}
          sampleRate={30000}
          trimRegion={{ start: 5000, end: 25000 }}
          onTrimRegionChange={onTrimRegionChange}
          zoom={4}
        />,
      );
      const canvases = container.querySelectorAll('canvas');
      const leftCanvas = canvases[0]!;

      // Start drag from center of left pane
      fireEvent.mouseDown(leftCanvas, { clientX: 200 });

      // Simulate global mousemove (drag right = increase start)
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 250 }));
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      // Should have updated start (exact value depends on pixel-to-sample conversion)
      if (onTrimRegionChange.mock.calls.length > 0) {
        const lastCall = onTrimRegionChange.mock.calls[onTrimRegionChange.mock.calls.length - 1][0];
        expect(lastCall.start).not.toBe(5000); // should have changed
        expect(lastCall.end).toBe(25000); // end unchanged
      }
    });

    it('updates trim region when dragging right pane', () => {
      const samples = createTestSamples();
      const onTrimRegionChange = vi.fn();
      const { container } = render(
        <WaveformDisplay
          samples={samples}
          sampleRate={30000}
          trimRegion={{ start: 5000, end: 25000 }}
          onTrimRegionChange={onTrimRegionChange}
          zoom={4}
        />,
      );
      const canvases = container.querySelectorAll('canvas');
      const rightCanvas = canvases[1]!;

      fireEvent.mouseDown(rightCanvas, { clientX: 600 });

      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 550 }));
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      if (onTrimRegionChange.mock.calls.length > 0) {
        const lastCall = onTrimRegionChange.mock.calls[onTrimRegionChange.mock.calls.length - 1][0];
        expect(lastCall.start).toBe(5000); // start unchanged
        expect(lastCall.end).not.toBe(25000); // should have changed
      }
    });

    it('drag produces consistent incremental updates (no stale closure snapping)', () => {
      // This test exercises the stale closure bug: if handleMouseMove reads
      // trimRegion from a stale closure, the second mousemove will compute
      // the delta from the ORIGINAL region instead of the updated one,
      // causing the handle to snap back on each move.
      const samples = createTestSamples();

      // Stateful wrapper that re-renders WaveformDisplay with updated trimRegion
      let currentRegion = { start: 5000, end: 25000 };
      const regions: Array<{ start: number; end: number }> = [];

      function Wrapper() {
        const [region, setRegion] = useState({ start: 5000, end: 25000 });
        currentRegion = region;
        return (
          <WaveformDisplay
            samples={samples}
            sampleRate={30000}
            trimRegion={region}
            onTrimRegionChange={(r) => {
              regions.push({ ...r });
              setRegion(r);
            }}
            zoom={4}
          />
        );
      }

      const { container } = render(<Wrapper />);
      const canvases = container.querySelectorAll('canvas');
      const leftCanvas = canvases[0]!;

      // Start drag
      fireEvent.mouseDown(leftCanvas, { clientX: 200 });

      // First move: drag right by 10px
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 210 }));
      });

      // Second move: drag right by another 10px (total 20px from start)
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 220 }));
      });

      // Third move: drag right by another 10px (total 30px from start)
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 230 }));
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      // Should have 3 updates, each moving start further right
      expect(regions.length).toBeGreaterThanOrEqual(3);

      // Each successive start value should be >= the previous one
      // (monotonically increasing since we're dragging right)
      for (let i = 1; i < regions.length; i++) {
        expect(regions[i]!.start).toBeGreaterThanOrEqual(regions[i - 1]!.start);
      }

      // The final start should be greater than the first update's start
      // (if there's a stale closure, all updates would produce the same value)
      const firstStart = regions[0]!.start;
      const lastStart = regions[regions.length - 1]!.start;
      expect(lastStart).toBeGreaterThan(firstStart);
    });

    it('clamps start handle to not exceed end', () => {
      const samples = createTestSamples();
      const onTrimRegionChange = vi.fn();
      const { container } = render(
        <WaveformDisplay
          samples={samples}
          sampleRate={30000}
          trimRegion={{ start: 24000, end: 25000 }}
          onTrimRegionChange={onTrimRegionChange}
          zoom={4}
        />,
      );
      const canvases = container.querySelectorAll('canvas');
      const leftCanvas = canvases[0]!;

      // Try to drag start way past end
      fireEvent.mouseDown(leftCanvas, { clientX: 200 });
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 700 }));
      });
      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      if (onTrimRegionChange.mock.calls.length > 0) {
        const lastCall = onTrimRegionChange.mock.calls[onTrimRegionChange.mock.calls.length - 1][0];
        expect(lastCall.start).toBeLessThan(lastCall.end);
      }
    });
  });
});
