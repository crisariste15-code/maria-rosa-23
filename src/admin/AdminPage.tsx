import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CHAT_ENABLED, appUrl } from '../lib/config'
import { supabase } from '../lib/supabase'
import { useAuth, type Me, type Msg } from '../lib/useAuth'
import {
  askNotificationPermission,
  ding,
  notificationPermission,
  showNotification,
} from '../lib/notify'
import { Composer, MessageList, fmtTime, useTyping } from '../chat/shared'
import { formatPhone, identifierToEmail, normalizePhone } from '../lib/phone'

interface Row {
  conv_id: string
  visitor: string
  name: string
  phone: string | null
  status: 'pending' | 'active' | 'closed'
  muted: boolean
  blocked: boolean
  created: string
  updated: string
  last_content: string | null
  last_sender: string | null
  last_at: string | null
  unread: number
}

const input =
  'w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-pearl placeholder-white/40 outline-none focus:border-[#f1a8c0]'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-svh items-center justify-center bg-[#0b0614] px-4 py-10 font-ui text-pearl"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #2a0d2e 0%, #0b0614 60%)' }}
    >
      <div className="glass w-full max-w-md px-7 py-8">{children}</div>
    </div>
  )
}

function Title({ sub }: { sub?: string }) {
  return (
    <div className="mb-5 text-center">
      <p className="text-3xl" aria-hidden>
        🌹
      </p>
      <h1 className="font-display text-2xl font-semibold">Panel privado de Cris 🌹</h1>
      {sub && <p className="mt-1 text-sm opacity-70">{sub}</p>}
    </div>
  )
}

export default function AdminPage() {
  const auth = useAuth()

  useEffect(() => {
    document.title = 'Panel privado de Cris 🌹'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => {
      document.head.removeChild(robots)
      document.title = 'María Rosa — 23 primaveras 🌹'
    }
  }, [])

  if (!CHAT_ENABLED)
    return (
      <Shell>
        <Title sub="Falta conectar Supabase" />
        <p className="text-sm opacity-80">
          Esta compilación no tiene configurado el servidor de mensajes. Sigue <b>docs/CONFIGURAR_CHAT.md</b> y vuelve a publicar.
        </p>
      </Shell>
    )
  if (auth.loading)
    return (
      <Shell>
        <p className="text-center">Cargando…</p>
      </Shell>
    )
  if (auth.recovery) return <Shell><NewPassword onDone={() => auth.setRecovery(false)} /></Shell>
  if (!auth.session) return <Shell><Login /></Shell>
  if (!auth.me)
    return (
      <Shell>
        <Title />
        <p className="text-center text-sm">No se pudo cargar tu perfil.</p>
        <button className="btn-ghost mx-auto mt-4 !py-2 text-sm" onClick={() => void auth.reloadMe()}>Reintentar</button>
      </Shell>
    )
  if (auth.me.role !== 'admin')
    return (
      <Shell>
        <Title />
        <p className="text-center text-sm">Esta cuenta no tiene acceso al panel de Cris.</p>
        <div className="mt-5 flex justify-center gap-3">
          <button className="btn-ghost !py-2 text-sm" onClick={() => void auth.signOut()}>Cerrar sesión</button>
          <a className="btn-ghost !py-2 text-sm" href="#/">Volver al regalo</a>
        </div>
      </Shell>
    )
  return <AdminGate me={auth.me} accessToken={auth.session.access_token} reloadMe={auth.reloadMe} signOut={auth.signOut} />
}

