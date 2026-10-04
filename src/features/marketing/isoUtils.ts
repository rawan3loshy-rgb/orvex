/** Maps a flat square onto an isometric plane (30° projection). */
export const ISO = 'matrix(0.866 0.5 -0.866 0.5 0 0)'
export const ISO_K = 1.732

export const mix = (color: string, pct: number, base = 'transparent') => `color-mix(in oklab, ${color} ${pct}%, ${base})`
