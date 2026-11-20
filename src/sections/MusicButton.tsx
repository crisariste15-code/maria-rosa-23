import { useSyncExternalStore } from 'react'
import { music } from '../lib/music'

/** Botón visible para activar o silenciar la música. El audio nunca inicia solo. */
export function MusicButton() {
  const playing = useSyncExternalStore(music.subscribe, music.getSnapshot)
  return (
    <button
      onClick={() => music.toggle()}
      aria-pressed={playing}
      aria-label={playing ? 'Silenciar la música' : 'Activar la música'}
      title={playing ? 'Silenciar la música' : 'Activar la música'}
      className="fixed bottom-4 left-4 z-[60] flex h-12 items-center gap-2 rounded-full border border-champagne/40 bg-[rgba(20,9,34,.65)] px-4 text-champagne backdrop-blur-md transition hover:border-champagne hover:bg-[rgba(40,18,60,.75)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <span className="text-xl" aria-hidden>
        {playing ? '🔊' : '🔇'}
      </span>
      <span className="hidden text-base sm:inline">{playing ? 'Música' : 'Activar música'}</span>
    </button>
  )
}
