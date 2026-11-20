import { motion } from 'framer-motion'
import { T } from '../three/clock'

/** Rosa 2D (SVG) para dispositivos sin WebGL: mantiene la secuencia emotiva de bienvenida. */
export function FallbackRose({ t }: { t: number }) {
  const petals = Array.from({ length: 23 }, (_, i) => i)
  const shown = Math.max(0, Math.min(23, Math.floor((t - T.appear) / T.petalEvery) + 1))
  return (
    <div className="absolute inset-0 flex items-center justify-center pb-[22vh]" aria-hidden>
      <motion.svg
        viewBox="-110 -110 220 220"
        className="h-[min(62vw,46vh)] w-[min(62vw,46vh)] drop-shadow-[0_0_40px_rgba(255,90,140,.45)]"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 120, ease: 'linear' }}
      >
        {petals.map((i) => {
          const a = i * 137.5
          const r = 18 + i * 3.4
          return (
            <motion.path
              key={i}
              d={`M0 0 C ${r * 0.55} ${-r * 0.2}, ${r * 0.7} ${-r * 0.95}, 0 ${-r} C ${-r * 0.7} ${-r * 0.95}, ${-r * 0.55} ${-r * 0.2}, 0 0 Z`}
              fill={`hsl(${346 - i * 0.6} 78% ${26 + i * 1.5}%)`}
              stroke="rgba(255,200,215,.35)"
              strokeWidth={0.5}
              transform={`rotate(${a})`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: i < shown ? 0.92 : 0, scale: i < shown ? 1 : 0 }}
              transition={{ duration: 0.9 }}
            />
          )
        })}
      </motion.svg>
    </div>
  )
}
