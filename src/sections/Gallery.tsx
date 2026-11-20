import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion'
import { PHOTOS } from '../data/photos'

const PLACEHOLDERS = Array.from({ length: 6 }, (_, i) => ({
  src: '',
  name: `espacio-${i + 1}`,
  caption: 'Aquí irá un recuerdo especial.',
}))

export function Gallery({ webgl }: { webgl: boolean }) {
  const photos = PHOTOS.length ? PHOTOS : PLACEHOLDERS
  const [open, setOpen] = useState<number | null>(null)
  const n = photos.length
  const cols = n <= 2 ? 'sm:columns-2 max-w-3xl' : n <= 4 ? 'sm:columns-2 max-w-4xl' : 'sm:columns-2 lg:columns-3 max-w-6xl'

  return (
    <section data-wp="gallery" className="relative px-4 py-24 sm:px-8">
      <motion.header
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.5 }}
        transition={{ duration: 1.3 }}
        className="mx-auto max-w-2xl text-center"
      >
        <p className="text-lg tracking-[0.4em] text-champagne uppercase drop-shadow">Recuerdos especiales</p>
        <h2 className="font-script rose-text mt-2 text-5xl drop-shadow sm:text-7xl">Un álbum para ti</h2>
        <p className="mt-3 text-xl text-pearl italic drop-shadow-[0_2px_12px_rgba(20,8,34,.9)]">
          Imágenes que guardan tu esencia. Toca una para verla en grande.
        </p>
      </motion.header>

      <div className={`pointer-events-auto mx-auto mt-14 columns-1 gap-7 ${cols}`}>
        {photos.map((p, i) => (
          <Frame key={p.name} photo={p} index={i} placeholder={!p.src} onOpen={() => p.src && setOpen(i)} />
        ))}
      </div>

      <AnimatePresence>
        {open !== null && PHOTOS.length > 0 && <Lightbox index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
      </AnimatePresence>
      {!webgl && <span className="sr-only">Galería</span>}
    </section>
  )
}

function Frame({
  photo,
  index,
  placeholder,
  onOpen,
}: {
  photo: { src: string; caption: string; name: string }
  index: number
  placeholder: boolean
  onOpen: () => void
}) {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const sx = useSpring(rx, { stiffness: 140, damping: 16 })
  const sy = useSpring(ry, { stiffness: 140, damping: 16 })
  const tilt = (index % 2 ? 1 : -1) * (1 + (index % 3) * 0.6)
  return (
    <motion.figure
      initial={{ opacity: 0, y: 70, rotate: tilt * 2.5, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, rotate: tilt, scale: 1 }}
      viewport={{ amount: 0.2, once: true }}
      transition={{ duration: 1.2, delay: (index % 3) * 0.12, ease: [0.22, 1, 0.36, 1] }}
      style={{ rotateX: sx, rotateY: sy, transformPerspective: 900 }}
      whileHover={{ y: -8, rotate: 0, scale: 1.02 }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
        const r = e.currentTarget.getBoundingClientRect()
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 12)
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 12)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
      className="group mb-8 inline-block w-full break-inside-avoid"
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={placeholder}
        aria-label={placeholder ? 'Espacio reservado para una fotografía' : `Ver en grande: ${photo.caption}`}
        className="block w-full cursor-zoom-in rounded-md p-[10px] text-left disabled:cursor-default"
        style={{
          background: 'linear-gradient(145deg, #f6e4bd, #d6b26a 45%, #f3dfae 70%, #b98f46)',
          boxShadow: '0 20px 60px rgba(6,2,14,.6), 0 0 0 1px rgba(255,255,255,.25) inset',
        }}
      >
        <div className="rounded-[3px] bg-[#fbf3e3] p-[7px]">
          {placeholder ? (
            <div className="flex aspect-[3/4] items-center justify-center rounded-[2px] border-2 border-dashed border-[#c9a96a] bg-[#f3e7cf] p-6 text-center text-[#7a5a3a] italic">
              Aquí irá una fotografía de María Rosa.
            </div>
          ) : (
            <img
              src={photo.src}
              alt={photo.caption}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full rounded-[2px]"
            />
          )}
        </div>
      </button>
      <figcaption className="mt-3 px-1 text-center text-xl text-pearl italic drop-shadow-[0_2px_10px_rgba(20,8,34,.95)]">
        {photo.caption}
      </figcaption>
    </motion.figure>
  )
}

function Lightbox({ index, onClose, onIndex }: { index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const n = PHOTOS.length
  const go = useCallback((d: number) => onIndex((index + d + n) % n), [index, n, onIndex])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [go, onClose])

  const p = PHOTOS[index]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="pointer-events-auto fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[rgba(11,6,20,.62)] px-4 backdrop-blur-2xl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Fotografía ampliada"
    >
      <motion.div
        key={p.name}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) go(1)
          else if (info.offset.x > 80) go(-1)
        }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[86svh] max-w-[92vw] flex-col items-center"
      >
        <div
          className="rounded-md p-[10px]"
          style={{ background: 'linear-gradient(145deg, #f6e4bd, #d6b26a 45%, #f3dfae 70%, #b98f46)', boxShadow: '0 30px 100px rgba(0,0,0,.7)' }}
        >
          <img src={p.src} alt={p.caption} className="max-h-[72svh] max-w-[86vw] rounded-[2px] object-contain" draggable={false} />
        </div>
        <p className="mt-4 text-center text-2xl text-pearl italic">{p.caption}</p>
      </motion.div>
      <button className="btn-ghost absolute top-4 right-4" onClick={onClose} aria-label="Cerrar">
        ✕ Cerrar
      </button>
      {n > 1 && (
        <>
          <button
            className="btn-ghost absolute top-1/2 left-3 -translate-y-1/2 !px-4 !py-3 text-2xl"
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
            aria-label="Foto anterior"
          >
            ‹
          </button>
          <button
            className="btn-ghost absolute top-1/2 right-3 -translate-y-1/2 !px-4 !py-3 text-2xl"
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
            aria-label="Foto siguiente"
          >
            ›
          </button>
        </>
      )}
    </motion.div>
  )
}
