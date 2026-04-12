import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { ZoneOverview } from '@/components/keygroups/ZoneOverview';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';

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
    const button = screen.getByText('SELECTED').closest('button');
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

    const selectedButton = screen.getByText('SELECTED').closest('button');
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
});
