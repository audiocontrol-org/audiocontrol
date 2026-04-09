/**
 * Shared editor dialog group — renders LoopEditor, SampleChopper, and SampleEditor
 * dialogs from the EditorDialogsCoreResult state.
 *
 * Both S3K and Roland editors use identical dialog wiring. The only device-specific
 * difference is the chopper's output config panel, which is injected via the
 * renderChopperOutputConfig prop.
 */

import type { ReactNode } from 'react';
import type { EditorDialogsCoreResult } from '@/hooks/useEditorDialogsCore';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { ChopperOutputState } from '@audiocontrol/sample-chopper/ui';
import { LoopEditorDialog } from '@audiocontrol/loop-editor/ui';
import { SampleEditorDialog } from '@audiocontrol/sample-editor/ui';
import { SampleChopperDialog } from '@audiocontrol/sample-chopper/ui';

interface EditorDialogGroupProps {
  editorDialogs: EditorDialogsCoreResult;
  libraryRoot: StorageDirectoryHandle | null;
  renderChopperOutputConfig?: (state: ChopperOutputState) => ReactNode;
}

export function EditorDialogGroup({
  editorDialogs,
  libraryRoot,
  renderChopperOutputConfig,
}: EditorDialogGroupProps): JSX.Element {
  return (
    <>
      {editorDialogs.loopEditor && (
        <LoopEditorDialog
          open={editorDialogs.loopEditor.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeLoopEditor(); }}
          samples={editorDialogs.loopEditor.samples}
          sampleRate={editorDialogs.loopEditor.sampleRate}
          sampleName={editorDialogs.loopEditor.sampleName}
          loopStart={editorDialogs.loopEditor.loopStart}
          loopEnd={editorDialogs.loopEditor.loopEnd}
          rootKey={editorDialogs.loopEditor.rootKey}
          onSave={editorDialogs.handleLoopEditorSave}
        />
      )}
      {editorDialogs.chopper && (
        <SampleChopperDialog
          open={editorDialogs.chopper.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeChopper(); }}
          samples={editorDialogs.chopper.samples}
          sampleRate={editorDialogs.chopper.sampleRate}
          sourceName={editorDialogs.chopper.sampleName}
          editMode={!!editorDialogs.chopper.initialSlices}
          initialSlices={editorDialogs.chopper.initialSlices}
          initialLabels={editorDialogs.chopper.initialLabels}
          onConfirm={() => { editorDialogs.closeChopper(); }}
          onSave={libraryRoot ? editorDialogs.handleChopperSave : undefined}
          renderOutputConfig={renderChopperOutputConfig}
        />
      )}
      {editorDialogs.sampleEditor && (
        <SampleEditorDialog
          open={editorDialogs.sampleEditor.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeSampleEditor(); }}
          samples={editorDialogs.sampleEditor.samples}
          sampleRate={editorDialogs.sampleEditor.sampleRate}
          sampleName={editorDialogs.sampleEditor.sampleName}
          onSave={libraryRoot ? editorDialogs.handleSampleEditorSave : undefined}
        />
      )}
    </>
  );
}
