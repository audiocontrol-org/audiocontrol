/**
 * SVG path wrapper that applies VFD glow filter
 *
 * Wraps a standard SVG <path> element with the VFD phosphor glow effect.
 * Automatically applies the appropriate glow filter based on the variant prop.
 */

import type { SVGProps } from 'react';

export type VfdGlowVariant = 'default' | 'subtle' | 'intense';

interface VfdGlowPathProps extends SVGProps<SVGPathElement> {
  /** Glow intensity variant */
  variant?: VfdGlowVariant;
  /** Disable glow effect */
  noGlow?: boolean;
}

const filterMap: Record<VfdGlowVariant, string> = {
  default: 'url(#vfd-glow)',
  subtle: 'url(#vfd-glow-subtle)',
  intense: 'url(#vfd-glow-intense)',
};

export function VfdGlowPath({
  variant = 'default',
  noGlow = false,
  filter,
  ...pathProps
}: VfdGlowPathProps): JSX.Element {
  const glowFilter = noGlow ? undefined : (filter ?? filterMap[variant]);

  return <path filter={glowFilter} {...pathProps} />;
}
