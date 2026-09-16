// app/lib/supabase-admin.ts
// ============================================
// CLIENT SUPABASE SERVICE ROLE — SERVER ONLY
// ============================================
// NUNCA importar em componentes client ("use client")
// Este arquivo usa "server-only" para garantir que o bundle não vaze a SERVICE_ROLE_KEY
// ============================================

import 'server-only'

import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Variáveis SUPABASE_URL e SERVICE_ROLE_KEY são obrigatórias no servidor.')
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
