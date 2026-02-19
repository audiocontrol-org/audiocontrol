/**
 * SVG filter definitions for VFD (Vacuum Fluorescent Display) glow effects
 *
 * Creates authentic phosphor glow using multi-layer blur:
 * - Outer diffuse bloom (wide blur, low opacity)
 * - Inner bright halo (tight blur, medium opacity)
 * - Sharp original element on top
 *
 * Variants:
 * - #vfd-glow - default glow for envelope paths and points
 * - #vfd-glow-subtle - reduced intensity for secondary elements
 * - #vfd-glow-intense - brighter glow for active/dragging states
 */

export interface VfdGlowDefsProps {
  /** Glow color - defaults to var(--ac-highlight) */
  color?: string;
  /** Inner glow blur radius - defaults to 2 */
  innerRadius?: number;
  /** Outer glow blur radius - defaults to 4 */
  outerRadius?: number;
}

export function VfdGlowDefs({
  color = 'var(--ac-highlight)',
  innerRadius = 2,
  outerRadius = 4,
}: VfdGlowDefsProps): JSX.Element {
  return (
    <defs>
      {/* Default VFD glow */}
      <filter
        id="vfd-glow"
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        {/* Outer diffuse bloom */}
        <feGaussianBlur
          in="SourceGraphic"
          stdDeviation={outerRadius}
          result="blur-outer"
        />
        <feColorMatrix
          in="blur-outer"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.3 0"
          result="glow-outer"
        />

        {/* Inner bright halo */}
        <feGaussianBlur
          in="SourceGraphic"
          stdDeviation={innerRadius}
          result="blur-inner"
        />
        <feColorMatrix
          in="blur-inner"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.6 0"
          result="glow-inner"
        />

        {/* Composite: outer + inner + original */}
        <feMerge>
          <feMergeNode in="glow-outer" />
          <feMergeNode in="glow-inner" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Subtle glow for secondary elements */}
      <filter
        id="vfd-glow-subtle"
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur
          in="SourceGraphic"
          stdDeviation={outerRadius * 0.75}
          result="blur-outer"
        />
        <feColorMatrix
          in="blur-outer"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.2 0"
          result="glow-outer"
        />

        <feGaussianBlur
          in="SourceGraphic"
          stdDeviation={innerRadius * 0.75}
          result="blur-inner"
        />
        <feColorMatrix
          in="blur-inner"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.4 0"
          result="glow-inner"
        />

        <feMerge>
          <feMergeNode in="glow-outer" />
          <feMergeNode in="glow-inner" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Intense glow for active/dragging states */}
      <filter
        id="vfd-glow-intense"
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        {/* Extra wide outer bloom */}
        <feGaussianBlur
          in="SourceGraphic"
          stdDeviation={outerRadius * 1.5}
          result="blur-outer"
        />
        <feColorMatrix
          in="blur-outer"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.5 0"
          result="glow-outer"
        />

        {/* Brighter inner halo */}
        <feGaussianBlur
          in="SourceGraphic"
          stdDeviation={innerRadius}
          result="blur-inner"
        />
        <feColorMatrix
          in="blur-inner"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.8 0"
          result="glow-inner"
        />

        <feMerge>
          <feMergeNode in="glow-outer" />
          <feMergeNode in="glow-inner" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}
