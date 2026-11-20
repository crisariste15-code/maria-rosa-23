import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { motion } from 'framer-motion'
import { hasWebGL, perfTier, prefersReducedMotion } from './lib/device'
import { IntroExperience } from './sections/IntroExperience'
import { Experience } from './sections/Experience'
import { MusicButton } from './sections/MusicButton'
import { ChatWidget } from './chat/ChatWidget'

const AdminPage = lazy(() => import('./admin/AdminPage'))

function Home() {
  const webgl = useMemo(hasWebGL, [])
  const tier = useMemo(perfTier, [])
  const reduced = useMemo(prefersReducedMotion, [])
  // ?mundo → entra directo al jardín (útil para pruebas y capturas)
  const [entered, setEntered] = useState(() => new URLSearchParams(window.location.search).has('mundo'))

  useEffect(() => {
    if (entered) window.scrollTo(0, 0)
  }, [entered])

  return (
    <>
      {entered ? (
        <>
          <Experience webgl={webgl} tier={tier} reduced={reduced} />
          {/* el destello rosado de la entrada se disuelve suavemente */}
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 2.4, ease: 'easeOut' }}
            className="pointer-events-none fixed inset-0 z-[80]"
            style={{ background: 'radial-gradient(circle at 50% 50%, #fff6f2 0%, #ffd0de 40%, #f7a8c4 100%)' }}
          />
        </>
      ) : (
        <IntroExperience onEnter={() => setEntered(true)} webgl={webgl} tier={tier} reduced={reduced} />
      )}
      <MusicButton />
      <ChatWidget />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<div className="p-8 text-pearl">Cargando…</div>}>
              <AdminPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
