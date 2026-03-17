/**
 * Save dialog for picking a library directory and name.
 * Shows the directory tree from the library, lets the user select a target
 * directory (or create a new one), and enter a sample name.
 *
 * Uses Radix Dialog to properly layer on top of the SampleChopperDialog
 * and manage focus trapping.
 */

import { useCallback, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { LibraryTreeNode } from '@audiocontrol/sampler-library/browser';
import { listChoppedSamples, createSamplesFolder } from './library.js';

interface DirectoryItem {
  name: string;
  path: string[];
  depth: number;
}

function flattenDirectories(
  nodes: LibraryTreeNode[],
  out: DirectoryItem[],
  depth: number,
): void {
  for (const node of nodes) {
    if (node.type === 'directory') {
      out.push({ name: node.name, path: node.path, depth });
      if (node.children) {
        flattenDirectories(node.children, out, depth + 1);
      }
    }
  }
}

export interface SaveDialogResult {
  name: string;
  path: string[];
}

interface SaveDialogProps {
  open: boolean;
  defaultName: string;
  onSave: (result: SaveDialogResult) => void;
  onCancel: () => void;
}

export function SaveDialog({ open, defaultName, onSave, onCancel }: SaveDialogProps): JSX.Element {
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [name, setName] = useState(defaultName);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setSelectedPath([]);
    setNewFolderName('');
    setCreatingFolder(false);
    setLoading(true);
    setError(null);
    listChoppedSamples()
      .then((tree) => {
        const flat: DirectoryItem[] = [];
        flattenDirectories(tree, flat, 0);
        setDirectories(flat);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to list directories'))
      .finally(() => setLoading(false));
  }, [open, defaultName]);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, path: selectedPath });
  }, [name, selectedPath, onSave]);

  const handleCreateFolder = useCallback(async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setCreatingFolder(true);
    try {
      await createSamplesFolder(selectedPath, trimmed);
      const newPath = [...selectedPath, trimmed];
      setDirectories((prev) => {
        const parentIndex = prev.findIndex(
          (d) => d.path.join('/') === selectedPath.join('/') && d.depth === selectedPath.length - 1,
        );
        const insertAt = parentIndex >= 0 ? parentIndex + 1 : prev.length;
        const updated = [...prev];
        updated.splice(insertAt, 0, { name: trimmed, path: selectedPath, depth: selectedPath.length });
        return updated;
      });
      setSelectedPath(newPath);
      setNewFolderName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, selectedPath]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  const selectedPathStr = selectedPath.length > 0 ? selectedPath.join(' / ') : '(top level)';

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-[100]" />
        <Dialog.Content
          className="fixed z-[100] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-ac-panel border border-ac-accent rounded-lg shadow-xl overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          <div className="load-dialog-header">
            <Dialog.Title asChild>
              <h2>Save Sample</h2>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="load-dialog-close">&times;</button>
            </Dialog.Close>
          </div>

          <div className="load-dialog-body">
            {/* Name input */}
            <div className="save-dialog-field">
              <label className="save-dialog-label" htmlFor="save-name">Name</label>
              <input
                id="save-name"
                type="text"
                className="save-dialog-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Directory picker */}
            <div className="save-dialog-field">
              <label className="save-dialog-label">
                Directory: <span className="save-dialog-path">{selectedPathStr}</span>
              </label>
            </div>

            {loading && <p className="load-dialog-status">Scanning library...</p>}
            {error && <p className="load-dialog-error">{error}</p>}

            {!loading && (
              <div className="save-dialog-tree">
                {/* Root option */}
                <button
                  className={`save-dialog-dir ${selectedPath.length === 0 ? 'selected' : ''}`}
                  onClick={() => setSelectedPath([])}
                >
                  / (top level)
                </button>
                {directories.map((dir) => {
                  const dirFullPath = [...dir.path, dir.name];
                  const isSelected = dirFullPath.join('/') === selectedPath.join('/');
                  return (
                    <button
                      key={dirFullPath.join('/')}
                      className={`save-dialog-dir ${isSelected ? 'selected' : ''}`}
                      style={{ paddingLeft: `${1 + (dir.depth + 1) * 1.25}rem` }}
                      onClick={() => setSelectedPath(dirFullPath)}
                    >
                      {dir.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* New folder */}
            <div className="save-dialog-new-folder">
              <input
                type="text"
                className="save-dialog-input save-dialog-folder-input"
                placeholder="New folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateFolder();
                  }
                }}
              />
              <button
                className="save-dialog-folder-btn"
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
              >
                {creatingFolder ? '...' : 'New Folder'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="save-dialog-footer">
            <button className="save-dialog-cancel" onClick={onCancel}>Cancel</button>
            <button
              className="save-dialog-save"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
