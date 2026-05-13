/**
 * Front Panel Components
 *
 * Virtual front panel for remote Roland S-330 / S-550 control. The
 * canonical mount is the drawer-embedded `<VirtualFrontPanel>` inside
 * `VideoCapture.tsx` per `decisions-2026-05-11.md` Decision 1.
 */

export { FrontPanelButton } from './FrontPanelButton';
export type { FrontPanelButtonProps, FrontPanelButtonVariant } from './FrontPanelButton';
export { VirtualFrontPanel } from './VirtualFrontPanel';
export type { VirtualFrontPanelProps } from './VirtualFrontPanel';
