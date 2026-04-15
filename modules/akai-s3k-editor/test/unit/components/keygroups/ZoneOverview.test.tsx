import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { ZoneOverview } from '@/components/keygroups/ZoneOverview';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';
import { computeKeyRange } from '@/components/keygroups/note-coordinate-utils';

describe('ZoneOverview', () => {
  it('renders empty state when keygroupCount is 0', () => {
    const onSelect = vi.fn();

    render(
      <ZoneOverview
        keygroups={[]}
        keygroupCount={0}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
        noteRange={{ min: 0, max: 127 }}
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

    const keygroups = [kg1, kg2];
    const noteRange = computeKeyRange(keygroups, 2);
    const onSelect = vi.fn();

    render(
      <ZoneOverview
        keygroups={keygroups}
        keygroupCount={2}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
        noteRange={noteRange}
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

    const keygroups = [kg];
    const noteRange = computeKeyRange(keygroups, 1);
    const onSelect = vi.fn();

    render(
      <ZoneOverview
        keygroups={keygroups}
        keygroupCount={1}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
        noteRange={noteRange}
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

    const keygroups = [kg1, kg2];
    const noteRange = computeKeyRange(keygroups, 2);
    const onSelect = vi.fn();

    render(
      <ZoneOverview
        keygroups={keygroups}
        keygroupCount={2}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
        noteRange={noteRange}
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

    const keygroups = [kg];
    const noteRange = computeKeyRange(keygroups, 1);
    const onSelect = vi.fn();

    const { rerender } = render(
      <ZoneOverview
        keygroups={keygroups}
        keygroupCount={1}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
        noteRange={noteRange}
      />,
    );

    // The zone element exists with the zone label (div role="button" to avoid nesting interactive elements)
    const zone = screen.getByText('SELECTED').closest('[role="button"]');
    expect(zone).toBeTruthy();
    expect(zone).toBeInstanceOf(HTMLElement);

    // When not selected, borderWidth should be 1px
    if (!(zone instanceof HTMLElement)) throw new Error('zone is not HTMLElement');
    expect(zone.style.borderWidth).toBe('1px');

    // Re-render with the keygroup selected
    rerender(
      <ZoneOverview
        keygroups={keygroups}
        keygroupCount={1}
        selectedKeygroupIndex={0}
        onSelectKeygroup={onSelect}
        noteRange={noteRange}
      />,
    );

    const selectedZone = screen.getByText('SELECTED').closest('[role="button"]');
    if (!(selectedZone instanceof HTMLElement)) throw new Error('selectedZone is not HTMLElement');
    expect(selectedZone.style.borderWidth).toBe('2px');
    // jsdom normalizes hex colors to rgb format
    expect(selectedZone.style.borderColor).toBe('rgb(147, 197, 253)');
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
    const noteRange = computeKeyRange(keygroups, 3);
    const onSelect = vi.fn();

    // Should not throw — undefined entries are simply skipped
    render(
      <ZoneOverview
        keygroups={keygroups}
        keygroupCount={3}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
        noteRange={noteRange}
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

    const keygroups = [kg];
    const noteRange = computeKeyRange(keygroups, 1);
    const onSelect = vi.fn();

    render(
      <ZoneOverview
        keygroups={keygroups}
        keygroupCount={1}
        selectedKeygroupIndex={null}
        onSelectKeygroup={onSelect}
        noteRange={noteRange}
      />,
    );

    // When no velocity zones are active, it renders "KG 1" as label
    expect(screen.getByText('KG 1')).toBeInTheDocument();
  });
});
