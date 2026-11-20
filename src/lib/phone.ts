// El chat es solo entre dos personas, identificadas por su número de teléfono.
// Por debajo, cada número es una cuenta de Supabase con un "correo interno" que nunca
// recibe mensajes (no se envía ningún correo): <número>@tel.mr23.chat

const DOMAIN = 'tel.mr23.chat'

/** Deja solo dígitos con código de país. Un celular peruano de 9 dígitos recibe el 51. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 9 && d.startsWith('9')) d = `51${d}`
  return d.length >= 10 && d.length <= 15 ? d : null
}

export const phoneToEmail = (digits: string) => `${digits}@${DOMAIN}`

export function emailToPhone(email?: string | null): string | null {
  return email && email.toLowerCase().endsWith(`@${DOMAIN}`) ? email.split('@')[0] : null
}

export function formatPhone(digits?: string | null): string {
  if (!digits) return ''
  if (digits.startsWith('51') && digits.length === 11) return `+51 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  return `+${digits}`
}

/** Acepta un teléfono o un correo y devuelve el correo con el que se inicia sesión. */
export function identifierToEmail(input: string): string {
  const t = input.trim()
  if (t.includes('@')) return t
  const p = normalizePhone(t)
  return p ? phoneToEmail(p) : t
}
