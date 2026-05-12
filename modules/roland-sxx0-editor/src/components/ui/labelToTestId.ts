/**
 * Convert a slider/control label to a deterministic `data-testid` value.
 *
 * Examples:
 *   "Level" → "param-level"
 *   "A.T Sense" → "param-a-t-sense"
 *   "V-Sw Thresh." → "param-v-sw-thresh"
 *
 * Single source of truth for both `ParameterSlider` (legacy Radix-based)
 * and `ParamSliderRow` (v3 AcSlider + AcNumberInput) so the migration
 * from one to the other preserves test selectors automatically.
 */
export function labelToTestId(label: string): string {
  return `param-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}
