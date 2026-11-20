// Configuración pública (variables VITE_*). Aquí NUNCA van secretos:
// todo lo que empieza con VITE_ termina visible en el navegador.

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

/** El chat solo se activa cuando hay un proyecto de Supabase configurado de verdad. */
export const CHAT_ENABLED = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('TU-PROYECTO'),
)

export const AUTH_GOOGLE = import.meta.env.VITE_AUTH_GOOGLE === 'true'
export const AUTH_EMAIL = import.meta.env.VITE_AUTH_EMAIL !== 'false'

/** Nombre del proyecto y datos fijos del regalo. */
export const GIFT = {
  title: 'María Rosa — 23 primaveras',
  fullName: 'MARÍA ROSA ÑAÑAC VALENCIA',
  from: 'Cris',
}

/** URL a la que Supabase debe volver tras un login (Google / recuperación de contraseña). */
export function appUrl(hash = ''): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}${hash}`
}
