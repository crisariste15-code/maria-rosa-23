import { lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import type { Tier } from '../lib/device'
import { CONCEPT, QUOTES } from '../data/content'
import { Gallery } from './Gallery'
import { LetterSection } from './Letter'
import { WishesSection } from './Wishes'
import { FinaleSection } from './Finale'

const WorldCanvas = lazy(() => import('../world/WorldCanvas'))

interface Props {
  webgl: boolean
  tier: Tier
  reduced: boolean
}

export function Experience({ webgl, tier, reduced }: Props) {
  return (
    <div className="relative">
      {webgl ? (
        <Suspense fallback={<StaticBackdrop />}>
          <WorldCanvas tier={tier} reduced={reduced} />
        </Suspense>
      ) : (
        <StaticBackdrop />
      )}
      {/* viñeta suave para dar profundidad y leer mejor los textos */}
      <div
        className="pointer-events-none fixed inset-0 z-[5]"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(11,6,20,.5) 100%)' }}
      />
      <main className="pointer-events-none relative z-10">
        <Welcome />
        <QuoteBlock wp="q1" text={QUOTES[0]} align="center" />
        <QuoteBlock wp="q2" text={QUOTES[1]} align="left" />
        <Gallery webgl={webgl} />
        <QuoteBlock wp="q3" text={QUOTES[2]} align="right" />
        <LetterSection />
        <QuoteBlock wp="q4" text={QUOTES[3]} align="center" />
        <WishesSection webgl={webgl} />
        <QuoteBlock wp="q5" text={QUOTES[4]} align="left" />
        <FinaleSection webgl={webgl} />
      </main>
    </div>
  )
}

function Welcome() {
  return (
    <section data-wp="welcome" className="relative flex min-h-svh flex-col items-center justify-center px-6 py-24 text-center">
      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, delay: 0.5 }}
        className="text-lg tracking-[0.45em] text-champagne uppercase drop-shadow"
      >
        🌹 De Cris, para
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, scale: 0.92, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 2, delay: 0.8 }}
        className="font-script rose-text mt-2 text-6xl leading-tight whitespace-nowrap drop-shadow-[0_4px_30px_rgba(120,40,90,.5)] sm:text-9xl"
      >
        María Rosa
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.8, delay: 1.6 }}
        className="mt-1 text-3xl font-medium tracking-[0.3em] text-pearl uppercase drop-shadow-[0_3px_14px_rgba(70,20,80,.85)] sm:text-5xl"
      >
        23 primaveras
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.8, delay: 2.2 }}
        className="mt-4 text-xl text-pearl italic drop-shadow-[0_2px_12px_rgba(20,8,34,.9)] sm:text-2xl"
      >
        Un pequeño universo creado con muchísimo cariño.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.6, delay: 2.8 }}
        className="glass pointer-events-auto mt-12 max-w-2xl px-7 py-6 text-lg leading-relaxed text-pearl/95 italic sm:text-xl"
      >
        «{CONCEPT}»
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, delay: 4 }}
        className="absolute bottom-8 flex flex-col items-center gap-2 text-sm tracking-[0.3em] text-champagne/80 uppercase"
      >
        <span>Desliza para recorrer el jardín</span>
        <motion.span animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-xl">
          ↓
        </motion.span>
      </motion.div>
    </section>
  )
}

function QuoteBlock({ wp, text, align }: { wp: string; text: string; align: 'left' | 'center' | 'right' }) {
  const pos = align === 'left' ? 'sm:mr-auto sm:ml-[6vw]' : align === 'right' ? 'sm:ml-auto sm:mr-[6vw]' : 'mx-auto'
  return (
    <section data-wp={wp} className="relative flex min-h-[88svh] items-center px-5 py-16">
      <motion.blockquote
        initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ amount: 0.4, once: false }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        className={`glass pointer-events-auto relative w-full max-w-2xl px-8 py-10 text-center ${pos}`}
      >
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-3xl" aria-hidden>
          🌸
        </span>
        <p className="font-script rose-text text-4xl leading-snug sm:text-6xl">{text}</p>
      </motion.blockquote>
    </section>
  )
}

/** Fondo de respaldo (sin WebGL o mientras carga): atardecer pastel con estrellitas. */
export function StaticBackdrop() {
  return (
    <div
      className="fixed inset-0 z-0"
      style={{ background: 'linear-gradient(180deg, #3b2766 0%, #8c5a9c 38%, #e9b0cb 72%, #fbe4cf 100%)' }}
      aria-hidden
    >
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${(i * 47) % 100}%`,
            top: `${(i * 29) % 70}%`,
            width: 1 + (i % 3),
            height: 1 + (i % 3),
            animation: `twinkle ${2 + (i % 5)}s ease-in-out ${(i % 7) * 0.4}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
