import { describe, it, expect, vi } from 'vitest';
import { createTransferActionHandler } from './useLibraryOperations';
import type { TreeNode } from '@/components/library/TreeView';

function makeNode(name: string, meta: Record<string, unknown> = {}): TreeNode {
  return { id: name, name, type: 'sample', children: [], meta };
}

describe('createTransferActionHandler', () => {
  it('calls the correct handler for a declared action', () => {
    const handler = vi.fn();
    const actionHandler = createTransferActionHandler(
      { 'send-sample-to-device': handler },
      [],
    );

    const result = actionHandler('samples', 'send-sample-to-device', makeNode('test', { path: ['a'] }));
    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledWith('test', ['a']);
  });

  it('returns false for undeclared action IDs', () => {
    const actionHandler = createTransferActionHandler<'send-sample-to-device'>(
      { 'send-sample-to-device': vi.fn() },
      [],
    );

    const result = actionHandler('samples', 'promote-to-common-area', makeNode('test'));
    expect(result).toBe(false);
  });

  it('returns false for completely unknown action IDs', () => {
    const actionHandler = createTransferActionHandler<never>({});
    const result = actionHandler('samples', 'nonexistent-action', makeNode('test'));
    expect(result).toBe(false);
  });

  it('restricts send-program-to-device to device-specific categories', () => {
    const handler = vi.fn();
    const actionHandler = createTransferActionHandler(
      { 'send-program-to-device': handler },
      ['s3k-programs'],
    );

    // Should handle for device-specific category
    expect(actionHandler('s3k-programs', 'send-program-to-device', makeNode('test', { dirName: 'd' }))).toBe(true);
    expect(handler).toHaveBeenCalledWith('d', 'test');

    // Should NOT handle for common-area category
    handler.mockClear();
    expect(actionHandler('common-programs', 'send-program-to-device', makeNode('test'))).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('restricts import-instrument to NON-device-specific categories', () => {
    const handler = vi.fn();
    const actionHandler = createTransferActionHandler(
      { 'import-instrument': handler },
      ['s3k-programs'],
    );

    // Should handle for common-area
    expect(actionHandler('common-programs', 'import-instrument', makeNode('test', { directoryName: 'd' }))).toBe(true);

    // Should NOT handle for device-specific
    handler.mockClear();
    expect(actionHandler('s3k-programs', 'import-instrument', makeNode('test'))).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('empty handler map returns false for all actions', () => {
    const actionHandler = createTransferActionHandler<never>({});
    expect(actionHandler('samples', 'send-sample-to-device', makeNode('test'))).toBe(false);
    expect(actionHandler('samples', 'import-drum-kit', makeNode('test'))).toBe(false);
    expect(actionHandler('samples', 'promote-to-common-area', makeNode('test'))).toBe(false);
  });
});
