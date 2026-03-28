/**
 * Delete Directory Dialog
 *
 * Confirmation dialog for deleting a directory with preview of contents.
 * Thin wrapper around the shared ConfirmDialog from editor-core.
 */

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { ConfirmDialog } from '@audiocontrol/editor-core';
import { getDirectoryContents, type LibraryCategory, type StorageDirectoryHandle } from '@/lib/library-service';

interface DeleteDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  directoryName: string;
  path: string[];
  category: LibraryCategory;
  libraryHandle: StorageDirectoryHandle | null;
}

export function DeleteDirectoryDialog({
  open,
  onOpenChange,
  onConfirm,
  directoryName,
  path,
  category,
  libraryHandle,
}: DeleteDirectoryDialogProps): JSX.Element | null {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contents, setContents] = useState<{ files: string[]; directories: string[] } | null>(null);
  const [isLoadingContents, setIsLoadingContents] = useState(false);

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

  const handleCancel = useCallback(() => {
    if (!isDeleting) {
      onOpenChange(false);
    }
  }, [isDeleting, onOpenChange]);

  const totalItems = contents
    ? contents.files.length + contents.directories.length
    : 0;

  const categoryLabel = category === 'drum-kits'
    ? 'Drum Kits'
    : category.charAt(0).toUpperCase() + category.slice(1);
  const fullPath = path.join('/');

  const message = buildMessage({
    directoryName,
    categoryLabel,
    fullPath,
    isLoadingContents,
    contents,
    totalItems,
    isDeleting,
    error,
  });

  return (
    <ConfirmDialog
      open={open}
      title="Delete Folder"
      message={message}
      confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
      danger
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}

function buildMessage(params: {
  directoryName: string;
  categoryLabel: string;
  fullPath: string;
  isLoadingContents: boolean;
  contents: { files: string[]; directories: string[] } | null;
  totalItems: number;
  isDeleting: boolean;
  error: string | null;
}): ReactNode {
  const {
    directoryName, categoryLabel, fullPath,
    isLoadingContents, contents, totalItems,
    error,
  } = params;

  return (
    <div>
      <p style={{ margin: '0 0 0.5rem' }}>
        Are you sure you want to delete{' '}
        <strong>"{directoryName}"</strong>?
      </p>
      <p className="ac-text-muted" style={{ fontSize: '0.875rem', fontFamily: 'monospace', margin: '0 0 1rem' }}>
        {categoryLabel}/{fullPath}
      </p>

      {isLoadingContents ? (
        <div className="ac-text-muted" style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span
            style={{
              display: 'inline-block', width: '1rem', height: '1rem',
              border: '1px solid currentColor', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 1s linear infinite',
            }}
          />
          Loading folder contents...
        </div>
      ) : contents && totalItems > 0 ? (
        <div className="ac-alert ac-alert-error" style={{ borderRadius: '0.375rem', padding: '0.75rem', marginBottom: '1rem' }}>
          <p className="ac-text-error" style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            This folder contains {totalItems} item{totalItems !== 1 ? 's' : ''}:
          </p>
          <ul className="ac-text-muted" style={{ fontSize: '0.75rem', maxHeight: '8rem', overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0 }}>
            {contents.directories.map((dir) => (
              <li key={`dir-${dir}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.125rem' }}>
                <svg style={{ width: '0.75rem', height: '0.75rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                {dir}/
              </li>
            ))}
            {contents.files.slice(0, 10).map((file) => (
              <li key={`file-${file}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.125rem' }}>
                {file}
              </li>
            ))}
            {contents.files.length > 10 && (
              <li style={{ fontStyle: 'italic', marginBottom: '0.125rem' }}>
                ...and {contents.files.length - 10} more files
              </li>
            )}
          </ul>
          <p className="ac-text-error" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            All contents will be permanently deleted.
          </p>
        </div>
      ) : contents && totalItems === 0 ? (
        <div className="ac-text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          This folder is empty.
        </div>
      ) : null}

      {error && (
        <div className="ac-alert ac-alert-error ac-text-error" style={{ fontSize: '0.875rem', borderRadius: '0.375rem', padding: '0.5rem 0.75rem' }}>
          {error}
        </div>
      )}
    </div>
  );
}
