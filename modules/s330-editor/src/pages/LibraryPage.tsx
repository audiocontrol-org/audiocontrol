/**
 * Library page - Saved patches and tones
 */

export function LibraryPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-s330-text">Library</h2>

      <div className="card">
        <h3 className="font-medium text-s330-text mb-4">Saved Patches</h3>
        <p className="text-s330-muted mb-4">
          Your saved patches will appear here. Patches are stored locally in your
          browser using IndexedDB.
        </p>
        <div className="bg-s330-bg rounded-md p-8 text-center">
          <div className="text-4xl mb-4">📂</div>
          <p className="text-s330-muted">No saved patches yet</p>
          <p className="text-xs text-s330-muted mt-2">
            Use the "Save to Library" button when editing patches
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-s330-text mb-4">Import / Export</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-s330-bg rounded-md p-4">
            <h4 className="font-medium text-s330-text mb-2">Import</h4>
            <p className="text-sm text-s330-muted mb-3">
              Import patches from JSON files
            </p>
            <button className="btn btn-secondary w-full" disabled>
              Import JSON
            </button>
          </div>
          <div className="bg-s330-bg rounded-md p-4">
            <h4 className="font-medium text-s330-text mb-2">Export</h4>
            <p className="text-sm text-s330-muted mb-3">
              Export all patches to JSON
            </p>
            <button className="btn btn-secondary w-full" disabled>
              Export All
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-s330-text mb-4">Storage Info</h3>
        <ul className="text-sm text-s330-muted space-y-2">
          <li>
            <strong className="text-s330-text">Storage Type:</strong> Browser IndexedDB
          </li>
          <li>
            <strong className="text-s330-text">Persistence:</strong> Data stays in your
            browser until cleared
          </li>
          <li>
            <strong className="text-s330-text">Sync:</strong> Use export/import to
            backup or share patches
          </li>
        </ul>
      </div>
    </div>
  );
}
