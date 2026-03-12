/**
 * Delete Directory Dialog
 *
 * Confirmation dialog for deleting a directory with preview of contents.
 */

import { useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { getDirectoryContents, type LibraryCategory } from '@/lib/library-service';

interface DeleteDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  directoryName: string;
  path: string[];
  category: LibraryCategory;
  libraryHandle: FileSystemDirectoryHandle | null;
}

export function DeleteDirectoryDialog({
  open,
  onOpenChange,
  onConfirm,
  directoryName,
  path,
  category,
  libraryHandle,
}: DeleteDirectoryDialogProps): JSX.Element {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contents, setContents] = useState<{ files: string[]; directories: string[] } | null>(null);
  const [isLoadingContents, setIsLoadingContents] = useState(false);

  // Load directory contents when dialog opens
  useEffect(() => {
    if (open && libraryHandle) {
      setIsLoadingContents(true);
      setContents(null);
      setError(null);

      getDirectoryContents(libraryHandle, category, path)
        .then(setContents)
        .catch((err) => {
          console.error('[DeleteDirectoryDialog] Failed to load contents:', err);
          setContents({ files: [], directories: [] });
        })
        .finally(() => setIsLoadingContents(false));
    }
  }, [open, libraryHandle, category, path]);

  const handleConfirm = useCallback(async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete folder');
    } finally {
      setIsDeleting(false);
    }
  }, [onConfirm, onOpenChange]);

  const totalItems = contents
    ? contents.files.length + contents.directories.length
    : 0;

  const categoryLabel = category === 'drum-kits' ? 'Drum Kits' : category.charAt(0).toUpperCase() + category.slice(1);
  const fullPath = path.join('/');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
          <div className="card p-6">
            <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
              Delete Folder
            </Dialog.Title>

            <div className="mb-4">
              <p className="text-s330-text mb-2">
                Are you sure you want to delete{' '}
                <span className="font-medium text-s330-highlight">"{directoryName}"</span>?
              </p>
              <p className="text-sm text-s330-muted font-mono">
                {categoryLabel}/{fullPath}
              </p>
            </div>

            {/* Contents preview */}
            {isLoadingContents ? (
              <div className="mb-4 text-sm text-s330-muted flex items-center gap-2">
                <span className="inline-block w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
                Loading folder contents...
              </div>
            ) : contents && totalItems > 0 ? (
              <div className="mb-4 bg-red-900/20 rounded p-3">
                <p className="text-sm text-red-400 font-medium mb-2">
                  This folder contains {totalItems} item{totalItems !== 1 ? 's' : ''}:
                </p>
                <ul className="text-xs text-s330-muted space-y-0.5 max-h-32 overflow-y-auto">
                  {contents.directories.map((dir) => (
                    <li key={`dir-${dir}`} className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-s330-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {dir}/
                    </li>
                  ))}
                  {contents.files.slice(0, 10).map((file) => (
                    <li key={`file-${file}`} className="truncate">
                      {file}
                    </li>
                  ))}
                  {contents.files.length > 10 && (
                    <li className="italic">
                      ...and {contents.files.length - 10} more files
                    </li>
                  )}
                </ul>
                <p className="text-xs text-red-400 mt-2">
                  All contents will be permanently deleted.
                </p>
              </div>
            ) : contents && totalItems === 0 ? (
              <div className="mb-4 text-sm text-s330-muted">
                This folder is empty.
              </div>
            ) : null}

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
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleConfirm}
                className="ac-btn bg-red-600 hover:bg-red-700 text-white"
                disabled={isDeleting || isLoadingContents}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
