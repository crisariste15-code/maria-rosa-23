// Avisos del navegador y sonido discreto para mensajes nuevos.
// Solo funcionan mientras la pestaña esté abierta. Para avisos con la pestaña cerrada
// (correo o WhatsApp) ver docs/NOTIFICACIONES.md — aún NO están integrados.

export const notificationsSupported = () => typeof Notification !== 'undefined'
export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported'

export async function askNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

export function showNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body: body.slice(0, 140), tag: 'mr23-chat', icon: `${import.meta.env.BASE_URL}favicon.svg` })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* algunos navegadores móviles exigen service worker: se ignora */
  }
}

let ctx: AudioContext | null = null
/** Campanita suave (un “ding” corto) para mensajes nuevos. */
export function ding() {
  try {
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx ??= new AC()
    void ctx.resume()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(880, t)
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.08)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    o.connect(g)
    g.connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.65)
  } catch {
    /* sin audio disponible */
  }
}
