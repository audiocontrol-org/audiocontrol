import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { KeygroupSummary } from '@/components/programs/KeygroupSummary';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';

describe('KeygroupSummary', () => {
  it('renders "No keygroups" when keygroupCount is 0', () => {
    render(
      <KeygroupSummary keygroups={[]} keygroupCount={0} isLoading={false} />,
    );

    expect(screen.getByText('No keygroups')).toBeInTheDocument();
    expect(screen.getByText('Program keygroups')).toBeInTheDocument();
    // Count is a separate <span aria-hidden> alongside the label.
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders "Loading keygroups…" when isLoading and all keygroups are undefined', () => {
    const keygroups = [undefined, undefined];

    render(
      <KeygroupSummary keygroups={keygroups} keygroupCount={2} isLoading={true} />,
    );

    expect(screen.getByText('Loading keygroups…')).toBeInTheDocument();
    expect(screen.getByText('Program keygroups')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders keygroup rows with correct note range, sample name, and zone count', () => {
    // MIDI note 36 = C2, MIDI note 72 = C5
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'BASS DRUM   ',
      SNAME2: 'KICK HARD   ',
      SNAME3: '            ',
      SNAME4: '            ',
    });

    render(
      <KeygroupSummary keygroups={[kg]} keygroupCount={1} isLoading={false} />,
    );

    expect(screen.getByText('Program keygroups')).toBeInTheDocument();
    // Note range: C2 — C5
    expect(screen.getByText(/C2/)).toBeInTheDocument();
    expect(screen.getByText(/C5/)).toBeInTheDocument();
    // Primary sample name
    expect(screen.getByText('BASS DRUM')).toBeInTheDocument();
    // One extra zone (SNAME2 has a value)
    expect(screen.getByText('+1 zone')).toBeInTheDocument();
  });

  it('shows "+N zones" (plural) when multiple extra zones have values', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 72,
      SNAME1: 'PAD SOFT    ',
      SNAME2: 'PAD MED     ',
      SNAME3: 'PAD HARD    ',
      SNAME4: '            ',
    });

    render(
      <KeygroupSummary keygroups={[kg]} keygroupCount={1} isLoading={false} />,
    );

    expect(screen.getByText('+2 zones')).toBeInTheDocument();
  });

  it('shows "+3 zones" when all velocity zones have samples', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 72,
      SNAME1: 'ZONE1       ',
      SNAME2: 'ZONE2       ',
      SNAME3: 'ZONE3       ',
      SNAME4: 'ZONE4       ',
    });

    render(
      <KeygroupSummary keygroups={[kg]} keygroupCount={1} isLoading={false} />,
    );

    expect(screen.getByText('+3 zones')).toBeInTheDocument();
  });

  it('shows "(none)" when SNAME1 is empty', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 72,
      SNAME1: '            ',
    });

    render(
      <KeygroupSummary keygroups={[kg]} keygroupCount={1} isLoading={false} />,
    );

    expect(screen.getByText('(none)')).toBeInTheDocument();
  });

  it('does not show zone badge when no extra zones have samples', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 72,
      SNAME1: 'KICK        ',
      SNAME2: '            ',
      SNAME3: '            ',
      SNAME4: '            ',
    });

    render(
      <KeygroupSummary keygroups={[kg]} keygroupCount={1} isLoading={false} />,
    );

    expect(screen.getByText('KICK')).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+ zone/)).not.toBeInTheDocument();
  });

  it('shows "Loading keygroup N…" for undefined entries in the array', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 72,
      SNAME1: 'LOADED      ',
    });

    // First keygroup loaded, second and third still loading
    const keygroups: (KeygroupHeader | undefined)[] = [kg, undefined, undefined];

    render(
      <KeygroupSummary keygroups={keygroups} keygroupCount={3} isLoading={false} />,
    );

    expect(screen.getByText('LOADED')).toBeInTheDocument();
    expect(screen.getByText('Loading keygroup 2…')).toBeInTheDocument();
    expect(screen.getByText('Loading keygroup 3…')).toBeInTheDocument();
  });

  it('renders multiple keygroup rows', () => {
    const kg1 = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 59,
      SNAME1: 'LOW BASS    ',
    });
    const kg2 = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 84,
      SNAME1: 'MID PAD     ',
    });

    render(
      <KeygroupSummary keygroups={[kg1, kg2]} keygroupCount={2} isLoading={false} />,
    );

    expect(screen.getByText('Program keygroups')).toBeInTheDocument();
    // Count appears in head; row indices "1" "2" appear in each row's index cell.
    // Query the count specifically via its class to disambiguate.
    const count = document.querySelector('.ac-summary-head__count');
    expect(count?.textContent).toBe('2');
    expect(screen.getByText('LOW BASS')).toBeInTheDocument();
    expect(screen.getByText('MID PAD')).toBeInTheDocument();
  });
});

