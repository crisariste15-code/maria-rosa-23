import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createClock, T, type IntroClock } from '../three/clock'
import { music } from '../lib/music'
import type { Tier } from '../lib/device'
import { FallbackRose } from './FallbackRose'

const IntroScene = lazy(() => import('../three/IntroScene'))

interface Props {
  onEnter: () => void
  webgl: boolean
  tier: Tier
  reduced: boolean
}

const fade = {
  initial: { opacity: 0, y: 14, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(8px)' },
  transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] as const },
}

export function IntroExperience({ onEnter, webgl, tier, reduced }: Props) {
  const [started, setStarted] = useState(false)
  const [diving, setDiving] = useState(false)
  const [t, setT] = useState(0)
  const clockRef = useRef<IntroClock | null>(null)
  const diveRef = useRef(0)
  const flashRef = useRef<HTMLDivElement>(null)

  const begin = useCallback(
    (withMusic: boolean) => {
      if (withMusic) void music.start()
      clockRef.current = createClock(reduced ? 1.5 : 1)
      setStarted(true)
    },
    [reduced],
  )

  useEffect(() => {
    if (!started) return
    const id = window.setInterval(() => {
      if (clockRef.current) setT(clockRef.current.now())
    }, 100)
    return () => window.clearInterval(id)
  }, [started])

  const skip = () => {
    clockRef.current?.jumpTo(T.total + 0.2)
    setT(T.total + 0.2)
  }

  const enter = () => {
    if (diving) return
    setDiving(true)
    const dur = reduced ? 900 : 2900
    const t0 = performance.now()
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur)
      diveRef.current = k
      if (flashRef.current) {
        const f = Math.max(0, (k - 0.55) / 0.45)
        flashRef.current.style.opacity = String(f * f)
      }
      if (k < 1) requestAnimationFrame(step)
      else onEnter()
    }
    requestAnimationFrame(step)
  }

  const clock = clockRef.current
  const petalN = Math.max(0, Math.min(23, Math.floor((t - T.appear) / T.petalEvery) + 1))
  const showCounter = started && t > T.appear && t < T.open + 2.5 && !diving

  return (
    <div className="fixed inset-0 overflow-hidden bg-night">
      {/* Fondo mientras carga / pantalla inicial */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 55%, #2a0d2e 0%, #120720 45%, #07030d 100%)' }}
      />
      <Stars />

      {started && clock && webgl && (
        <Suspense fallback={null}>
          <IntroScene clock={clock} diveRef={diveRef} tier={tier} reduced={reduced} />
        </Suspense>
      )}
      {started && clock && !webgl && <FallbackRose t={t} />}

      {/* Velo inferior para leer los textos */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%]"
        style={{ background: 'linear-gradient(to top, rgba(7,3,13,.92), rgba(7,3,13,.55) 45%, transparent)' }}
      />

      {/* ----- Pantalla de entrada ----- */}
      <AnimatePresence>
        {!started && (
          <motion.div
            key="gate"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center"
            exit={{ opacity: 0, transition: { duration: 1 } }}
          >
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.6, delay: 0.3 }}
              className="mb-2 text-lg tracking-[0.4em] text-champagne/80 uppercase"
            >
              Para
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.8, delay: 0.6 }}
              className="font-script rose-text text-6xl leading-tight sm:text-8xl"
            >
              María Rosa
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.8, delay: 1.3 }}
              className="mt-3 max-w-md text-xl text-pearl/80 italic"
            >
              Un pequeño universo creado con muchísimo cariño.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.4, delay: 2.0 }}
              className="mt-10 flex flex-col items-center gap-4"
            >
              <button className="btn-rose" onClick={() => begin(true)}>
                🎵 Comenzar con música
              </button>
              <button className="btn-ghost" onClick={() => begin(false)}>
                Comenzar en silencio
              </button>
              <p className="mt-2 text-sm text-pearl/50">Se recomienda el sonido encendido y la pantalla en horizontal o vertical, como prefieras.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----- Textos de las escenas ----- */}
      {started && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end px-6 pb-[11vh] text-center transition-opacity duration-700"
          style={{ opacity: diving ? 0 : 1 }}
        >
          <AnimatePresence mode="wait">
            {t > T.scene1 && t < T.scene1End && (
              <motion.p key="e1" {...fade} className="absolute top-1/2 max-w-2xl -translate-y-1/2 px-6 text-2xl leading-relaxed text-pearl italic sm:text-4xl">
                «Hay personas que llegan a nuestra vida y, sin darse cuenta, la hacen un poquito más bonita...»
              </motion.p>
            )}
            {t > T.scene2 && t < T.name - 1 && (
              <motion.p key="e2" {...fade} className="max-w-xl text-2xl text-pearl italic sm:text-3xl">
                «Hoy, este pequeño universo florece por alguien muy especial».
              </motion.p>
            )}
            {t >= T.name && (
              <motion.div key="e3" {...fade} className="flex flex-col items-center">
                <h2 className="gold-text text-4xl leading-tight font-semibold tracking-[0.18em] sm:text-6xl">MARÍA ROSA</h2>
                <h2 className="gold-text mt-1 text-xl font-medium tracking-[0.32em] sm:text-3xl">ÑAÑAC VALENCIA</h2>
                {t >= T.subtitle && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.4 }}
                    className="font-script mt-4 text-3xl text-blush sm:text-4xl"
                  >
                    Felices 23 primaveras, María Rosa. 🌹
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {t >= T.button && !diving && (
              <motion.div
                key="btn"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.4 }}
                className="pointer-events-auto mt-7"
              >
                <button className="btn-rose pulse-glow" onClick={enter}>
                  Descubre este pequeño mundo que preparé para ti
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Contador de pétalos: 23 pétalos = 23 primaveras */}
      <AnimatePresence>
        {showCounter && (
          <motion.div
            key="counter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-[9vh] z-10 text-center"
          >
            <p className="gold-text text-5xl font-semibold tabular-nums">{petalN}</p>
            <p className="text-sm tracking-[0.35em] text-champagne/80 uppercase">de 23 primaveras</p>
          </motion.div>
        )}
      </AnimatePresence>

      {started && !diving && t < T.total && (
        <button
          onClick={skip}
          className="absolute top-4 right-4 z-30 rounded-full border border-white/20 bg-black/30 px-4 py-2 font-ui text-xs text-white/70 backdrop-blur hover:text-white"
        >
          Saltar introducción
        </button>
      )}

      {/* Destello rosado al atravesar los pétalos */}
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 z-40 opacity-0"
        style={{ background: 'radial-gradient(circle at 50% 50%, #fff6f2 0%, #ffd0de 40%, #f7a8c4 100%)' }}
      />
    </div>
  )
}

/** Estrellitas CSS para la pantalla de entrada (no dependen de WebGL). */
function Stars() {
  const dots = Array.from({ length: 46 }, (_, i) => ({
    left: (i * 53) % 100,
    top: (i * 37 + 11) % 100,
    size: 1 + (i % 3),
    delay: (i % 9) * 0.45,
    dur: 2.4 + (i % 5) * 0.7,
  }))
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-champagne"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            opacity: 0.4,
            animation: `twinkle ${d.dur}s ease-in-out ${d.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
