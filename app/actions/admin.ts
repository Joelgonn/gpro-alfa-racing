'use server'

import { createClient } from '@supabase/supabase-js'

// Cliente ADMIN (Service Role)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function generateNewInvite(userId: string) {
  // 1. Segurança: Verifica se quem pediu REALMENTE é admin no banco
  const { data: userState } = await supabaseAdmin
    .from('user_state')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (!userState || userState.role !== 'admin') {
    return { success: false, message: 'Acesso negado. Você não é admin.' }
  }

  // 2. Gera um código aleatório (Ex: VIP-A1B2-C3D4)
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                     Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `ALFA-${randomPart}`;

  // 3. Salva no banco
  const { error } = await supabaseAdmin
    .from('invite_codes')
    .insert({ code: code, is_used: false })

  if (error) return { success: false, message: 'Erro ao gerar código.' }

  return { success: true, code: code }
}