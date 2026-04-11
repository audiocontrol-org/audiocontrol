import { describe, it, expect } from 'vitest';
import { createCommonSampleItemType, createCommonProgramItemType } from './item-types';
import type { TransferActionId } from '@/hooks/useLibraryOperations';

function actionIds(actions: { id?: string }[]): string[] {
  return actions.filter((a) => a.id).map((a) => a.id!);
}

describe('createCommonSampleItemType', () => {
  it('shows no transfer actions when none are declared', () => {
    const itemType = createCommonSampleItemType(new Set());
    const actions = itemType.getContextMenuActions!({}, { id: 'x', name: 'test', type: 'sample', children: [] });
    const ids = actionIds(actions);

    expect(ids).not.toContain('send-sample-to-device');
    expect(ids).not.toContain('import-drum-kit');
    expect(ids).not.toContain('edit-drum-kit');
    // Editor and file actions are always present
    expect(ids).toContain('open-loop-editor');
    expect(ids).toContain('rename');
    expect(ids).toContain('delete');
  });

  it('shows send-sample-to-device when declared', () => {
    const itemType = createCommonSampleItemType(new Set<TransferActionId>(['send-sample-to-device']));
    const actions = itemType.getContextMenuActions!({}, { id: 'x', name: 'test', type: 'sample', children: [] });
    const ids = actionIds(actions);

    expect(ids).toContain('send-sample-to-device');
    expect(ids).not.toContain('import-drum-kit');
  });

  it('shows import-drum-kit only when declared AND meta.hasDrumKit is true', () => {
    const itemType = createCommonSampleItemType(new Set<TransferActionId>(['import-drum-kit']));

    const withKit = itemType.getContextMenuActions!({ hasDrumKit: true }, { id: 'x', name: 'test', type: 'sample', children: [] });
    expect(actionIds(withKit)).toContain('import-drum-kit');

    const withoutKit = itemType.getContextMenuActions!({ hasDrumKit: false }, { id: 'x', name: 'test', type: 'sample', children: [] });
    expect(actionIds(withoutKit)).not.toContain('import-drum-kit');
  });

  it('hides import-drum-kit when not declared even if meta.hasDrumKit is true', () => {
    const itemType = createCommonSampleItemType(new Set());
    const actions = itemType.getContextMenuActions!({ hasDrumKit: true }, { id: 'x', name: 'test', type: 'sample', children: [] });
    expect(actionIds(actions)).not.toContain('import-drum-kit');
  });
});

describe('createCommonProgramItemType', () => {
  it('shows no transfer actions when none are declared', () => {
    const itemType = createCommonProgramItemType(new Set());
    const actions = itemType.getContextMenuActions!({}, { id: 'x', name: 'test', type: 'program', children: [] });
    const ids = actionIds(actions);

    expect(ids).not.toContain('send-program-to-device');
    expect(ids).not.toContain('promote-to-common-area');
    expect(ids).not.toContain('import-instrument');
    expect(ids).toContain('rename');
    expect(ids).toContain('delete');
  });

  it('shows declared transfer actions', () => {
    const itemType = createCommonProgramItemType(
      new Set<TransferActionId>(['send-program-to-device', 'import-instrument']),
    );
    const actions = itemType.getContextMenuActions!({}, { id: 'x', name: 'test', type: 'program', children: [] });
    const ids = actionIds(actions);

    expect(ids).toContain('send-program-to-device');
    expect(ids).toContain('import-instrument');
    expect(ids).not.toContain('promote-to-common-area');
  });
});
