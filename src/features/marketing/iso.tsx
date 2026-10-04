import type { ReactNode } from 'react'
import { ISO } from './isoUtils'

/**
 * One isometric "orvex": a rounded square drawn on the iso plane and
 * extruded downward by `thickness`. Children are drawn in flat coordinates
 * on the top face (centered on 0,0).
 */
export function IsoSlab({
  s,
  thickness = 12,
  top,
  side,
  stroke,
  strokeOpacity = 1,
  radius,
  children,
}: {
  /** Half-size of the flat square. Screen half-width = s·√3, half-height = s. */
  s: number
  thickness?: number
  top: string
  side: string
  stroke: string
  strokeOpacity?: number
  radius?: number
  children?: ReactNode
}) {
  const rx = radius ?? s * 0.16
  const steps: number[] = []
  for (let k = thickness; k > 0; k -= 1.5) steps.push(k)
  return (
    <g>
      {steps.map((k, i) => (
        <rect
          key={k}
          x={-s}
          y={-s}
          width={2 * s}
          height={2 * s}
          rx={rx}
          transform={`translate(0 ${k}) ${ISO}`}
          style={{ fill: side, stroke: i === 0 ? stroke : 'none' }}
          strokeOpacity={strokeOpacity}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <rect x={-s} y={-s} width={2 * s} height={2 * s} rx={rx} transform={ISO} style={{ fill: top, stroke }} strokeOpacity={strokeOpacity} vectorEffect="non-scaling-stroke" />
      {children && <g transform={ISO}>{children}</g>}
    </g>
  )
}
