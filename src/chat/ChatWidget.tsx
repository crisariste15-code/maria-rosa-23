import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AUTH_EMAIL, AUTH_GOOGLE, CHAT_ENABLED, appUrl } from '../lib/config'
import { supabase } from '../lib/supabase'
import { useAuth, type Conv, type Me, type Msg } from '../lib/useAuth'
import { askNotificationPermission, notificationPermission, showNotification } from '../lib/notify'
import { Composer, MessageList, useTyping } from './shared'

const PRIVACY_TEXT =
  'Entiendo que mis mensajes serán recibidos y leídos por Cris. Se guardan en un servicio en la nube (Supabase) y solo Cris y yo podemos verlos. No están cifrados de extremo a extremo.'

const WELCOME =
  '¡Hola! Soy Cris, quien preparó este pequeño detalle para María Rosa. Si deseas dejarme un mensaje o simplemente conversar conmigo, será un gusto leerte. 🌹'

const MARIA_ROSA_WELCOME = [
  'Hola, María Rosa. 🌹',
  'Este pequeño universo fue creado especialmente para ti.',
  'Y si alguna vez quieres conversar, aquí encontrarás un espacio para hacerlo.',
  'Con cariño, Cris',
]

function friendly(message: string): string {
  if (/row-level security|violates/i.test(message))
    return 'No se pudo enviar. Es posible que tu acceso esté desactivado o que Cris haya cerrado la conversación.'
  return message
}

