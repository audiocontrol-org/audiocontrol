import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { writeKeygroupField } from '@/lib/keygroup-writers';

export interface KeygroupCreationDraft {
  lowNote: number;
  highNote: number;
  lowVelocity: number;
  highVelocity: number;
}

export function buildCreatedKeygroup(
  template: KeygroupHeader,
  draft: KeygroupCreationDraft,
): KeygroupHeader {
  const next = {
    ...template,
    raw: [...template.raw],
  };

  writeKeygroupField(next, 'LONOTE', draft.lowNote);
  writeKeygroupField(next, 'HINOTE', draft.highNote);
  writeKeygroupField(next, 'LOVEL1', draft.lowVelocity);
  writeKeygroupField(next, 'HIVEL1', draft.highVelocity);

  // New drag-created keygroups start as a single-zone mapping.
  writeKeygroupField(next, 'LOVEL2', 0);
  writeKeygroupField(next, 'HIVEL2', 0);
  writeKeygroupField(next, 'LOVEL3', 0);
  writeKeygroupField(next, 'HIVEL3', 0);
  writeKeygroupField(next, 'LOVEL4', 0);
  writeKeygroupField(next, 'HIVEL4', 0);
  writeKeygroupField(next, 'SNAME2', '            ');
  writeKeygroupField(next, 'SNAME3', '            ');
  writeKeygroupField(next, 'SNAME4', '            ');

  return {
    ...next,
    LONOTE: draft.lowNote,
    HINOTE: draft.highNote,
    LOVEL1: draft.lowVelocity,
    HIVEL1: draft.highVelocity,
    LOVEL2: 0,
    HIVEL2: 0,
    LOVEL3: 0,
    HIVEL3: 0,
    LOVEL4: 0,
    HIVEL4: 0,
    SNAME2: '            ',
    SNAME3: '            ',
    SNAME4: '            ',
  };
}
