import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Me {
  id: string
  role: 'visitor' | 'admin'
  display_name: string
  blocked: boolean
  privacy_accepted: boolean
  is_admin: boolean
  is_maria_rosa: boolean
}

export interface Msg {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
}

export interface Conv {
  id: string
  visitor_id: string
  admin_id: string
  status: 'pending' | 'active' | 'closed'
  muted: boolean
  created_at: string
  updated_at: string
}

/** Sesión de Supabase + perfil (whoami). Funciona igual en el chat y en el panel de Cris. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  const loadMe = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.rpc('whoami')
    setMe(error || !data ? null : (data as Me))
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let alive = true
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (data.session) await loadMe()
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      // No se hacen llamadas a Supabase dentro del callback (puede bloquearse): se difiere.
      if (s) setTimeout(() => void loadMe(), 0)
      else setMe(null)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadMe])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    setMe(null)
    setSession(null)
  }, [])

  return { session, me, loading, recovery, setRecovery, reloadMe: loadMe, signOut }
}