// ───────────────────────── Acceso ─────────────────────────
function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const { error } = await supabase!.auth.signInWithPassword({ email: identifierToEmail(email), password })
    setBusy(false)
    if (error) setErr('Número o clave incorrectos.')
  }
  const forgot = async () => {
    if (!email.trim()) return setErr('Escribe tu correo y vuelve a pulsar “Olvidé mi contraseña”.')
    setErr(null)
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl('#/admin') })
    if (error) setErr(error.message)
    else setInfo('Si ese correo existe, te enviamos un enlace para crear una contraseña nueva.')
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Title sub="Acceso exclusivo" />
      <input className={input} type="text" inputMode="tel" autoComplete="username" placeholder="Tu número de teléfono" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className={input} type="password" autoComplete="current-password" placeholder="Tu clave" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="btn-rose !py-2.5 text-base" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      {email.includes('@') && (
        <button type="button" className="text-xs underline opacity-70" onClick={() => void forgot()}>Olvidé mi contraseña</button>
      )}
      {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200">{err}</p>}
      {info && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">{info}</p>}
      <a className="text-center text-xs opacity-60 hover:opacity-100" href="#/">← Volver al regalo</a>
    </form>
  )
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 10) return setErr('Usa al menos 10 caracteres.')
    setBusy(true)
    const { error } = await supabase!.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setErr(error.message)
    else onDone()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Title sub="Crea tu nueva contraseña" />
      <input className={input} type="password" autoComplete="new-password" placeholder="Nueva contraseña (mín. 10 caracteres)" value={pw} onChange={(e) => setPw(e.target.value)} />
      <button className="btn-rose !py-2.5 text-base" disabled={busy}>Guardar contraseña</button>
      {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200">{err}</p>}
    </form>
  )
}

/** Si Cris activó la verificación en dos pasos, pide el código antes de mostrar el panel. */
function AdminGate(props: { me: Me; accessToken: string; reloadMe: () => Promise<void>; signOut: () => Promise<void> }) {
  const [state, setState] = useState<'checking' | 'mfa' | 'ok'>('checking')
  useEffect(() => {
    let alive = true
    void supabase!.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!alive) return
      setState(data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2' ? 'mfa' : 'ok')
    })
    return () => {
      alive = false
    }
  }, [props.accessToken])

  if (state === 'checking') return <Shell><p className="text-center">Verificando…</p></Shell>
  if (state === 'mfa') return <Shell><MfaChallenge onVerified={() => { void props.reloadMe(); setState('ok') }} onCancel={() => void props.signOut()} /></Shell>
  return <Dashboard me={props.me} signOut={props.signOut} reloadMe={props.reloadMe} />
}

