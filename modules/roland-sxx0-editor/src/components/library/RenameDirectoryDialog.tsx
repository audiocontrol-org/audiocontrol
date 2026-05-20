/**
 * Rename Directory Dialog
 *
 * Dialog for renaming a directory in the library.
 */

import { useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { cn } from '@/lib/utils';

interface RenameDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newName: string) => Promise<void>;
  currentName: string;
  path: string[];
  category: 'tones' | 'patches' | 'drum-kits';
}

export function RenameDirectoryDialog({
  open,
  onOpenChange,
  onConfirm,
  currentName,
  path,
  category,
}: RenameDirectoryDialogProps): JSX.Element {
  const [name, setName] = useState(currentName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens or currentName changes
  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
      setIsRenaming(false);
    }
  }, [open, currentName]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Folder name cannot be empty');
      return;
    }

    if (trimmedName === currentName) {
      onOpenChange(false);
      return;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmedName)) {
      setError('Folder name contains invalid characters');
      return;
    }

    setIsRenaming(true);
    setError(null);

    try {
      await onConfirm(trimmedName);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename folder');
    } finally {
      setIsRenaming(false);
    }
  }, [name, currentName, onConfirm, onOpenChange]);

  const parentPath = path.slice(0, -1);
  const parentPathDisplay = parentPath.length > 0 ? parentPath.join('/') + '/' : '';
  const categoryLabel = category === 'drum-kits' ? 'Drum Kits' : category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-md p-6">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Rename Folder
          </Dialog.Title>
          <VisuallyHidden.Root>
            <Dialog.Description>
              Rename the selected folder in the library tree.
            </Dialog.Description>
          </VisuallyHidden.Root>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="ac-field-label mb-1">
                Location
              </label>
              <div className="text-sm text-s330-text bg-s330-bg/50 rounded px-3 py-2 font-mono">
                {categoryLabel}/{parentPathDisplay}
                <span className="text-s330-highlight">{name || '...'}</span>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="folder-name" className="ac-field-label mb-1">
                New Name
              </label>
              <input
                id="folder-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter new folder name"
                className={cn('ac-input', error && 'ac-input--error')}
                autoFocus
                disabled={isRenaming}
              />
            </div>

            {error && (
              <div className="mb-4 text-sm text-red-400 bg-red-900/20 rounded px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="ac-btn ac-btn-secondary"
                  disabled={isRenaming}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="ac-btn ac-btn-primary"
                disabled={isRenaming || !name.trim() || name.trim() === currentName}
              >
                {isRenaming ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
