import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Msg } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

export const EMOJIS = ['🌹', '💐', '🌸', '😊', '😂', '🥹', '❤️', '🙏', '✨', '🎂', '🎉', '🥳', '👏', '😍', '☺️', '💌']

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface ListProps {
  msgs: Msg[]
  meId: string
  intro?: ReactNode
  typing?: boolean
  /** Etiqueta para los mensajes de la otra persona (p. ej. "Cris" o el nombre del visitante). */
  otherName?: string
  tone?: 'night' | 'light'
}

/** Lista de mensajes con burbujas, hora y confirmación de lectura. El texto siempre se muestra como texto (sin HTML). */
export function MessageList({ msgs, meId, intro, typing, otherName, tone = 'night' }: ListProps) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs.length, typing])

  const mine = tone === 'night' ? 'bg-gradient-to-br from-[#f1a8c0] to-[#e787ab] text-[#2a0f24]' : 'bg-[#a31d44] text-white'
  const other = tone === 'night' ? 'bg-white/10 text-pearl border border-white/10' : 'bg-white text-[#2a1630] border border-black/5'

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 font-ui text-[0.95rem]" aria-live="polite">
      {intro}
      {msgs.map((m) => {
        const isMine = m.sender_id === meId
        return (
          <div key={m.id} className={`flex max-w-[86%] flex-col ${isMine ? 'items-end self-end' : 'items-start self-start'}`}>
            {!isMine && otherName && <span className="mb-0.5 px-1 text-[0.7rem] opacity-60">{otherName}</span>}
            <div className={`rounded-2xl px-3.5 py-2 break-words whitespace-pre-wrap ${isMine ? `${mine} rounded-br-sm` : `${other} rounded-bl-sm`}`}>
              {m.content}
            </div>
            <span className="mt-0.5 px-1 text-[0.68rem] opacity-55">
              {fmtTime(m.created_at)}
              {isMine && <span className="ml-1" title={m.read_at ? 'Leído' : 'Enviado'}>{m.read_at ? '✓✓ Leído' : '✓ Enviado'}</span>}
            </span>
          </div>
        )
      })}
      {typing && (
        <div className="self-start rounded-2xl rounded-bl-sm bg-white/10 px-3.5 py-2 text-sm opacity-80">
          <span className="animate-pulse">escribiendo…</span>
        </div>
      )}
      <div ref={end} />
    </div>
  )
}

interface ComposerProps {
  onSend: (text: string) => Promise<string | null> | string | null
  onTyping?: () => void
  disabled?: boolean
  placeholder?: string
  tone?: 'night' | 'light'
}

/** Caja de escritura con emojis. onSend devuelve un mensaje de error o null si todo salió bien. */
export function Composer({ onSend, onTyping, disabled, placeholder = 'Escribe un mensaje…', tone = 'night' }: ComposerProps) {
  const [text, setText] = useState('')
  const [emoji, setEmoji] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const send = useCallback(async () => {
    const t = text.trim()
    if (!t || busy || disabled) return
    setBusy(true)
    setError(null)
    const err = await onSend(t)
    setBusy(false)
    if (err) setError(err)
    else {
      setText('')
      setEmoji(false)
    }
  }, [text, busy, disabled, onSend])

  const field = tone === 'night' ? 'bg-white/10 text-pearl placeholder-white/40 border-white/15' : 'bg-white text-[#2a1630] placeholder-black/40 border-black/10'

  return (
    <div className="border-t border-white/10 px-3 py-2.5 font-ui">
      {error && <p className="mb-1.5 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs text-red-200">{error}</p>}
      {emoji && (
        <div className="mb-2 flex flex-wrap gap-1 rounded-xl bg-white/10 p-1.5">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => setText((t) => t + e)} className="rounded-lg px-1.5 py-1 text-xl hover:bg-white/15" aria-label={`Emoji ${e}`}>
              {e}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setEmoji((v) => !v)}
          disabled={disabled}
          className="h-10 w-10 shrink-0 rounded-full border border-white/15 text-xl hover:bg-white/10 disabled:opacity-40"
          aria-label="Emojis"
          aria-expanded={emoji}
        >
          😊
        </button>
        <textarea
          value={text}
          disabled={disabled}
          maxLength={2000}
          rows={1}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value)
            onTyping?.()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          className={`max-h-28 min-h-10 flex-1 resize-none rounded-2xl border px-3.5 py-2 text-[0.95rem] outline-none focus:border-[#f1a8c0] ${field}`}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={disabled || busy || !text.trim()}
          className="h-10 shrink-0 rounded-full bg-gradient-to-br from-[#f7d9a8] to-[#e787ab] px-4 font-semibold text-[#2a0f24] disabled:opacity-40"
        >
          {busy ? '…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

/** Indicador de “está escribiendo…” mediante un canal privado de Realtime (protegido por RLS). */
export function useTyping(convId: string | null, myId: string | undefined) {
  const [other, setOther] = useState(false)
  const channel = useRef<RealtimeChannel | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const last = useRef(0)

  useEffect(() => {
    if (!supabase || !convId || !myId) return
    const ch = supabase.channel(`typing:${convId}`, { config: { private: true, broadcast: { self: false } } })
    ch.on('broadcast', { event: 'typing' }, (p) => {
      if ((p.payload as { from?: string } | undefined)?.from === myId) return
      setOther(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setOther(false), 3200)
    }).subscribe()
    channel.current = ch
    return () => {
      window.clearTimeout(timer.current)
      void supabase?.removeChannel(ch)
      channel.current = null
      setOther(false)
    }
  }, [convId, myId])

  const notify = useCallback(() => {
    const now = Date.now()
    if (now - last.current < 1800) return
    last.current = now
    void channel.current?.send({ type: 'broadcast', event: 'typing', payload: { from: myId } })
  }, [myId])

  return { other, notify }
}
