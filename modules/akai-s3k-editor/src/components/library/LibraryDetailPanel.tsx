/**
 * Detail panel for the library browser.
 *
 * Displays metadata about the selected library item (sample, program,
 * chopped-sample, or directory). For samples, shows intrinsic properties
 * like sample rate and loop mode. For programs, shows zone count.
 *
 * SDS (Sample Dump Standard) transfer is now implemented in the S3000XL
 * client (sendSampleViaSds / receiveSampleViaSds). The Samples page
 * exposes the transfer UI. A future phase will add an inline
 * "Export to Device" button here that sends the selected library sample
 * directly to the device via SDS.
 */

import type { TreeNode } from '@audiocontrol/editor-core';

interface LibraryDetailPanelProps {
  node: TreeNode | null;
}

/** Extract a typed meta object from a TreeNode. */
function getMeta(node: TreeNode): Record<string, unknown> {
  return (node.meta ?? {}) as Record<string, unknown>;
}

/** Format the path array as a display string. */
function formatPath(meta: Record<string, unknown>): string {
  const path = meta.path as string[] | undefined;
  return path?.join('/') || '/';
}

/** Render a labeled metadata row. */
function MetaRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200">{String(value)}</span>
    </div>
  );
}

function DirectoryDetail({ node }: { node: TreeNode }) {
  const childCount = node.children?.length ?? 0;
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{node.name}</h3>
      <MetaRow label="Type" value="Folder" />
      <MetaRow label="Items" value={childCount} />
    </div>
  );
}

function SampleDetail({ node }: { node: TreeNode }) {
  const meta = getMeta(node);
  const description = typeof meta.description === 'string' ? meta.description : undefined;
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{node.name}</h3>
      <MetaRow label="Type" value="Sample" />
      <MetaRow label="Path" value={formatPath(meta)} />
      <MetaRow label="Description" value={description} />
    </div>
  );
}

function ProgramDetail({ node }: { node: TreeNode }) {
  const meta = getMeta(node);
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{node.name}</h3>
      <MetaRow label="Type" value="Program" />
      <MetaRow label="Path" value={formatPath(meta)} />
    </div>
  );
}

function GenericDetail({ node }: { node: TreeNode }) {
  const meta = getMeta(node);
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{node.name}</h3>
      <MetaRow label="Type" value={node.type} />
      <MetaRow label="Path" value={formatPath(meta)} />
    </div>
  );
}

export function LibraryDetailPanel({ node }: LibraryDetailPanelProps): JSX.Element {
  if (!node) {
    return (
      <div className="p-4 text-gray-400 text-sm italic">
        Select an item to view details.
      </div>
    );
  }

  return (
    <div className="p-4">
      {node.type === 'directory' && <DirectoryDetail node={node} />}
      {node.type === 'sample' && <SampleDetail node={node} />}
      {node.type === 'program' && <ProgramDetail node={node} />}
      {node.type !== 'directory' && node.type !== 'sample' && node.type !== 'program' && (
        <GenericDetail node={node} />
      )}
    </div>
  );
}