describe('KeygroupSummary interactive', () => {
  it('renders Add button when onAddKeygroup is provided', () => {
    const onAdd = vi.fn();

    render(
      <KeygroupSummary
        keygroups={[]}
        keygroupCount={0}
        isLoading={false}
        onAddKeygroup={onAdd}
      />,
    );

    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('does not render Add button when onAddKeygroup is not provided', () => {
    render(
      <KeygroupSummary keygroups={[]} keygroupCount={0} isLoading={false} />,
    );

    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
  });

  it('clicking Add calls onAddKeygroup', () => {
    const onAdd = vi.fn();

    render(
      <KeygroupSummary
        keygroups={[]}
        keygroupCount={0}
        isLoading={false}
        onAddKeygroup={onAdd}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('Add button is disabled when isLoading', () => {
    const onAdd = vi.fn();

    render(
      <KeygroupSummary
        keygroups={[undefined]}
        keygroupCount={1}
        isLoading={true}
        onAddKeygroup={onAdd}
      />,
    );

    const addButton = screen.getByRole('button', { name: /add/i });
    expect(addButton).toBeDisabled();
  });

  it('renders delete button for each keygroup row when onDeleteKeygroup is provided', () => {
    const kg1 = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 59,
      SNAME1: 'KG ONE      ',
    });
    const kg2 = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 84,
      SNAME1: 'KG TWO      ',
    });
    const onDelete = vi.fn();

    render(
      <KeygroupSummary
        keygroups={[kg1, kg2]}
        keygroupCount={2}
        isLoading={false}
        onDeleteKeygroup={onDelete}
      />,
    );

    const deleteButtons = screen.getAllByTitle(/Delete keygroup/);
    expect(deleteButtons).toHaveLength(2);
    expect(screen.getByTitle('Delete keygroup 1')).toBeInTheDocument();
    expect(screen.getByTitle('Delete keygroup 2')).toBeInTheDocument();
  });

  it('does not render delete buttons when onDeleteKeygroup is not provided', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 72,
      SNAME1: 'NO DELETE   ',
    });

    render(
      <KeygroupSummary
        keygroups={[kg]}
        keygroupCount={1}
        isLoading={false}
      />,
    );

    expect(screen.queryByTitle(/Delete keygroup/)).not.toBeInTheDocument();
  });

  it('clicking delete calls onDeleteKeygroup with correct index', () => {
    const kg1 = makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 59,
      SNAME1: 'FIRST       ',
    });
    const kg2 = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 84,
      SNAME1: 'SECOND      ',
    });
    const onDelete = vi.fn();

    render(
      <KeygroupSummary
        keygroups={[kg1, kg2]}
        keygroupCount={2}
        isLoading={false}
        onDeleteKeygroup={onDelete}
      />,
    );

    // Click delete on the second keygroup (index 1)
    fireEvent.click(screen.getByTitle('Delete keygroup 2'));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('clicking delete on the first keygroup calls onDeleteKeygroup with index 0', () => {
    const kg = makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 72,
      SNAME1: 'ONLY ONE    ',
    });
    const onDelete = vi.fn();

    render(
      <KeygroupSummary
        keygroups={[kg]}
        keygroupCount={1}
        isLoading={false}
        onDeleteKeygroup={onDelete}
      />,
    );

    fireEvent.click(screen.getByTitle('Delete keygroup 1'));
    expect(onDelete).toHaveBeenCalledWith(0);
  });
});
