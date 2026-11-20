import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FINAL } from '../data/content'
import { activateStar, useWorld } from '../world/store'

export function FinaleSection({ webgl }: { webgl: boolean }) {
  const w = useWorld()
  const [phase, setPhase] = useState<0 | 1 | 2>(0) // 0 antes de tocar · 1 mensaje de la estrella · 2 felicitación final

  useEffect(() => {
    if (!w.star) {
      setPhase(0)
      return
    }
    setPhase(1)
    const id = window.setTimeout(() => setPhase(2), 9800)
    return () => window.clearTimeout(id)
  }, [w.star])

  return (
    <section data-wp="finale" className="relative h-[165svh]">
      <div className="sticky top-0 flex h-svh flex-col items-center px-4 pt-[9svh] pb-[5svh] text-center">
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.header
              key="p0"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              viewport={{ amount: 0.3 }}
              transition={{ duration: 1.2 }}
              className="pointer-events-none"
            >
              <p className="text-lg tracking-[0.4em] text-champagne uppercase drop-shadow-[0_2px_10px_rgba(5,3,20,.9)]">Sorpresa final</p>
              <h2 className="font-script rose-text text-5xl drop-shadow-[0_4px_24px_rgba(5,3,30,.8)] sm:text-7xl">Un cielo lleno de estrellas</h2>
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2.6 }}
                className="gold-text mt-3 text-2xl font-semibold"
              >
                ✨ {FINAL.starPrompt} ✨
              </motion.p>
            </motion.header>
          )}
          {phase === 1 && (
            <motion.div
              key="p1"
              initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(8px)' }}
              transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
              className="glass pointer-events-auto max-w-2xl px-8 py-8"
              role="status"
              aria-live="polite"
            >
              <p className="font-script rose-text text-3xl leading-snug sm:text-5xl">«{FINAL.starMessage}»</p>
            </motion.div>
          )}
          {phase === 2 && (
            <motion.div
              key="p2"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
              className="glass pointer-events-auto max-w-2xl px-8 py-8"
              role="status"
              aria-live="polite"
            >
              <p className="gold-text text-3xl leading-snug font-semibold sm:text-5xl">{FINAL.birthday}</p>
              <p className="font-script mt-4 text-4xl text-blush sm:text-5xl">{FINAL.signature}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sin WebGL: la estrella es un botón */}
        {!webgl && phase === 0 && (
          <div className="pointer-events-auto flex flex-1 items-center">
            <motion.button
              onClick={activateStar}
              aria-label="Tocar la estrella"
              className="text-[7rem] leading-none drop-shadow-[0_0_30px_rgba(255,220,150,.8)]"
              animate={{ scale: [1, 1.12, 1], rotate: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              ⭐
            </motion.button>
          </div>
        )}
        {!webgl && phase === 2 && (
          <div className="flex flex-1 items-center text-[6rem]" aria-hidden>
            💐
          </div>
        )}

        {phase === 2 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3, duration: 1.4 }}
            className="btn-ghost pointer-events-auto mt-auto"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            ↑ Volver al principio del jardín
          </motion.button>
        )}
      </div>

      {/* Alternativa accesible a tocar la estrella */}
      <button className="sr-only" onClick={activateStar}>
        Tocar la estrella para ver la sorpresa final
      </button>
    </section>
  )
}
