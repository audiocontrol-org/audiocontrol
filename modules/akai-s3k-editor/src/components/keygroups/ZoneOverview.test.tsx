import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { ZoneOverview } from '@/components/keygroups/ZoneOverview';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';

function setSurfaceRect(): void {
  const surface = screen.getByTestId('zone-overview-surface');
  Object.defineProperty(surface, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 100,
      top: 20,
      width: 560,
      height: 220,
      right: 660,
      bottom: 240,
      x: 100,
      y: 20,
      toJSON: () => ({}),
    }),
  });
}

describe('ZoneOverview', () => {
  it('renders empty state when keygroupCount is 0', () => {
    const onSelect = vi.fn();

    render(
      <ZoneOverview
        keygroups={[]}
        keygroupCount={0}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
      />,
    );

    expect(screen.getByText('No keygroups to display.')).toBeInTheDocument();
  });

  it('renders zone buttons for each keygroup with velocity zones', () => {
    const kg1 = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'BASS DRUM   ',
      LOVEL1: 0,
      HIVEL1: 127,
    });
    const kg2 = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 84,
      SNAME1: 'SNARE       ',
      LOVEL1: 0,
      HIVEL1: 127,
    });

    const onSelect = vi.fn();

    render(
      <ZoneOverview
        keygroups={[kg1, kg2]}
        keygroupCount={2}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
      />,
    );

    // Each keygroup with a zone renders a button with the sample name
    expect(screen.getByText('BASS DRUM')).toBeInTheDocument();
    expect(screen.getByText('SNARE')).toBeInTheDocument();
  });

  it('clicking a zone calls onSelectKeygroup with the correct index', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'CLICK ME    ',
      LOVEL1: 0,
      HIVEL1: 127,
    });

    const onSelect = vi.fn();

    render(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
      />,
    );

    const button = screen.getByText('CLICK ME');
    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('clicking the second keygroup zone calls onSelectKeygroup with index 1', () => {
    const kg1 = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 59,
      SNAME1: 'FIRST       ',
      LOVEL1: 0,
      HIVEL1: 127,
    });
    const kg2 = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 84,
      SNAME1: 'SECOND      ',
      LOVEL1: 0,
      HIVEL1: 127,
    });

    const onSelect = vi.fn();

    render(
      <ZoneOverview
        keygroups={[kg1, kg2]}
        keygroupCount={2}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
      />,
    );

    fireEvent.click(screen.getByText('SECOND'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('selected keygroup has distinct visual styling', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'SELECTED    ',
      LOVEL1: 0,
      HIVEL1: 127,
    });

    const onSelect = vi.fn();

    const { rerender } = render(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
      />,
    );

    // The button exists with the zone label
    const button = screen.getByText('SELECTED').closest('[role="button"]') as HTMLElement | null;
    expect(button).toBeTruthy();

    // When not selected, borderWidth should be 1px
    expect(button?.style.borderWidth).toBe('1px');

    // Re-render with the keygroup selected
    rerender(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={0}
        onSelectKeygroup={onSelect}
      />,
    );

    const selectedButton = screen.getByText('SELECTED').closest('[role="button"]') as HTMLElement | null;
    expect(selectedButton?.style.borderWidth).toBe('2px');
    // jsdom normalizes hex colors to rgb format
    expect(selectedButton?.style.borderColor).toBe('rgb(147, 197, 253)');
  });

  it('handles undefined entries in keygroups array gracefully', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 72,
      SNAME1: 'LOADED      ',
      LOVEL1: 0,
      HIVEL1: 127,
    });

    const keygroups: (KeygroupHeader | undefined)[] = [kg, undefined, undefined];
    const onSelect = vi.fn();

    // Should not throw — undefined entries are simply skipped
    render(
      <ZoneOverview
        keygroups={keygroups}
        keygroupCount={3}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
      />,
    );

    expect(screen.getByText('LOADED')).toBeInTheDocument();
  });

  it('renders KG label for keygroups with no active velocity zones', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      // All sample names empty, all velocity ranges zero
      SNAME1: '            ',
      SNAME2: '            ',
      SNAME3: '            ',
      SNAME4: '            ',
      HIVEL1: 0,
      HIVEL2: 0,
      HIVEL3: 0,
      HIVEL4: 0,
    });

    const onSelect = vi.fn();

    render(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
      />,
    );

    // When no velocity zones are active, it renders "KG 1" as label
    expect(screen.getByText('KG 1')).toBeInTheDocument();
  });

  it('uses the shared visible range for zone positioning when provided', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'ALIGNED     ',
      LOVEL1: 0,
      HIVEL1: 127,
    });

    render(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={null}
        onSelectKeygroup={vi.fn()}
        visibleRange={{ min: 32, max: 88 }}
      />,
    );

    const zone = screen.getByTestId('zone-overview-zone-0-1');
    expect(zone).toHaveStyle({
      left: '7.017543859649122%',
      width: '64.91228070175438%',
    });
  });

  it('renders note drag handles once for the selected keygroup', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'SOFT        ',
      LOVEL1: 0,
      HIVEL1: 63,
      SNAME2: 'LOUD        ',
      LOVEL2: 64,
      HIVEL2: 127,
    });

    render(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={0}
        onSelectKeygroup={vi.fn()}
        onParameterChange={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('zone-handle-note-low-0')).toHaveLength(1);
    expect(screen.getAllByTestId('zone-handle-note-high-0')).toHaveLength(1);
  });

  it('commits note boundary drags through onParameterChange', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'DRAG NOTE   ',
      LOVEL1: 0,
      HIVEL1: 127,
    });
    const onSelect = vi.fn();
    const onParameterChange = vi.fn();

    render(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={0}
        onSelectKeygroup={onSelect}
        onParameterChange={onParameterChange}
        visibleRange={{ min: 32, max: 88 }}
      />,
    );
    setSurfaceRect();

    fireEvent.mouseDown(screen.getByTestId('zone-handle-note-low-0'), {
      clientX: 139,
      clientY: 60,
    });
    fireEvent.mouseMove(document, { clientX: 178.6, clientY: 60 });
    fireEvent.mouseUp(document, { clientX: 178.6, clientY: 60 });

    expect(onSelect).toHaveBeenCalledWith(0);
    expect(onParameterChange).toHaveBeenCalledWith('LONOTE', 40);
  });

  it('clamps note boundary drags to the documented Akai minimum', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'DRAG NOTE   ',
      LOVEL1: 0,
      HIVEL1: 127,
    });
    const onParameterChange = vi.fn();

    render(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={0}
        onSelectKeygroup={vi.fn()}
        onParameterChange={onParameterChange}
        visibleRange={{ min: 21, max: 88 }}
      />,
    );
    setSurfaceRect();

    fireEvent.mouseDown(screen.getByTestId('zone-handle-note-low-0'), {
      clientX: 139,
      clientY: 60,
    });
    fireEvent.mouseMove(document, { clientX: 20, clientY: 60 });
    fireEvent.mouseUp(document, { clientX: 20, clientY: 60 });

    expect(onParameterChange).toHaveBeenCalledWith('LONOTE', 21);
  });

  it('commits velocity boundary drags through onParameterChange', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'SOFT        ',
      LOVEL1: 0,
      HIVEL1: 63,
      SNAME2: 'LOUD        ',
      LOVEL2: 64,
      HIVEL2: 127,
    });
    const onParameterChange = vi.fn();

    render(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={0}
        onSelectKeygroup={vi.fn()}
        onParameterChange={onParameterChange}
      />,
    );
    setSurfaceRect();

    fireEvent.mouseDown(screen.getByTestId('zone-handle-velocity-high-0-1'), {
      clientX: 180,
      clientY: 128,
    });
    fireEvent.mouseMove(document, { clientX: 180, clientY: 66.4 });
    fireEvent.mouseUp(document, { clientX: 180, clientY: 66.4 });

    expect(onParameterChange).toHaveBeenCalledWith('HIVEL1', 100);
  });

  it('creates a new keygroup draft when dragging in empty space', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'SOFT        ',
      LOVEL1: 64,
      HIVEL1: 127,
    });
    const onCreateKeygroup = vi.fn();

    render(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={0}
        onSelectKeygroup={vi.fn()}
        onCreateKeygroup={onCreateKeygroup}
        visibleRange={{ min: 21, max: 88 }}
      />,
    );
    setSurfaceRect();

    fireEvent.mouseDown(screen.getByTestId('zone-overview-surface'), {
      clientX: 100,
      clientY: 180,
    });
    expect(screen.getByTestId('zone-overview-create-preview')).toBeInTheDocument();

    fireEvent.mouseMove(document, { clientX: 140, clientY: 120 });
    fireEvent.mouseUp(document, { clientX: 140, clientY: 120 });

    expect(onCreateKeygroup).toHaveBeenCalledWith({
      lowNote: 21,
      highNote: 26,
      lowVelocity: 34,
      highVelocity: 69,
    });
  });

  it('does not create a new keygroup draft when starting inside an existing zone', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'SOFT        ',
      LOVEL1: 0,
      HIVEL1: 127,
    });
    const onCreateKeygroup = vi.fn();

    render(
      <ZoneOverview
        keygroups={[kg]}
        keygroupCount={1}
        selectedKeygroupIndex={0}
        onSelectKeygroup={vi.fn()}
        onCreateKeygroup={onCreateKeygroup}
        visibleRange={{ min: 21, max: 88 }}
      />,
    );
    setSurfaceRect();

    fireEvent.mouseDown(screen.getByTestId('zone-overview-surface'), {
      clientX: 220,
      clientY: 100,
    });
    fireEvent.mouseUp(document, { clientX: 240, clientY: 90 });

    expect(screen.queryByTestId('zone-overview-create-preview')).not.toBeInTheDocument();
    expect(onCreateKeygroup).not.toHaveBeenCalled();
  });
});
