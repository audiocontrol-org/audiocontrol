/**
 * SVG circle wrapper that applies VFD glow filter
 *
 * Wraps a standard SVG <circle> element with the VFD phosphor glow effect.
 * Automatically applies the appropriate glow filter based on the variant prop.
 */

import type { SVGProps } from 'react';
import type { VfdGlowVariant } from '@/components/svg/vfd-types';

interface VfdGlowCircleProps extends SVGProps<SVGCircleElement> {
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

export function VfdGlowCircle({
  variant = 'default',
  noGlow = false,
  filter,
  ...circleProps
}: VfdGlowCircleProps): JSX.Element {
  const glowFilter = noGlow ? undefined : (filter ?? filterMap[variant]);

  return <circle filter={glowFilter} {...circleProps} />;
}