/** Conversación privada del visitante: carga, historial, tiempo real y envío. */
function useConversation(me: Me | null, enabled: boolean) {
  const [conv, setConv] = useState<Conv | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!supabase || !me || !enabled) {
      setConv(null)
      setMsgs([])
      setLoaded(false)
      return
    }
    const sb = supabase
    let cancelled = false
    let channel: ReturnType<typeof sb.channel> | null = null
    ;(async () => {
      const { data: c, error: e } = await sb.rpc('start_conversation')
      if (cancelled) return
      if (e || !c) {
        setError(e?.message ?? 'No se pudo abrir la conversación.')
        return
      }
      const conversation = c as Conv
      setConv(conversation)
      setError(null)
      const { data: m } = await sb
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(500)
      if (cancelled) return
      setMsgs((m ?? []) as Msg[])
      setLoaded(true)
      channel = sb
        .channel(`conv:${conversation.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
          (p) => setMsgs((prev) => (prev.some((x) => x.id === (p.new as Msg).id) ? prev : [...prev, p.new as Msg])),
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
          (p) => setMsgs((prev) => prev.map((x) => (x.id === (p.new as Msg).id ? { ...x, ...(p.new as Msg) } : x))),
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversation.id}` },
          (p) => setConv((prev) => (prev ? { ...prev, ...(p.new as Conv) } : prev)),
        )
        .subscribe()
    })()
    return () => {
      cancelled = true
      if (channel) void sb.removeChannel(channel)
    }
  }, [me?.id, enabled])

  const send = useCallback(
    async (text: string): Promise<string | null> => {
      if (!supabase || !conv || !me) return 'El chat no está disponible.'
      const { data, error: e } = await supabase
        .from('messages')
        .insert({ conversation_id: conv.id, sender_id: me.id, content: text })
        .select()
        .single()
      if (e) return friendly(e.message)
      setMsgs((prev) => (prev.some((x) => x.id === (data as Msg).id) ? prev : [...prev, data as Msg]))
      return null
    },
    [conv, me],
  )

  return { conv, msgs, error, loaded, send }
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const auth = useAuth()
  const me = auth.me
  const ready = Boolean(me && me.privacy_accepted && !me.blocked && me.role === 'visitor')
  const chat = useConversation(me, ready)
  const typing = useTyping(chat.conv?.id ?? null, me?.id)
  const [perm, setPerm] = useState(notificationPermission())

  const unread = chat.msgs.filter((m) => m.sender_id !== me?.id && !m.read_at).length

  // Marcar como leído al tener el chat abierto y visible.
  useEffect(() => {
    if (open && chat.conv && unread > 0 && document.visibilityState === 'visible') {
      void supabase?.rpc('mark_read', { p_conversation: chat.conv.id })
    }
  }, [open, chat.conv, unread])

  // Aviso del navegador cuando Cris responde y el chat está cerrado o la pestaña oculta.
  const seen = useRef<string | null>(null)
  useEffect(() => {
    if (!chat.loaded) return
    const last = chat.msgs[chat.msgs.length - 1]
    if (!last) return
    if (seen.current === null) {
      seen.current = last.id // historial inicial: no avisar
      return
    }
    if (last.id === seen.current) return
    seen.current = last.id
    if (last.sender_id !== me?.id && (!open || document.hidden)) showNotification('Cris te respondió 🌹', last.content)
  }, [chat.msgs, chat.loaded, open, me?.id])

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Abrir el chat privado con Cris"
        className="pulse-glow fixed right-3 bottom-4 z-[60] flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-[#f7d9a8] via-[#f1a8c0] to-[#e787ab] px-5 font-ui text-[0.95rem] font-semibold text-[#2a0f24] transition hover:scale-105 hover:shadow-[0_0_40px_rgba(247,217,168,.6)] sm:right-5"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <span className="text-xl" aria-hidden>
          💌
        </span>
        <span>Tu servidor, Cris</span>
        {unread > 0 && !open && (
          <span className="absolute -top-1.5 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#a31d44] px-1.5 text-xs text-white shadow">
            {unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Chat privado con Cris"
            className="glass fixed right-3 bottom-[4.6rem] z-[60] flex h-[min(76svh,610px)] w-[min(94vw,392px)] flex-col overflow-hidden text-pearl sm:right-5"
          >
            <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3 font-ui">
              <span className="text-2xl" aria-hidden>
                🌹
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[1.05rem] font-semibold">Tu servidor, Cris</p>
                <p className="truncate text-[0.72rem] opacity-60">Solo Cris lee estos mensajes</p>
              </div>
              {CHAT_ENABLED && auth.session && notificationPermission() !== 'unsupported' && perm !== 'granted' && (
                <button
                  className="rounded-full px-2 py-1 text-lg hover:bg-white/10"
                  title="Avisarme en este navegador cuando Cris responda"
                  aria-label="Activar avisos del navegador"
                  onClick={async () => setPerm(await askNotificationPermission())}
                >
                  🔔
                </button>
              )}
              {auth.session && (
                <button className="rounded-full px-2 py-1 text-xs opacity-70 hover:bg-white/10 hover:opacity-100" onClick={() => void auth.signOut()}>
                  Salir
                </button>
              )}
              <button className="rounded-full px-2 py-1 text-lg hover:bg-white/10" aria-label="Cerrar el chat" onClick={() => setOpen(false)}>
                ✕
              </button>
            </header>

            {!CHAT_ENABLED ? (
              <NotConfigured />
            ) : auth.loading ? (
              <Centered>Cargando…</Centered>
            ) : !auth.session ? (
              <AuthView />
            ) : !me ? (
              <Centered>
                <p>No pudimos cargar tu perfil.</p>
                <button className="btn-ghost mt-3 !py-2 font-ui text-sm" onClick={() => void auth.reloadMe()}>
                  Reintentar
                </button>
              </Centered>
            ) : me.role === 'admin' ? (
              <Centered>
                <p className="font-ui">Hola, Cris 🌹</p>
                <a className="btn-rose mt-4 !py-2 font-ui text-sm" href="#/admin">
                  Abrir mi panel privado
                </a>
              </Centered>
            ) : me.blocked ? (
              <Centered>
                <p className="font-ui text-sm">Tu acceso al chat fue desactivado.</p>
              </Centered>
            ) : !me.privacy_accepted ? (
              <ProfileSetup me={me} onDone={() => void auth.reloadMe()} />
            ) : chat.error ? (
              <Centered>
                <p className="font-ui text-sm text-red-200">{chat.error}</p>
              </Centered>
            ) : (
              <>
                <MessageList
                  msgs={chat.msgs}
                  meId={me.id}
                  otherName="Cris"
                  typing={typing.other}
                  intro={<Welcome me={me} />}
                />
                {chat.conv?.status === 'closed' ? (
                  <p className="border-t border-white/10 px-4 py-3 text-center font-ui text-xs opacity-70">
                    Cris cerró esta conversación por ahora. 🌹
                  </p>
                ) : (
                  <Composer onSend={chat.send} onTyping={typing.notify} placeholder="Escribe a Cris…" />
                )}
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center px-6 text-center font-ui text-[0.95rem]">{children}</div>
}

function NotConfigured() {
  return (
    <Centered>
      <p className="text-3xl" aria-hidden>
        💌
      </p>
      <p className="mt-2 font-semibold">El chat se está preparando</p>
      <p className="mt-2 text-sm opacity-75">
        Todavía no está conectado a su servidor de mensajes. Muy pronto podrás escribirle a Cris desde aquí.
      </p>
    </Centered>
  )
}

function Welcome({ me }: { me: Me }) {
  if (me.is_maria_rosa) {
    return (
      <div className="mb-1 self-start rounded-2xl rounded-bl-sm border border-champagne/30 bg-gradient-to-br from-[#3a1f4f]/80 to-[#4a2146]/80 px-4 py-3 text-[0.97rem]">
        {MARIA_ROSA_WELCOME.map((l, i) => (
          <p key={i} className={i === 0 ? 'font-script text-2xl text-blush' : i === MARIA_ROSA_WELCOME.length - 1 ? 'mt-1 italic' : 'mt-1'}>
            {l}
          </p>
        ))}
      </div>
    )
  }
  return (
    <div className="mb-1 max-w-[90%] self-start rounded-2xl rounded-bl-sm border border-white/10 bg-white/10 px-3.5 py-2.5">
      <span className="mb-0.5 block text-[0.7rem] opacity-60">Cris · mensaje de bienvenida</span>
      {WELCOME}
    </div>
  )
}

/** Paso 1: nombre, aviso de privacidad y acceso seguro (código por correo o Google). */
function AuthView() {
  const [alias, setAlias] = useState(() => localStorage.getItem('mr23-alias') ?? '')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [ok, setOk] = useState(() => localStorage.getItem('mr23-privacy') === '1')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const persist = () => {
    localStorage.setItem('mr23-alias', alias.trim())
    localStorage.setItem('mr23-privacy', ok ? '1' : '0')
  }
  const validate = (needEmail: boolean) => {
    if (!alias.trim()) return 'Escribe tu nombre o seudónimo.'
    if (needEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Escribe un correo válido.'
    if (!ok) return 'Para continuar, acepta el aviso de privacidad.'
    return null
  }

  const sendCode = async () => {
    const v = validate(true)
    if (v) return setErr(v)
    setErr(null)
    setBusy(true)
    persist()
    const { error } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, data: { full_name: alias.trim() } },
    })
    setBusy(false)
    if (error) return setErr(/rate|limit/i.test(error.message) ? 'Se enviaron demasiados códigos. Espera unos minutos e inténtalo de nuevo.' : error.message)
    setStep('code')
    setMsg(`Te enviamos un código a ${email.trim()}. Revisa también la carpeta de spam.`)
  }

  const verify = async () => {
    if (code.trim().length < 6) return setErr('Escribe el código que llegó a tu correo.')
    setErr(null)
    setBusy(true)
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setErr('El código no es válido o ya venció. Pide uno nuevo.')
  }

  const google = async () => {
    const v = validate(false)
    if (v) return setErr(v)
    persist()
    const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } })
    if (error) setErr(error.message)
  }

  const input = 'w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-pearl placeholder-white/40 outline-none focus:border-[#f1a8c0]'

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 font-ui text-[0.93rem]">
      <div className="rounded-2xl border border-white/10 bg-white/10 px-3.5 py-2.5">
        <span className="mb-0.5 block text-[0.7rem] opacity-60">Cris · mensaje de bienvenida</span>
        {WELCOME}
      </div>
      <p className="text-sm opacity-80">Para escribirme necesitas una identidad verificada. Es rápido:</p>

      <label className="block">
        <span className="mb-1 block text-xs opacity-70">Tu nombre o seudónimo</span>
        <input className={input} value={alias} maxLength={40} onChange={(e) => setAlias(e.target.value)} placeholder="Ej. Ana" autoComplete="nickname" />
      </label>

      {step === 'email' ? (
        <>
          {AUTH_EMAIL && (
            <label className="block">
              <span className="mb-1 block text-xs opacity-70">Tu correo (te enviaremos un código)</span>
              <input className={input} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
            </label>
          )}
          <label className="flex items-start gap-2 text-xs leading-snug opacity-85">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#e787ab]" />
            <span>{PRIVACY_TEXT}</span>
          </label>
          {AUTH_EMAIL && (
            <button className="btn-rose !py-2.5 text-base" disabled={busy} onClick={() => void sendCode()}>
              {busy ? 'Enviando…' : 'Enviarme un código'}
            </button>
          )}
          {AUTH_GOOGLE && (
            <button className="btn-ghost !py-2.5" onClick={() => void google()}>
              Entrar con Google
            </button>
          )}
          {!AUTH_EMAIL && !AUTH_GOOGLE && <p className="text-sm text-red-200">No hay ningún método de acceso habilitado.</p>}
        </>
      ) : (
        <>
          <p className="rounded-xl bg-white/10 px-3 py-2 text-xs">{msg}</p>
          <input
            className={`${input} text-center text-xl tracking-[0.4em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="Código"
            aria-label="Código de verificación"
          />
          <button className="btn-rose !py-2.5 text-base" disabled={busy} onClick={() => void verify()}>
            {busy ? 'Verificando…' : 'Entrar'}
          </button>
          <button className="text-xs underline opacity-70" onClick={() => { setStep('email'); setCode(''); setErr(null) }}>
            Usar otro correo o pedir un código nuevo
          </button>
        </>
      )}
      {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200">{err}</p>}
    </div>
  )
}

/** Paso 2 (solo la primera vez, o tras entrar con Google): confirmar nombre y privacidad. */
function ProfileSetup({ me, onDone }: { me: Me; onDone: () => void }) {
  const [name, setName] = useState(() => localStorage.getItem('mr23-alias') || me.display_name)
  const [ok, setOk] = useState(() => localStorage.getItem('mr23-privacy') === '1')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const auto = useRef(false)

  const save = useCallback(
    async (n: string) => {
      setBusy(true)
      setErr(null)
      const { error } = await supabase!.rpc('accept_privacy', { p_name: n })
      setBusy(false)
      if (error) setErr(error.message)
      else onDone()
    },
    [onDone],
  )

  // Si ya aceptó el aviso en este dispositivo antes de ingresar, se confirma sola.
  useEffect(() => {
    const a = localStorage.getItem('mr23-alias')
    if (!auto.current && a && localStorage.getItem('mr23-privacy') === '1') {
      auto.current = true
      void save(a)
    }
  }, [save])

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 font-ui text-[0.93rem]">
      <p className="text-sm opacity-85">¡Identidad verificada! Un último paso antes de escribirle a Cris.</p>
      <label className="block">
        <span className="mb-1 block text-xs opacity-70">Tu nombre o seudónimo</span>
        <input className="w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-pearl outline-none focus:border-[#f1a8c0]" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex items-start gap-2 text-xs leading-snug opacity-85">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#e787ab]" />
        <span>{PRIVACY_TEXT}</span>
      </label>
      <button className="btn-rose !py-2.5 text-base" disabled={busy || !ok || !name.trim()} onClick={() => void save(name)}>
        {busy ? 'Guardando…' : 'Continuar'}
      </button>
      {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200">{err}</p>}
    </div>
  )
}
