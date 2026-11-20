import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LETTER } from '../data/content'

type Stage = 'closed' | 'opening' | 'reading'

export function LetterSection() {
  const [stage, setStage] = useState<Stage>('closed')
  const [read, setRead] = useState(false)

  const openEnvelope = () => {
    if (stage !== 'closed') return
    setStage('opening')
    window.setTimeout(() => setStage('reading'), 1300)
  }
  const close = () => setStage('closed')
  const opened = stage !== 'closed'

  return (
    <section data-wp="letter" className="relative flex min-h-svh flex-col items-center justify-center px-5 py-24">
      <motion.header
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.5 }}
        transition={{ duration: 1.3 }}
        className="mb-12 text-center"
      >
        <p className="text-lg tracking-[0.4em] text-champagne uppercase drop-shadow">Una carta</p>
        <h2 className="font-script rose-text mt-2 text-5xl drop-shadow sm:text-7xl">De Cris, para ti</h2>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 50, rotate: -3 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ amount: 0.4 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto"
      >
        <button
          type="button"
          onClick={read ? () => setStage('reading') : openEnvelope}
          aria-label={read ? 'Volver a abrir la carta' : 'Abrir el sobre'}
          className="relative block cursor-pointer"
          style={{ width: 'min(84vw, 440px)', aspectRatio: '1.5 / 1', perspective: 1200 }}
        >
          {/* parte trasera */}
          <div
            className="absolute inset-0 rounded-md"
            style={{ background: 'linear-gradient(160deg, #f4e4c4, #e3cc9f)', boxShadow: '0 30px 70px rgba(6,2,14,.65), inset 0 0 40px rgba(150,110,50,.25)' }}
          />
          {/* hoja asomando */}
          <motion.div
            className="paper absolute right-[7%] left-[7%] rounded-sm"
            style={{ top: '8%', bottom: '8%' }}
            animate={{ y: opened ? '-34%' : '0%' }}
            transition={{ duration: 0.9, delay: opened ? 0.35 : 0, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto mt-5 h-[2px] w-2/3 bg-[#c9a96a]/40" />
            <div className="mx-auto mt-3 h-[2px] w-1/2 bg-[#c9a96a]/30" />
          </motion.div>
          {/* frente del sobre */}
          <div
            className="absolute inset-0 rounded-md"
            style={{
              background: 'linear-gradient(170deg, #f8ecd3, #e8d3a8)',
              clipPath: 'polygon(0 0, 50% 56%, 100% 0, 100% 100%, 0 100%)',
              boxShadow: 'inset 0 0 30px rgba(150,110,50,.2)',
              zIndex: 3,
            }}
          />
          {/* solapa */}
          <motion.div
            className="absolute inset-x-0 top-0"
            style={{
              height: '58%',
              transformOrigin: 'top center',
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              background: 'linear-gradient(180deg, #f1dfb8, #dcc28f)',
              zIndex: opened ? 1 : 4,
              backfaceVisibility: 'hidden',
            }}
            animate={{ rotateX: opened ? 180 : 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          />
          {/* sello */}
          <motion.div
            className="absolute left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full text-2xl"
            style={{
              top: 'calc(56% - 28px)',
              zIndex: 5,
              background: 'radial-gradient(circle at 35% 30%, #e9708f, #a31d44 70%, #6f0e2c)',
              boxShadow: '0 4px 14px rgba(60,5,25,.55), inset 0 2px 4px rgba(255,255,255,.35)',
            }}
            animate={{ opacity: opened ? 0 : 1, scale: opened ? 0.4 : 1 }}
            transition={{ duration: 0.4 }}
          >
            🌹
          </motion.div>
        </button>
        <motion.p
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="mt-8 text-center text-xl text-pearl italic drop-shadow-[0_2px_10px_rgba(20,8,34,.95)]"
        >
          {read ? 'Toca el sobre para volver a leerla' : 'Toca el sobre para abrir tu carta'}
        </motion.p>
      </motion.div>

      <AnimatePresence>
        {stage === 'reading' && <LetterModal instant={read} onFinished={() => setRead(true)} onClose={close} />}
      </AnimatePresence>
    </section>
  )
}

function Corner({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={`pointer-events-none absolute h-20 w-20 sm:h-28 sm:w-28 ${className}`} aria-hidden>
      <g fill="none" stroke="#8fa88c" strokeWidth="1.6" strokeLinecap="round">
        <path d="M6 114 C 6 60, 30 20, 114 6" />
        <path d="M22 98 c-14 -4 -16 -18 -10 -26 c 8 2 14 10 10 26z" fill="#9db39a" fillOpacity=".4" />
        <path d="M44 70 c-12 -8 -10 -22 -2 -28 c 8 6 10 16 2 28z" fill="#9db39a" fillOpacity=".4" />
        <path d="M76 44 c-6 -12 2 -22 12 -24 c 2 10 -2 18 -12 24z" fill="#9db39a" fillOpacity=".4" />
      </g>
      <circle cx="30" cy="30" r="10" fill="#e8a3bb" />
      <circle cx="30" cy="30" r="6" fill="#d9799a" />
      <circle cx="30" cy="30" r="2.4" fill="#a24a69" />
      <circle cx="60" cy="16" r="5" fill="#f3c9d5" />
      <circle cx="16" cy="60" r="5" fill="#f3c9d5" />
    </svg>
  )
}

function LetterModal({ instant, onFinished, onClose }: { instant: boolean; onFinished: () => void; onClose: () => void }) {
  const full = useMemo(() => {
    const parts = [LETTER.greeting, ...LETTER.paragraphs, LETTER.closing, LETTER.signature]
    return parts
  }, [])
  const total = useMemo(() => full.reduce((s, p) => s + p.length, 0), [full])
  const [n, setN] = useState(instant ? total : 0)
  const [done, setDone] = useState(instant)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (done) return
    let i = n
    const id = window.setInterval(() => {
      i += 2
      if (i >= total) {
        i = total
        window.clearInterval(id)
        setDone(true)
        onFinished()
      }
      setN(i)
    }, 36)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  useEffect(() => {
    const el = scroller.current
    if (el && !instant) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [n, instant])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  let left = n
  const slices = full.map((p) => {
    const take = Math.max(0, Math.min(p.length, left))
    left -= p.length
    return p.slice(0, take)
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="pointer-events-auto fixed inset-0 z-[65] flex items-center justify-center bg-[rgba(11,6,20,.7)] p-3 backdrop-blur-md sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Carta de Cris para María Rosa"
    >
      <motion.div
        initial={{ y: 80, scale: 0.9, rotate: -2, opacity: 0 }}
        animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
        exit={{ y: 40, scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="paper relative flex max-h-[92svh] w-full max-w-2xl flex-col rounded-md"
      >
        <Corner className="top-1 left-1" />
        <Corner className="top-1 right-1 [transform:scaleX(-1)]" />
        <Corner className="bottom-1 left-1 [transform:scaleY(-1)]" />
        <Corner className="right-1 bottom-1 [transform:scale(-1,-1)]" />
        <div ref={scroller} className="relative z-10 overflow-y-auto px-9 py-12 sm:px-16 sm:py-16">
          <div className="font-hand text-[1.55rem] leading-[1.55] font-semibold text-[#4a2a22] sm:text-[1.8rem]">
            <p className="mb-5">{slices[0]}</p>
            {LETTER.paragraphs.map((_, i) => (
              <p key={i} className="mb-4">
                {slices[i + 1]}
              </p>
            ))}
            <p className="mt-7 italic">{slices[full.length - 2]}</p>
            <p className="mt-1 text-[1.9rem] sm:text-[2.2rem]">{slices[full.length - 1]}</p>
            {!done && <span className="ml-0.5 inline-block h-6 w-[2px] animate-pulse bg-[#4a2a22]" aria-hidden />}
          </div>
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 border-t border-[#c9a96a]/40 px-4 py-3">
          {!done && (
            <button
              className="rounded-full border border-[#b08a4a] px-4 py-2 font-ui text-sm text-[#6a4a2a] hover:bg-[#b08a4a]/10"
              onClick={() => {
                setN(total)
                setDone(true)
                onFinished()
              }}
            >
              Mostrar la carta completa
            </button>
          )}
          <button
            className="rounded-full bg-[#a31d44] px-5 py-2 font-ui text-sm font-semibold text-white hover:bg-[#8a1739]"
            onClick={onClose}
          >
            {done ? 'Cerrar la carta' : 'Cerrar'}
          </button>
        </div>
        {done && <FallingPetals />}
      </motion.div>
    </motion.div>
  )
}

function FallingPetals() {
  const petals = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: Math.random() * 100,
        size: 12 + Math.random() * 16,
        delay: Math.random() * 2.5,
        dur: 6 + Math.random() * 5,
        drift: (Math.random() - 0.5) * 120,
        rot: 180 + Math.random() * 360,
        hue: 335 + Math.random() * 20,
        key: i,
      })),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-md" aria-hidden>
      {petals.map((p) => (
        <motion.span
          key={p.key}
          className="absolute block"
          style={{
            left: `${p.left}%`,
            top: -30,
            width: p.size,
            height: p.size * 1.3,
            borderRadius: '70% 0 70% 0',
            background: `linear-gradient(135deg, hsl(${p.hue} 80% 82%), hsl(${p.hue} 70% 62%))`,
            opacity: 0.85,
          }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 0 }}
          animate={{ y: '110vh', x: [0, p.drift, -p.drift / 2, p.drift / 3], rotate: p.rot, opacity: [0, 0.9, 0.9, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}
