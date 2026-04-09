/**
 * Common-area plugin components shared across all editors.
 *
 * Provides icons, item types, and category factories for samples
 * and programs that live in the common library area.
 */

// Icons
export {
  SampleIcon,
  ProgramIcon,
  ChoppedSampleIcon,
  DrumKitIcon,
} from './icons';

// Item types and metadata
export {
  commonSampleItemType,
  commonProgramItemType,
  type CommonSampleMeta,
  type CommonProgramMeta,
} from './item-types';

// Category factories and components
export {
  NewFolderButton,
  createCommonSamplesCategory,
  createCommonProgramsCategory,
} from './categories';
