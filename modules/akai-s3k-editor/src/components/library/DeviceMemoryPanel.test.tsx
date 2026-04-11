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

  it('sample context menu shows save and delete when all callbacks provided', () => {
    const onSaveCommon = vi.fn();
    const onSaveDevice = vi.fn();
    const onDelete = vi.fn();

    render(
      <DeviceMemoryPanel
        {...baseProps}
        onSaveSampleToCommonLibrary={onSaveCommon}
        onSaveSampleToDeviceLibrary={onSaveDevice}
        onDeleteSample={onDelete}
      />,
    );

    const sampleButton = screen.getByTestId('device-sample-0');
    fireEvent.contextMenu(sampleButton);

    expect(screen.getByText('Save to Common Samples')).toBeInTheDocument();
    expect(screen.getByText('Save to Akai Samples')).toBeInTheDocument();
    expect(screen.getByText('Delete from Device')).toBeInTheDocument();
  });

  it('program context menu shows save and delete when all callbacks provided', () => {
    const onSaveCommon = vi.fn();
    const onSaveDevice = vi.fn();
    const onDelete = vi.fn();

    render(
      <DeviceMemoryPanel
        {...baseProps}
        onSaveProgramToCommonLibrary={onSaveCommon}
        onSaveProgramToDeviceLibrary={onSaveDevice}
        onDeleteProgram={onDelete}
      />,
    );

    const programButton = screen.getByTestId('device-program-0');
    fireEvent.contextMenu(programButton);

    expect(screen.getByText('Save to Common Library')).toBeInTheDocument();
    expect(screen.getByText('Save to Akai Library')).toBeInTheDocument();
    expect(screen.getByText('Delete from Device')).toBeInTheDocument();
  });

  it('context menu shows no actions when no callbacks provided', () => {
    render(<DeviceMemoryPanel {...baseProps} />);

    const sampleButton = screen.getByTestId('device-sample-0');
    fireEvent.contextMenu(sampleButton);

    expect(screen.queryByText('Save to Common Samples')).not.toBeInTheDocument();
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
    expect(screen.getByText('Delete from Device')).toBeInTheDocument();
  });
});
