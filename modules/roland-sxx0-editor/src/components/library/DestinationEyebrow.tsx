/**
 * DestinationEyebrow
 *
 * Shared eyebrow row rendered at the top of every export-drawer body
 * (`ExportToneDialog`, `ExportPatchDialog`, `BatchExportDrawer`).
 * Renders the operator-orienting tag chain:
 *
 *   {KIND_LABEL} · {leftField} · LIBRARY · {DEVICE_NAME} [· {targetPath}]
 *
 * Extracted 2026-05-22 from the three inline JSX blocks per clones.yaml
 * group 38c8236d8a7b disposition. Pre-extraction the three surfaces held
 * the same .ac-detail-eyebrow-row + .ac-detail-eyebrow-accent + .ac-
 * detail-eyebrow-sep + data-testid="<prefix>-(destination|device-name|
 * target-path)" shape, differing only in the testid prefix + kind label
 * + leftField semantics (slot label vs "N ITEMS"). Contract preserved
 * (testid suffixes, accent label text, LIBRARY literal, device-name
 * span) by D-LIB-34 / D-LIB-35 / D-LIB-36 wiring assertions added
 * before this extraction.
 */

export interface DestinationEyebrowProps {
  /** Uppercase kind label shown in the accent span (e.g. "TONE",
   *  "PATCH", "TONES", "PATCHES"). Callers compute the plural/singular
   *  variant; the component does not. */
  kindLabel: string;
  /** Left-of-LIBRARY context field. Single-item flows pass the slot
   *  label (e.g. "T11"); batch flow passes "N ITEMS". Free-form string
   *  so callers can present whatever orientation makes sense. */
  leftField: string;
  /** Device display name from useDeviceConfig (e.g. "S-330", "S-550").
   *  Uppercased at render. AUDIT-20260521-02 contract. */
  deviceName: string;
  /** Library subfolder path; renders as a trailing "· {path}" segment
   *  only when non-empty. Empty array hides the segment entirely. */
  targetPath: string[];
  /** Prefix for the three rendered data-testid attributes:
   *  `<prefix>-destination` on the wrapper, `<prefix>-device-name` on
   *  the device span, `<prefix>-target-path` on the optional path
   *  span. The three existing call sites use `export-tone`,
   *  `export-patch`, `batch-export`. */
  testIdPrefix: string;
}

export function DestinationEyebrow({
  kindLabel,
  leftField,
  deviceName,
  targetPath,
  testIdPrefix,
}: DestinationEyebrowProps): JSX.Element {
  return (
    <div className="ac-detail-eyebrow-row" data-testid={`${testIdPrefix}-destination`}>
      <span className="ac-detail-eyebrow-accent">{kindLabel}</span>
      <span className="ac-detail-eyebrow-sep">·</span>
      <span>{leftField}</span>
      <span className="ac-detail-eyebrow-sep">·</span>
      <span>LIBRARY</span>
      <span className="ac-detail-eyebrow-sep">·</span>
      <span data-testid={`${testIdPrefix}-device-name`}>{deviceName.toUpperCase()}</span>
      {targetPath.length > 0 && (
        <>
          <span className="ac-detail-eyebrow-sep">·</span>
          <span data-testid={`${testIdPrefix}-target-path`}>{targetPath.join(' / ')}</span>
        </>
      )}
    </div>
  );
}
