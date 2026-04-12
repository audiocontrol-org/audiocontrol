import type {
  DeviceLibraryPlugin,
  ItemSelection,
  PreviewContext,
} from '@audiocontrol/editor-core';
import {
  createCommonSamplesCategory,
  createCommonProgramsCategory,
} from '@audiocontrol/editor-core';

function SamplerPreviewPanel({
  selection,
}: {
  selection: ItemSelection | null;
  context: PreviewContext;
}): JSX.Element {
  if (!selection) {
    return (
      <div className="p-4 text-sm text-gray-500 italic">
        Select a sample or program to preview.
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="text-sm font-medium text-gray-200 mb-1">
        {selection.node.name}
      </div>
      <div className="text-xs text-gray-400">
        Category: {selection.categoryId} &middot; Type: {selection.node.type}
      </div>
      {selection.node.type === 'program' && (
        <div className="mt-3 text-xs text-gray-500">
          Select a program and use the Play page to load it.
        </div>
      )}
    </div>
  );
}

export const samplerLibraryPlugin: DeviceLibraryPlugin = {
  deviceId: 'standalone-sampler',
  deviceName: 'Standalone Sampler',
  categories: [
    createCommonSamplesCategory('samples'),
    createCommonProgramsCategory('programs'),
  ],
  translators: [],
  // No deviceMemory — two-column layout (library browser + preview)
  previewPanel: {
    renderPreview: (selection: ItemSelection | null, context: PreviewContext) => (
      <SamplerPreviewPanel selection={selection} context={context} />
    ),
  },
};
