export { MidiPortSelector, type MidiPortSelectorProps } from './MidiPortSelector';
export {
  ParameterSlider,
  type ParameterSliderProps,
  type ParameterSliderTheme,
} from './ParameterSlider';

// v3 atomic control primitives (Phase 9 Task 4.0)
export { AcCheckbox, type AcCheckboxProps } from './AcCheckbox';
export {
  AcRangeBar,
  type AcRangeBarProps,
  type AcRangeBarLinearProps,
  type AcRangeBarBipolarProps,
  type AcRangeBarEnumProps,
} from './AcRangeBar';
export { AcSlider, type AcSliderProps } from './AcSlider';
export {
  AcToggle,
  type AcToggleProps,
  type AcToggleOption,
} from './AcToggle';
export {
  AcNumberInput,
  type AcNumberInputProps,
  type AcNumberInputReadProps,
  type AcNumberInputEditProps,
} from './AcNumberInput';
export {
  AcEnvelope,
  type AcEnvelopeProps,
  type AcEnvelopeSegment,
} from './AcEnvelope';
export {
  AcEnvelopeGraph,
  type AcEnvelopeGraphProps,
  type AcEnvelopeGraphSegment,
} from './AcEnvelopeGraph';
export { AcEnvelopeMeta, type AcEnvelopeMetaProps } from './AcEnvelopeMeta';
export {
  AcEnvelopeTable,
  type AcEnvelopeTableProps,
  type AcEnvelopeTableSegment,
} from './AcEnvelopeTable';
export {
  CollapsibleSection,
  type CollapsibleSectionProps,
  type CollapsibleSectionTheme,
} from './CollapsibleSection';
export { NotificationArea, type NotificationAreaProps } from './NotificationArea';
export {
  MidiConnectionPage,
  type MidiConnectionPageConfig,
  type MidiConnectionPageStore,
  type MidiConnectionPageProps,
} from './MidiConnectionPage';

// Layout components
export {
  EditorLayout,
  PanicButton,
  MidiStatusDisplay,
  BuildInfo,
  getBuildInfo,
  type EditorLayoutConfig,
  type EditorLayoutProps,
  type NavItem,
  type PanicButtonProps,
  type MidiStatusDisplayProps,
  type BuildInfoData,
  type BuildInfoConfig,
  type BuildInfoProps,
} from './layout';

// Library components
export {
  TreeView,
  TreeSection,
  PluginLibraryBrowser,
  LIBRARY_ITEM_MIME,
  ContextMenu,
  LibraryPanel,
  LibraryBrowser,
  SampleDetailPanel,
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogActions,
  ConfirmDialog,
  SaveDialog,
  MoveDialog,
  CacheMetricsModal,
  LibraryConnectionUI,
  DrumKitPadList,
  LoadingBar,
  SlideDrawer,
  SteppedProgressDrawer,
  type SteppedProgressDrawerProps,
  type ProgressStep,
  type StepStatus,
  FolderIcon,
  ChevronIcon,
  AudioFileIcon,
  FileIcon,
  DeleteIcon,
  NewFolderIcon,
  ImportIcon,
  RenameIcon,
  MoveIcon,
  CloneIcon,
  RefreshIcon,
  type TreeNode,
  type TreeViewProps,
  type TreeSectionProps,
  type PluginLibraryBrowserProps,
  type LibraryDragPayload,
  type ContextMenuAction,
  type ContextMenuProps,
  type DialogProps,
  type ConfirmDialogProps,
  type SaveDialogProps,
  type SaveDialogResult,
  type DirectoryItem,
  type MoveDialogProps,
  type MoveDialogDirectory,
  type LibraryTab,
  type LibraryPanelProps,
  type LibraryBrowserProps,
  type SampleDetailPanelProps,
  type SampleMetadata,
  type CacheMetricsModalProps,
  type CacheMetricsData,
  type CategoryMetrics,
  // Plugin types
  type PluginContextMenuAction,
  type ItemTypePlugin,
  type CategoryPlugin,
  type CategoryCallbacks,
  type ItemTranslator,
  type SlotGroup,
  type DeviceMemoryRenderProps,
  type DeviceMemoryConfig,
  type ItemSelection,
  type PreviewContext,
  type PreviewPanelConfig,
  type DeviceLibraryPlugin,
  type DeviceMemoryAction,
  type LibraryConnectionUIProps,
  // Tree capability types
  type TreeSelectionCapability,
  type TreeEditCapability,
  type TreeContextMenuCapability,
  type TreeDragCapability,
  type TreeRenderCapability,
} from './library';

// Operation status components
export {
  OperationProgressBar,
  OperationErrorBanner,
  OperationSuccessScreen,
  OperationLoadingSpinner,
  OperationButtonContent,
  type OperationProgressBarProps,
  type OperationErrorBannerProps,
  type OperationSuccessScreenProps,
  type OperationLoadingSpinnerProps,
  type OperationButtonContentProps,
} from './OperationStatus';

// Operation progress types
export {
  isOperationComplete,
  getOverallPercent,
  formatBytes,
  type OperationProgress,
  type OperationState,
} from '../types/operation-progress';

// Kit configuration types
export {
  type BaseKitConfig,
  type KitOutputConfigProps,
} from '../types/kit-config';

// WAV file metadata types
export {
  type WavFileMetadata,
} from '../types/wav-file-info';

// SVG glow components
export {
  VfdGlowDefs,
  VfdGlowPath,
  VfdGlowCircle,
  type VfdGlowDefsProps,
  type VfdGlowVariant,
} from './svg';

// Broken variant registry (Phase 9R-A test discipline reform)
// See docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md §5
// for the credibility-check usage. NOT for production consumption.
export {
  BROKEN_PRIMITIVES,
  BROKEN_CONTEXTS,
  type BrokenPrimitives,
  type BrokenContexts,
  type AcRangeBarVariantKey,
  type AcEnvelopeTableVariantKey,
  type BrokenContextKey,
} from './__broken__/registry';

// Dev-only wrapper for the Tier 3 production-route credibility dispatcher.
// Reads `?context=<variant>` and wraps children in the matching broken
// context. Production builds must gate the mount on `import.meta.env.DEV`.
export {
  BrokenContextWrapper,
  type BrokenContextWrapperProps,
} from './__broken__/BrokenContextWrapper';
