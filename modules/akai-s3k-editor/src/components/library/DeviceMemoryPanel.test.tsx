import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeviceMemoryPanel } from './DeviceMemoryPanel';

describe('DeviceMemoryPanel context menus', () => {
  const baseProps = {
    programNames: ['PROGRAM1'],
    sampleNames: ['SAMPLE1', 'SAMPLE2'],
    selectedIndex: null,
    selectedType: null as 'program' | 'sample' | null,
    onSelectProgram: vi.fn(),
    onSelectSample: vi.fn(),
    onRefresh: vi.fn(),
    isConnected: true,
    isLoading: false,
  };

  it('sample context menu shows all actions when all callbacks provided', () => {
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onSaveSampleToCommonLibrary={vi.fn()}
        onSaveSampleToDeviceLibrary={vi.fn()}
        onRenameSample={vi.fn()}
        onDeleteSample={vi.fn()}
      />,
    );

    const sampleButton = screen.getByTestId('device-sample-0');
    fireEvent.contextMenu(sampleButton);

    expect(screen.getByText('Save to Common Samples')).toBeInTheDocument();
    expect(screen.getByText('Save to Akai Samples')).toBeInTheDocument();
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Delete from Device')).toBeInTheDocument();
  });

  it('program context menu shows all actions when all callbacks provided', () => {
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onSaveProgramToCommonLibrary={vi.fn()}
        onSaveProgramToDeviceLibrary={vi.fn()}
        onRenameProgram={vi.fn()}
        onDeleteProgram={vi.fn()}
      />,
    );

    const programButton = screen.getByTestId('device-program-0');
    fireEvent.contextMenu(programButton);

    expect(screen.getByText('Save to Common Library')).toBeInTheDocument();
    expect(screen.getByText('Save to Akai Library')).toBeInTheDocument();
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Delete from Device')).toBeInTheDocument();
  });

  it('context menu shows no actions when no callbacks provided', () => {
    render(<DeviceMemoryPanel {...baseProps} />);

    const sampleButton = screen.getByTestId('device-sample-0');
    fireEvent.contextMenu(sampleButton);

    expect(screen.queryByText('Save to Common Samples')).not.toBeInTheDocument();
    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete from Device')).not.toBeInTheDocument();
  });

  it('context menu shows only delete when only delete callback provided', () => {
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onDeleteSample={vi.fn()}
      />,
    );

    const sampleButton = screen.getByTestId('device-sample-0');
    fireEvent.contextMenu(sampleButton);

    expect(screen.queryByText('Save to Common Samples')).not.toBeInTheDocument();
    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    expect(screen.getByText('Delete from Device')).toBeInTheDocument();
  });
});

describe('DeviceMemoryPanel CRUD', () => {
  const baseProps = {
    programNames: ['PROGRAM1', 'PROGRAM2'],
    sampleNames: ['SAMPLE1', 'SAMPLE2'],
    selectedIndex: null,
    selectedType: null as 'program' | 'sample' | null,
    onSelectProgram: vi.fn(),
    onSelectSample: vi.fn(),
    onRefresh: vi.fn(),
    isConnected: true,
    isLoading: false,
  };

  it('shows ConfirmDialog when delete button is clicked', () => {
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onDeleteProgram={vi.fn()}
      />,
    );

    const deleteButton = screen.getByTestId('device-program-0')
      .closest('li')!
      .querySelector('button[title="Delete from device"]') as HTMLElement;
    fireEvent.click(deleteButton);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Delete 'PROGRAM1' from device? This cannot be undone.")).toBeInTheDocument();
  });

  it('calls onDeleteProgram after confirming delete', async () => {
    const onDeleteProgram = vi.fn();
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onDeleteProgram={onDeleteProgram}
      />,
    );

    // Open confirm dialog via delete button
    const deleteButton = screen.getByTestId('device-program-0')
      .closest('li')!
      .querySelector('button[title="Delete from device"]') as HTMLElement;
    fireEvent.click(deleteButton);

    // Confirm the deletion
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    expect(onDeleteProgram).toHaveBeenCalledWith(0, 'PROGRAM1');
  });

  it('canceling delete closes ConfirmDialog', () => {
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onDeleteProgram={vi.fn()}
      />,
    );

    // Open confirm dialog
    const deleteButton = screen.getByTestId('device-program-0')
      .closest('li')!
      .querySelector('button[title="Delete from device"]') as HTMLElement;
    fireEvent.click(deleteButton);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // Cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('double-clicking a program enters rename mode', () => {
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onRenameProgram={vi.fn()}
      />,
    );

    const programButton = screen.getByTestId('device-program-0');
    fireEvent.dblClick(programButton);

    const input = screen.getByDisplayValue('PROGRAM1');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('submitting rename calls onRenameProgram with new name', () => {
    const onRenameProgram = vi.fn();
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onRenameProgram={onRenameProgram}
      />,
    );

    // Enter rename mode
    fireEvent.dblClick(screen.getByTestId('device-program-0'));

    const input = screen.getByDisplayValue('PROGRAM1');
    fireEvent.change(input, { target: { value: 'NEW NAME' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameProgram).toHaveBeenCalledWith(0, 'NEW NAME');
  });

  it('pressing Escape cancels rename', () => {
    const onRenameProgram = vi.fn();
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onRenameProgram={onRenameProgram}
      />,
    );

    // Enter rename mode
    fireEvent.dblClick(screen.getByTestId('device-program-0'));

    const input = screen.getByDisplayValue('PROGRAM1');
    fireEvent.change(input, { target: { value: 'CHANGED' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // Should exit rename mode without calling onRename
    expect(onRenameProgram).not.toHaveBeenCalled();
    // The original name should be visible again
    expect(screen.getByText('PROGRAM1')).toBeInTheDocument();
  });

  it('clone button is rendered for programs', () => {
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onCloneProgram={vi.fn()}
      />,
    );

    const cloneButton = screen.getByTestId('device-program-0')
      .closest('li')!
      .querySelector('button[title="Clone program"]');
    expect(cloneButton).toBeInTheDocument();
  });

  it('clone button calls onCloneProgram', () => {
    const onCloneProgram = vi.fn();
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onCloneProgram={onCloneProgram}
      />,
    );

    const cloneButton = screen.getByTestId('device-program-0')
      .closest('li')!
      .querySelector('button[title="Clone program"]') as HTMLElement;
    fireEvent.click(cloneButton);

    expect(onCloneProgram).toHaveBeenCalledWith(0, 'PROGRAM1');
  });

  it('delete button uses ac-list-action-btn--danger class', () => {
    render(
      <DeviceMemoryPanel
        {...baseProps}
        onDeleteProgram={vi.fn()}
      />,
    );

    const deleteButton = screen.getByTestId('device-program-0')
      .closest('li')!
      .querySelector('button[title="Delete from device"]') as HTMLElement;
    expect(deleteButton).toHaveClass('ac-list-action-btn--danger');
    expect(deleteButton).toHaveClass('ac-list-action-btn');
  });
});
