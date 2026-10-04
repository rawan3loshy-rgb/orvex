/** Chart geometry helpers (no external charting dependency). */

export function niceMax(v: number) {
  if (v <= 0) return 1
  const exp = Math.floor(Math.log10(v))
  const f = v / 10 ** exp
  const nf = f <= 1 ? 1 : f <= 1.2 ? 1.2 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10
  return nf * 10 ** exp
}

export function ticks(max: number, count = 4) {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i)
}

type P = [number, number]

/** Monotone cubic interpolation (like d3.curveMonotoneX) — no overshoot. */
export function monotonePath(points: P[]) {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${points[0]![0]},${points[0]![1]}`
  if (n === 2) return `M${points[0]![0]},${points[0]![1]}L${points[1]![0]},${points[1]![1]}`
  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1]![0] - points[i]![0])
    dy.push(points[i + 1]![1] - points[i]![1])
    m.push(dy[i]! / (dx[i]! || 1))
  }
  const t: number[] = [m[0]!]
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1]! * m[i]! <= 0) t.push(0)
    else {
      const w1 = 2 * dx[i]! + dx[i - 1]!
      const w2 = dx[i]! + 2 * dx[i - 1]!
      t.push((w1 + w2) / (w1 / m[i - 1]! + w2 / m[i]!))
    }
  }
  t.push(m[n - 2]!)
  let d = `M${points[0]![0]},${points[0]![1]}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]!
    const [x1, y1] = points[i + 1]!
    const h = dx[i]! / 3
    d += `C${x0 + h},${y0 + t[i]! * h} ${x1 - h},${y1 - t[i + 1]! * h} ${x1},${y1}`
  }
  return d
}

export function linearPath(points: P[]) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('')
}

export function arcPath(cx: number, cy: number, r: number, inner: number, start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0
  const p = (a: number, rr: number) => [cx + rr * Math.cos(a - Math.PI / 2), cy + rr * Math.sin(a - Math.PI / 2)]
  const [x0, y0] = p(start, r)
  const [x1, y1] = p(end, r)
  const [x2, y2] = p(end, inner)
  const [x3, y3] = p(start, inner)
  return `M${x0},${y0}A${r},${r} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${inner},${inner} 0 ${large} 0 ${x3},${y3}Z`
}