function MfaChallenge({ onVerified, onCancel }: { onVerified: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const { data: f } = await supabase!.auth.mfa.listFactors()
    const factor = f?.totp?.[0]
    if (!factor) {
      setBusy(false)
      return setErr('No se encontró un factor de verificación.')
    }
    const { error } = await supabase!.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() })
    setBusy(false)
    if (error) setErr('Código incorrecto. Inténtalo de nuevo.')
    else onVerified()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Title sub="Verificación en dos pasos" />
      <p className="text-center text-sm opacity-80">Escribe el código de 6 dígitos de tu aplicación de autenticación.</p>
      <input className={`${input} text-center text-2xl tracking-[0.5em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
      <button className="btn-rose !py-2.5 text-base" disabled={busy || code.length < 6}>Verificar</button>
      <button type="button" className="text-xs underline opacity-70" onClick={onCancel}>Cancelar y cerrar sesión</button>
      {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200">{err}</p>}
    </form>
  )
}

// ───────────────────────── Panel ─────────────────────────
type Tab = 'requests' | 'chats' | 'blocked'

function Dashboard({ me, signOut }: { me: Me; signOut: () => Promise<void>; reloadMe: () => Promise<void> }) {
  const sb = supabase!
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [tab, setTab] = useState<Tab>('chats')
  const [q, setQ] = useState('')
  const [settings, setSettings] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [sound, setSound] = useState(() => localStorage.getItem('mr23-admin-sound') !== '0')

  const rowsRef = useRef<Row[]>([])
  const selRef = useRef<string | null>(null)
  const soundRef = useRef(sound)
  rowsRef.current = rows
  selRef.current = selected
  soundRef.current = sound

  const flash = (t: string) => {
    setToast(t)
    window.setTimeout(() => setToast(null), 3200)
  }

  const loadInbox = useCallback(async () => {
    const { data, error } = await sb.rpc('admin_inbox')
    if (error) return flash(error.message)
    setRows(((data ?? []) as Row[]).map((r) => ({ ...r, unread: Number(r.unread) })))
  }, [sb])

  const refreshTimer = useRef<number | undefined>(undefined)
  const refreshSoon = useCallback(() => {
    window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => void loadInbox(), 350)
  }, [loadInbox])

  // Carga inicial + respaldo cada 30 s (por si se cae el tiempo real).
  useEffect(() => {
    void loadInbox()
    const id = window.setInterval(() => void loadInbox(), 30000)
    return () => window.clearInterval(id)
  }, [loadInbox])

  // Tiempo real: mensajes y cambios en conversaciones.
  useEffect(() => {
    const ch = sb
      .channel('admin-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        const m = p.new as Msg
        if (m.sender_id === me.id) {
          if (m.conversation_id === selRef.current) setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
          refreshSoon()
          return
        }
        const open = m.conversation_id === selRef.current
        if (open) {
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
          if (document.visibilityState === 'visible') void sb.rpc('mark_read', { p_conversation: m.conversation_id })
        }
        const row = rowsRef.current.find((r) => r.conv_id === m.conversation_id)
        if (!row?.muted && (!open || document.hidden)) {
          if (soundRef.current) ding()
          showNotification(`${row?.name ?? 'Nuevo mensaje'} 💌`, m.content)
        }
        refreshSoon()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        const m = p.new as Msg
        setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)))
        refreshSoon()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => refreshSoon())
      .subscribe()
    return () => {
      void sb.removeChannel(ch)
    }
  }, [sb, me.id, refreshSoon])

  // Abrir una conversación: cargar historial y marcar como leído.
  useEffect(() => {
    if (!selected) {
      setMsgs([])
      return
    }
    let alive = true
    void (async () => {
      const { data } = await sb.from('messages').select('*').eq('conversation_id', selected).order('created_at', { ascending: true }).limit(1000)
      if (!alive) return
      setMsgs((data ?? []) as Msg[])
      await sb.rpc('mark_read', { p_conversation: selected })
      refreshSoon()
    })()
    return () => {
      alive = false
    }
  }, [selected, sb, refreshSoon])

  const totalUnread = rows.reduce((s, r) => s + (r.muted ? 0 : r.unread), 0)
  useEffect(() => {
    document.title = `${totalUnread > 0 ? `(${totalUnread}) ` : ''}Panel privado de Cris 🌹`
  }, [totalUnread])

  const current = rows.find((r) => r.conv_id === selected) ?? null
  const typing = useTyping(selected, me.id)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows
      .filter((r) => (tab === 'blocked' ? r.blocked : tab === 'requests' ? !r.blocked && r.status === 'pending' : !r.blocked && r.status !== 'pending'))
      .filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.visitor.toLowerCase().includes(needle) || (r.last_content ?? '').toLowerCase().includes(needle))
  }, [rows, tab, q])

  const count = (t: Tab) => rows.filter((r) => (t === 'blocked' ? r.blocked : t === 'requests' ? !r.blocked && r.status === 'pending' : !r.blocked && r.status !== 'pending')).length
  const unreadIn = (t: Tab) => rows.filter((r) => (t === 'blocked' ? r.blocked : t === 'requests' ? !r.blocked && r.status === 'pending' : !r.blocked && r.status !== 'pending')).reduce((s, r) => s + r.unread, 0)

  const rpc = async (fn: string, args: Record<string, unknown>, ok: string) => {
    const { error } = await sb.rpc(fn, args)
    if (error) flash(error.message)
    else {
      flash(ok)
      void loadInbox()
    }
  }

  const send = async (text: string): Promise<string | null> => {
    if (!selected) return 'Selecciona una conversación.'
    const { data, error } = await sb.from('messages').insert({ conversation_id: selected, sender_id: me.id, content: text }).select().single()
    if (error) return error.message
    setMsgs((prev) => (prev.some((x) => x.id === (data as Msg).id) ? prev : [...prev, data as Msg]))
    refreshSoon()
    return null
  }

  return (
    <div className="flex h-svh flex-col bg-[#0b0614] font-ui text-pearl" style={{ background: 'radial-gradient(ellipse at 50% 0%, #241031 0%, #0b0614 55%)' }}>
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="text-2xl" aria-hidden>🌹</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold">Panel privado de Cris 🌹</h1>
          <p className="truncate text-xs opacity-60">
            {rows.length} conversaciones · {totalUnread} sin leer
          </p>
        </div>
        <a className="btn-ghost !px-3 !py-1.5 text-sm" href="#/" title="Ver el regalo">Regalo ↗</a>
        <button className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => setSettings(true)}>⚙ Ajustes</button>
        <button className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => void signOut()}>Salir</button>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[350px_1fr]">
        {/* Bandeja */}
        <aside className={`min-h-0 flex-col border-r border-white/10 ${selected ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3">
            <input className={input} placeholder="Buscar conversaciones…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar conversaciones" />
          </div>
          <div className="flex gap-1 px-3 pb-2 text-sm">
            {([['requests', 'Solicitudes'], ['chats', 'Conversaciones'], ['blocked', 'Bloqueados']] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative flex-1 rounded-full px-2 py-1.5 transition ${tab === t ? 'bg-[#e787ab] font-semibold text-[#2a0f24]' : 'bg-white/8 hover:bg-white/15'}`}
              >
                {label} <span className="opacity-70">({count(t)})</span>
                {unreadIn(t) > 0 && tab !== t && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#ff5c8a]" />}
              </button>
            ))}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 && <li className="px-5 py-10 text-center text-sm opacity-60">{rows.length === 0 ? 'Aún no hay mensajes. Cuando alguien te escriba, aparecerá aquí en tiempo real. 🌹' : 'Sin resultados en esta pestaña.'}</li>}
            {list.map((r) => (
              <li key={r.conv_id}>
                <button
                  onClick={() => setSelected(r.conv_id)}
                  className={`flex w-full flex-col gap-0.5 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/8 ${selected === r.conv_id ? 'bg-white/12' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{r.name}</span>
                    {r.muted && <span title="Silenciada">🔕</span>}
                    {r.blocked && <span title="Bloqueado">⛔</span>}
                    {r.status === 'closed' && <span className="rounded bg-white/10 px-1.5 text-[0.65rem]">cerrada</span>}
                    <span className="ml-auto text-[0.7rem] opacity-55">{r.last_at ? fmtTime(r.last_at) : fmtTime(r.created)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm opacity-70">{r.last_sender && r.last_sender !== r.visitor ? 'Tú: ' : ''}{r.last_content ?? 'Sin mensajes todavía'}</span>
                    {r.unread > 0 && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e787ab] px-1.5 text-xs font-bold text-[#2a0f24]">{r.unread}</span>}
                  </span>
                  <span className="text-[0.65rem] opacity-40">{r.phone ? formatPhone(r.phone) : `ID ${r.visitor.slice(0, 8)}`}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Conversación */}
        <section className={`min-h-0 flex-col ${selected ? 'flex' : 'hidden md:flex'}`}>
          {!current ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center opacity-60">
              <div>
                <p className="text-4xl" aria-hidden>💌</p>
                <p className="mt-2">Elige una conversación para leerla y responder.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
                <button className="rounded-full px-2 py-1 text-lg hover:bg-white/10 md:hidden" onClick={() => setSelected(null)} aria-label="Volver a la bandeja">←</button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{current.name}</p>
                  <p className="truncate text-[0.7rem] opacity-55">{current.phone ? formatPhone(current.phone) : `ID ${current.visitor}`} · {current.status === 'pending' ? 'solicitud' : current.status === 'closed' ? 'cerrada' : 'activa'}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {current.status === 'pending' && <button className="btn-ghost !px-3 !py-1" onClick={() => void rpc('admin_set_status', { p_conv: current.conv_id, p_status: 'active' }, 'Solicitud aceptada')}>✓ Aceptar</button>}
                  <button className="btn-ghost !px-3 !py-1" onClick={() => void rpc('admin_set_status', { p_conv: current.conv_id, p_status: current.status === 'closed' ? 'active' : 'closed' }, current.status === 'closed' ? 'Conversación reabierta' : 'Conversación cerrada')}>{current.status === 'closed' ? 'Reabrir' : 'Cerrar'}</button>
                  <button className="btn-ghost !px-3 !py-1" onClick={() => void rpc('admin_set_muted', { p_conv: current.conv_id, p_muted: !current.muted }, current.muted ? 'Notificaciones activadas' : 'Conversación silenciada')}>{current.muted ? '🔔 Reactivar' : '🔕 Silenciar'}</button>
                  <button className="btn-ghost !px-3 !py-1" onClick={() => void rpc('admin_set_blocked', { p_user: current.visitor, p_blocked: !current.blocked }, current.blocked ? 'Usuario desbloqueado' : 'Usuario bloqueado')}>{current.blocked ? 'Desbloquear' : '⛔ Bloquear'}</button>
                  <button className="btn-ghost !px-3 !py-1 !border-red-400/50 !text-red-200" onClick={() => setConfirmDel(true)}>🗑 Eliminar</button>
                </div>
              </div>
              <MessageList msgs={msgs} meId={me.id} otherName={current.name} typing={typing.other} />
              {current.blocked ? (
                <p className="border-t border-white/10 px-4 py-3 text-center text-sm opacity-70">Este usuario está bloqueado: no puede enviarte mensajes.</p>
              ) : (
                <Composer onSend={send} onTyping={typing.notify} placeholder={`Responder a ${current.name}…`} />
              )}
            </>
          )}
        </section>
      </div>

      {toast && <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[#2a1630] px-5 py-2.5 text-sm shadow-xl ring-1 ring-white/15" role="status">{toast}</div>}

      {confirmDel && current && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="glass max-w-sm px-6 py-6 text-center">
            <p className="text-lg font-semibold">¿Eliminar la conversación con {current.name}?</p>
            <p className="mt-2 text-sm opacity-75">Se borrarán todos sus mensajes. Esta acción no se puede deshacer.</p>
            <div className="mt-5 flex justify-center gap-3">
              <button className="btn-ghost !py-2 text-sm" onClick={() => setConfirmDel(false)}>Cancelar</button>
              <button
                className="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600"
                onClick={async () => {
                  const id = current.conv_id
                  setConfirmDel(false)
                  setSelected(null)
                  await rpc('admin_delete_conversation', { p_conv: id }, 'Conversación eliminada')
                }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {settings && <Settings sound={sound} onSound={(v) => { setSound(v); localStorage.setItem('mr23-admin-sound', v ? '1' : '0') }} onClose={() => setSettings(false)} />}
    </div>
  )
}

/** Arma el enlace que Cris le manda por WhatsApp: abre el regalo y deja la sesión iniciada sola. Todo ocurre en este navegador. */
function InviteLink() {
  const [tel, setTel] = useState('')
  const [clave, setClave] = useState('')
  const [copied, setCopied] = useState(false)
  const p = normalizePhone(tel)
  const link = p && clave ? `${appUrl()}?tel=${p}&clave=${encodeURIComponent(clave)}` : ''
  return (
    <div className="mt-2 space-y-2 text-sm">
      <p className="text-xs opacity-60">Escribe su número y la clave que le creaste en Supabase. Verás un enlace que ya la deja dentro del chat con un toque. Nada se envía ni se guarda: el enlace se arma aquí.</p>
      <input className={input} type="text" inputMode="tel" placeholder="Su número de teléfono" value={tel} onChange={(e) => setTel(e.target.value)} aria-label="Número de teléfono de María Rosa" />
      <input className={input} type="text" placeholder="Su clave de acceso" value={clave} onChange={(e) => setClave(e.target.value)} aria-label="Clave de acceso de María Rosa" autoComplete="off" />
      {link && (
        <div className="space-y-2">
          <p className="rounded-lg bg-white/10 p-2 text-xs break-all">{link}</p>
          <button
            className="btn-rose !px-5 !py-2 text-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(link).catch(() => undefined)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 2500)
            }}
          >
            {copied ? '¡Copiado! ✓' : 'Copiar enlace'}
          </button>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Ajustes: avisos y verificación en dos pasos ─────────────────────────
function Settings({ sound, onSound, onClose }: { sound: boolean; onSound: (v: boolean) => void; onClose: () => void }) {
  const [perm, setPerm] = useState(notificationPermission())
  const [mfa, setMfa] = useState<'loading' | 'off' | 'on'>('loading')
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const refreshMfa = useCallback(async () => {
    const { data } = await supabase!.auth.mfa.listFactors()
    setMfa(data?.totp && data.totp.length > 0 ? 'on' : 'off')
  }, [])
  useEffect(() => {
    void refreshMfa()
  }, [refreshMfa])

  const startEnroll = async () => {
    setErr(null)
    const { data, error } = await supabase!.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Panel de Cris ${new Date().toLocaleDateString('es-PE')}` })
    if (error || !data) return setErr(error?.message ?? 'No se pudo iniciar.')
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }
  const confirmEnroll = async () => {
    if (!enroll) return
    const { error } = await supabase!.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() })
    if (error) return setErr('Código incorrecto. Revisa la hora de tu teléfono e inténtalo de nuevo.')
    setEnroll(null)
    setCode('')
    setErr(null)
    void refreshMfa()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Ajustes">
      <div className="glass max-h-[90svh] w-full max-w-md overflow-y-auto px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Ajustes</h2>
          <button className="rounded-full px-2 py-1 text-lg hover:bg-white/10" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <h3 className="text-sm font-semibold">Notificaciones</h3>
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>Avisos del navegador {perm === 'granted' ? '✅ activos' : perm === 'denied' ? '⛔ bloqueados en el navegador' : perm === 'unsupported' ? '(no disponibles aquí)' : ''}</span>
            {perm === 'default' && <button className="btn-ghost !px-3 !py-1 text-xs" onClick={async () => setPerm(await askNotificationPermission())}>Activar</button>}
          </div>
          <label className="flex items-center justify-between gap-3">
            <span>Sonido al llegar un mensaje</span>
            <input type="checkbox" checked={sound} onChange={(e) => onSound(e.target.checked)} className="h-4 w-4 accent-[#e787ab]" />
          </label>
          <p className="text-xs opacity-60">Los avisos funcionan mientras esta pestaña esté abierta. Los avisos por correo o WhatsApp aún no están integrados (ver docs/NOTIFICACIONES.md).</p>
        </div>

        <h3 className="mt-6 text-sm font-semibold">Enlace de acceso directo</h3>
        <InviteLink />

        <h3 className="mt-6 text-sm font-semibold">Verificación en dos pasos (recomendada)</h3>
        <div className="mt-2 text-sm">
          {mfa === 'loading' && <p className="opacity-60">Comprobando…</p>}
          {mfa === 'on' && <p>✅ Activada. Se pedirá un código de tu aplicación (Google Authenticator, Authy…) cada vez que inicies sesión.</p>}
          {mfa === 'off' && !enroll && (
            <>
              <p className="opacity-75">Protege tu panel con un código temporal además de la contraseña.</p>
              <button className="btn-rose mt-3 !py-2 text-sm" onClick={() => void startEnroll()}>Activar verificación en dos pasos</button>
            </>
          )}
          {enroll && (
            <div className="mt-2 space-y-3">
              <p className="opacity-80">1) Escanea este código con tu aplicación de autenticación.</p>
              <img src={enroll.qr} alt="Código QR para la verificación en dos pasos" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
              <p className="text-xs break-all opacity-60">¿No puedes escanear? Clave manual: <span className="font-mono">{enroll.secret}</span></p>
              <p className="opacity-80">2) Escribe el código de 6 dígitos que aparece.</p>
              <div className="flex gap-2">
                <input className={`${input} text-center tracking-[0.4em]`} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Código de 6 dígitos" />
                <button className="btn-rose !px-5 !py-2 text-sm" disabled={code.length < 6} onClick={() => void confirmEnroll()}>Confirmar</button>
              </div>
            </div>
          )}
          {err && <p className="mt-2 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200">{err}</p>}
        </div>
      </div>
    </div>
  )
}
