export type V3 = [number, number, number]

/** Centros de las zonas especiales del mundo. */
export const MEADOW: V3 = [0, 0, -40] // 23 flores de los deseos
export const FINALE: V3 = [0, 0, -86] // cielo estrellado
export const STAR_POS: V3 = [0, 7.2, -98]
export const BOUQUET_POS: V3 = [0, 0, -80.6]

export interface Waypoint {
  pos: V3
  look: V3
  /** 0 = atardecer pastel, 1 = noche estrellada */
  night: number
}

/** Puntos de cámara. Cada bloque del DOM con data-wp="clave" ancla uno de ellos. */
export const WP: Record<string, Waypoint> = {
  welcome: { pos: [0, 1.55, 8.5], look: [0, 1.7, 0], night: 0 },
  q1: { pos: [1.3, 1.45, 3.2], look: [-0.4, 1.5, -6], night: 0 },
  q2: { pos: [-1.2, 1.4, -1.5], look: [0.8, 1.6, -10], night: 0.02 },
  gallery: { pos: [0.9, 1.35, -6.5], look: [-0.6, 1.8, -14], night: 0.08 },
  q3: { pos: [-1.0, 1.3, -11], look: [1, 1.7, -19], night: 0.16 },
  letter: { pos: [0.8, 1.25, -15], look: [-0.8, 1.7, -23], night: 0.28 },
  q4: { pos: [-0.8, 1.4, -20.5], look: [0.5, 1.7, -29], night: 0.4 },
  wishes: { pos: [0, 2.9, -32.4], look: [0, 0.75, -40], night: 0.58 },
  q5: { pos: [0, 1.6, -52], look: [0, 2.6, -62], night: 0.82 },
  finale: { pos: [0, 1.5, -76], look: [0, 3.5, -86], night: 1 },
}
