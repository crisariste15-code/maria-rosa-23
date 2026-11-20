export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(
      (window as unknown as { WebGLRenderingContext?: unknown }).WebGLRenderingContext &&
        (c.getContext('webgl2') || c.getContext('webgl')),
    )
  } catch {
    return false
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export type Tier = 'low' | 'mid' | 'high'

/** Nivel de rendimiento estimado, para adaptar partículas y calidad. */
export function perfTier(): Tier {
  const mobile =
    window.matchMedia('(max-width: 820px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4
  if (prefersReducedMotion()) return 'low'
  if (mobile && (cores <= 4 || mem <= 3)) return 'low'
  if (mobile) return 'mid'
  return cores >= 8 ? 'high' : 'mid'
}
