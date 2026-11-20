import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CHAT_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

/**
 * Cliente de Supabase. Solo usa la clave "anon" (pública por diseño): todo el acceso a datos
 * está protegido por las políticas RLS definidas en supabase/schema.sql.
 * Si no hay variables de entorno, vale null y el chat se muestra como "aún no configurado".
 */
export const supabase: SupabaseClient | null = CHAT_ENABLED
  ? createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: {
        flowType: 'pkce', // los códigos llegan como ?code=… (compatible con HashRouter)
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'mr23-auth',
      },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null
