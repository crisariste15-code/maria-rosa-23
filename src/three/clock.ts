/** Reloj compartido entre el DOM (textos) y el canvas 3D (animación) para la introducción. */
export interface IntroClock {
  now: () => number
  jumpTo: (t: number) => void
}

export function createClock(speed = 1): IntroClock {
  const start = performance.now()
  let offset = 0
  const now = () => ((performance.now() - start) / 1000) * speed + offset
  return {
    now,
    jumpTo: (t: number) => {
      offset += t - now()
    },
  }
}

/** Tiempos (segundos) de cada escena de bienvenida. */
export const T = {
  scene1: 0.8, // «Hay personas que llegan…»
  scene1End: 5.6,
  scene2: 6.2, // las partículas forman la rosa
  scene2End: 12.4,
  form: 5.6, // inicio de la formación de partículas
  appear: 12.2, // aparecen los 23 pétalos
  petalEvery: 0.22,
  open: 17.8, // la rosa abre sus pétalos
  openDur: 7.5,
  name: 20.2, // surge el nombre
  subtitle: 23.0,
  button: 25.2, // aparece el botón
  total: 25.2,
}
