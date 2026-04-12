import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgramSelector } from '@/components/programs/ProgramSelector';

describe('ProgramSelector', () => {
  const defaultProps = {
    programNames: ['BASS 1', 'PAD WARM', ''],
    selectedIndex: null as number | null,
    onSelect: vi.fn(),
    label: 'Left',
  };

  it('renders a select element with program options', () => {
    render(<ProgramSelector {...defaultProps} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Three program options plus the placeholder
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);

    expect(options[1]).toHaveTextContent('1: BASS 1');
    expect(options[2]).toHaveTextContent('2: PAD WARM');
  });

  it('shows "(empty)" for blank program names', () => {
    render(<ProgramSelector {...defaultProps} />);

    const options = screen.getAllByRole('option');
    // Third program name is blank, so index 3 (0-based option index) should show "(empty)"
    expect(options[3]).toHaveTextContent('3: (empty)');
  });

  it('calls onSelect with correct index when changed', () => {
    const onSelect = vi.fn();
    render(<ProgramSelector {...defaultProps} onSelect={onSelect} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('calls onSelect with null when placeholder is selected', () => {
    const onSelect = vi.fn();
    render(
      <ProgramSelector {...defaultProps} selectedIndex={0} onSelect={onSelect} />,
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('shows "-- Select program --" placeholder when no selection', () => {
    render(<ProgramSelector {...defaultProps} />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('');

    const placeholder = screen.getByText('-- Select program --');
    expect(placeholder).toBeInTheDocument();
  });
});
