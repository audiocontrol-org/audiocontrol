import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';

export interface DraggableZonesFixture {
  id: string;
  label: string;
  description: string;
  sampleNames: string[];
  keygroups: KeygroupHeader[];
}

export const DRAGGABLE_ZONES_FIXTURES: DraggableZonesFixture[] = [
  {
    id: 'stacked-layers',
    label: 'Stacked Layers',
    description:
      'Two adjacent keygroups with split velocity layers for boundary editing and alignment checks.',
    sampleNames: ['Warm Pad', 'Bright Pad', 'Soft Pluck', 'Hard Pluck'],
    keygroups: [
      makeKeygroupHeader({
        LONOTE: 36,
        HINOTE: 72,
        SNAME1: 'Warm Pad    ',
        LOVEL1: 0,
        HIVEL1: 63,
        SNAME2: 'Bright Pad  ',
        LOVEL2: 64,
        HIVEL2: 127,
      }),
      makeKeygroupHeader({
        LONOTE: 73,
        HINOTE: 96,
        SNAME1: 'Soft Pluck  ',
        LOVEL1: 0,
        HIVEL1: 79,
        SNAME2: 'Hard Pluck  ',
        LOVEL2: 80,
        HIVEL2: 127,
      }),
    ],
  },
  {
    id: 'dense-splits',
    label: 'Dense Splits',
    description:
      'Three tightly packed keygroups with four velocity zones to stress the overview and velocity bar.',
    sampleNames: ['Kick', 'Snare', 'Hat', 'Clap', 'Bass', 'Lead'],
    keygroups: [
      makeKeygroupHeader({
        LONOTE: 24,
        HINOTE: 48,
        SNAME1: 'Kick        ',
        LOVEL1: 0,
        HIVEL1: 31,
        SNAME2: 'Snare       ',
        LOVEL2: 32,
        HIVEL2: 63,
        SNAME3: 'Hat         ',
        LOVEL3: 64,
        HIVEL3: 95,
        SNAME4: 'Clap        ',
        LOVEL4: 96,
        HIVEL4: 127,
      }),
      makeKeygroupHeader({
        LONOTE: 49,
        HINOTE: 72,
        SNAME1: 'Bass        ',
        LOVEL1: 0,
        HIVEL1: 95,
        SNAME2: 'Lead        ',
        LOVEL2: 96,
        HIVEL2: 127,
      }),
      makeKeygroupHeader({
        LONOTE: 73,
        HINOTE: 108,
        SNAME1: 'Lead        ',
        LOVEL1: 0,
        HIVEL1: 127,
      }),
    ],
  },
];

export function getDraggableZonesFixture(
  fixtureId: string | null | undefined,
): DraggableZonesFixture {
  return (
    DRAGGABLE_ZONES_FIXTURES.find((fixture) => fixture.id === fixtureId) ??
    DRAGGABLE_ZONES_FIXTURES[0]
  );
}
