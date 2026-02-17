/**
 * Patches page - View and edit D-110 patches
 *
 * A D-110 patch combines up to 8 tones with part configurations.
 */

import { PatchEditor } from '@/components/PatchEditor';

export function PatchesPage(): JSX.Element {
  return (
    <div className="ac-page">
      <PatchEditor />
    </div>
  );
}
