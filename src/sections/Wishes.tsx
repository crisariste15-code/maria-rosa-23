import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WISHES, WISHES_DONE } from '../data/content'
import { WISH_COUNT, closeWish, openWish, useWorld } from '../world/store'

export function WishesSection({ webgl }: { webgl: boolean }) {
  const w = useWorld()
  const count = w.opened.filter(Boolean).length
  const active = w.activeWish
  const finished = w.allWishes && active < 0

  // Al descubrir el último deseo, se muestra la animación final unos segundos después.
  useEffect(() => {
    if (!w.allWishes || active < 0) return
    const id = window.setTimeout(() => closeWish(), 7000)
    return () => window.clearTimeout(id)
  }, [w.allWishes, active])

  return (
    <section data-wp="wishes" className="relative h-[178svh]">
      <div className="sticky top-0 flex h-svh flex-col items-center justify-between px-4 pt-[9svh] pb-[5svh] text-center">
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.3 }}
          transition={{ duration: 1.2 }}
          className="pointer-events-none"
        >
          <p className="text-lg tracking-[0.4em] text-champagne uppercase drop-shadow-[0_2px_10px_rgba(20,8,34,.9)]">Jardín interactivo</p>
          <h2 className="font-script rose-text text-5xl drop-shadow-[0_4px_24px_rgba(60,10,70,.7)] sm:text-7xl">23 flores, 23 deseos</h2>
          <p className="mt-1 text-xl text-pearl italic drop-shadow-[0_2px_10px_rgba(20,8,34,.95)]">Toca una flor para descubrir su deseo.</p>
          <p className="gold-text mt-2 text-2xl font-semibold tabular-nums drop-shadow-[0_2px_8px_rgba(20,8,34,.8)]">
            {count} de {WISH_COUNT} deseos descubiertos
          </p>
        </motion.header>

        {!webgl && (
          <div className="pointer-events-auto grid max-w-md grid-cols-6 gap-3">
            {Array.from({ length: WISH_COUNT }, (_, i) => (
              <button
                key={i}
                onClick={() => openWish(i)}
                aria-label={`Abrir el deseo ${i + 1}`}
                className={`flex aspect-square items-center justify-center rounded-full border text-xl transition ${
                  w.opened[i] ? 'border-champagne bg-champagne/25' : 'border-blush/50 bg-blush/10 hover:bg-blush/30'
                }`}
              >
                {w.opened[i] ? '🌹' : '🌸'}
              </button>
            ))}
          </div>
        )}

        <div className="pointer-events-auto w-full max-w-xl min-h-[11rem]">
          <AnimatePresence mode="wait">
            {active >= 0 && (
              <motion.div
                key={`w${active}`}
                initial={{ opacity: 0, y: 30, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="glass px-7 py-6"
                role="status"
                aria-live="polite"
              >
                <p className="text-base tracking-[0.35em] text-champagne uppercase">
                  Deseo {active + 1} de {WISH_COUNT}
                </p>
                <p className="font-script rose-text mt-2 text-3xl leading-snug sm:text-4xl">{WISHES[active]}</p>
                <button className="btn-ghost mt-4 !py-2" onClick={closeWish}>
                  {w.allWishes ? 'Continuar' : 'Seguir descubriendo'}
                </button>
              </motion.div>
            )}
            {finished && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2 }}
                className="glass px-7 py-7"
                role="status"
              >
                <p className="text-3xl" aria-hidden>
                  ✨🌹✨
                </p>
                <p className="gold-text mt-2 text-2xl leading-snug font-semibold sm:text-3xl">{WISHES_DONE}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Alternativa accesible: abrir los deseos con teclado o lector de pantalla */}
      <ul className="sr-only">
        {WISHES.map((_, i) => (
          <li key={i}>
            <button onClick={() => openWish(i)}>Abrir el deseo número {i + 1}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
