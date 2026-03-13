/**
 * Create Directory Dialog
 *
 * Simple dialog for creating a new subdirectory in the library.
 */

import { useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface CreateDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => Promise<void>;
  parentPath: string[];
  category: 'tones' | 'patches' | 'drum-kits';
}

export function CreateDirectoryDialog({
  open,
  onOpenChange,
  onConfirm,
  parentPath,
  category,
}: CreateDirectoryDialogProps): JSX.Element {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setIsCreating(false);
    }
  }, [open]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Folder name cannot be empty');
      return;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmedName)) {
      setError('Folder name contains invalid characters');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onConfirm(trimmedName);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setIsCreating(false);
    }
  }, [name, onConfirm, onOpenChange]);

  const parentPathDisplay = parentPath.length > 0 ? parentPath.join('/') + '/' : '';
  const categoryLabel = category === 'drum-kits' ? 'Drum Kits' : category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
          <div className="card p-6">
            <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
              New Folder
            </Dialog.Title>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm text-s330-muted mb-1">
                  Location
                </label>
                <div className="text-sm text-s330-text bg-s330-bg/50 rounded px-3 py-2 font-mono">
                  {categoryLabel}/{parentPathDisplay}
                  <span className="text-s330-highlight">{name || '...'}</span>
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="folder-name" className="block text-sm text-s330-muted mb-1">
                  Folder Name
                </label>
                <input
                  id="folder-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter folder name"
                  className={cn(
                    'w-full px-3 py-2 rounded bg-s330-bg border border-s330-accent',
                    'text-s330-text placeholder-s330-muted/50',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight focus:border-transparent'
                  )}
                  autoFocus
                  disabled={isCreating}
                />
              </div>

              {error && (
                <div className="mb-4 text-sm text-red-400 bg-red-900/20 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="ac-btn ac-btn-secondary"
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  className="ac-btn ac-btn-primary"
                  disabled={isCreating || !name.trim()}
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
