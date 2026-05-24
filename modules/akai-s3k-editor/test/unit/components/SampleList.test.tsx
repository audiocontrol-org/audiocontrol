import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SampleList } from '@/components/samples/SampleList';

const defaultProps = {
  sampleNames: ['KICK DRUM', 'SNARE HIT', 'HI HAT'],
  selectedIndex: null as number | null,
  onSelect: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
  onRefresh: vi.fn(),
  onRefreshAll: vi.fn(),
  isLoading: false,
};

function renderList(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<SampleList {...props} />);
}

describe('SampleList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sample names in the list', () => {
    renderList();

    expect(screen.getByText('KICK DRUM')).toBeInTheDocument();
    expect(screen.getByText('SNARE HIT')).toBeInTheDocument();
    expect(screen.getByText('HI HAT')).toBeInTheDocument();
  });

  it('calls onSelect when a sample is clicked', () => {
    const onSelect = vi.fn();
    renderList({ onSelect });

    fireEvent.click(screen.getByTestId('sample-item-1'));

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('marks the selected sample with aria-selected="true"', () => {
    // The visual selected-state highlight is owned by the canonical
    // `.ac-list-row[aria-selected="true"]` rule in
    // editor-core/list-primitives.css (promoted from roland during
    // akai-harmonization Phase 2 task 2.2). The unit test asserts
    // the observable contract — the `aria-selected` attribute — not
    // the specific Tailwind class the old chrome used (`bg-blue-600`).
    renderList({ selectedIndex: 0 });

    const button = screen.getByTestId('sample-item-0');
    expect(button.getAttribute('aria-selected')).toBe('true');
  });

  it('does not mark unselected samples as aria-selected', () => {
    renderList({ selectedIndex: 0 });

    const button = screen.getByTestId('sample-item-1');
    expect(button.getAttribute('aria-selected')).toBe('false');
  });

  it('shows hover actions (delete, refresh) via group class', () => {
    renderList();

    // Action buttons are rendered but hidden via CSS opacity-0 / group-hover:opacity-100.
    // They should exist in the DOM for non-empty samples.
    const deleteButtons = screen.getAllByTitle('Delete sample');
    expect(deleteButtons).toHaveLength(3);

    const refreshButtons = screen.getAllByTitle('Reload from device');
    expect(refreshButtons).toHaveLength(3);
  });

  it('double-click starts inline rename', () => {
    const onRename = vi.fn();
    renderList({ onRename });

    const item = screen.getByTestId('sample-item-0');
    fireEvent.doubleClick(item);

    // An input should now be present with the sample name
    const input = screen.getByDisplayValue('KICK DRUM');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('Enter commits rename', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    renderList({ onRename });

    // Start rename via double-click
    fireEvent.doubleClick(screen.getByTestId('sample-item-0'));
    const input = screen.getByDisplayValue('KICK DRUM');

    // Change the value and press Enter
    fireEvent.change(input, { target: { value: 'NEW NAME' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onRename).toHaveBeenCalledWith(0, 'NEW NAME');
  });

  it('Escape cancels rename without calling onRename', () => {
    const onRename = vi.fn();
    renderList({ onRename });

    // Start rename
    fireEvent.doubleClick(screen.getByTestId('sample-item-0'));
    const input = screen.getByDisplayValue('KICK DRUM');

    // Change value then Escape
    fireEvent.change(input, { target: { value: 'CHANGED' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
    // Input should be gone, original name restored
    expect(screen.queryByDisplayValue('CHANGED')).not.toBeInTheDocument();
    expect(screen.getByText('KICK DRUM')).toBeInTheDocument();
  });

  it('shows empty state when no samples', () => {
    renderList({ sampleNames: [] });

    expect(screen.getByText('No samples loaded')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    renderList({ isLoading: true });

    expect(screen.getByText('Loading samples...')).toBeInTheDocument();
  });

  it('does not show action buttons for empty-name samples', () => {
    renderList({ sampleNames: ['KICK DRUM', '   ', ''] });

    // Only the non-empty sample should have action buttons
    const deleteButtons = screen.getAllByTitle('Delete sample');
    expect(deleteButtons).toHaveLength(1);
  });
});
