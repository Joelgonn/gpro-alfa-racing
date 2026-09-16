// app/lib/auth.ts
// ============================================
// HELPERS DE AUTENTICAÇÃO SERVER-SIDE
// ============================================
// Usa @supabase/ssr para validar sessão via cookies
// NUNCA confia em header 'user-id' ou body userId como prova de identidade
// ============================================

import 'server-only'

import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

export interface AuthUser {
  id: string
  email?: string
}

/**
 * Obtém o usuário autenticado via cookies (Supabase SSR).
 * Retorna null se não autenticado.
 */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return { id: data.user.id, email: data.user.email ?? undefined }
}

/**
 * Exige autenticação. Lança erro 401 se não autenticado.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthenticatedUser()
  if (!user) {
    const err: any = new Error('Não autenticado')
    err.status = 401
    throw err
  }
  return user
}

/**
 * Verifica se o usuário tem papel admin (coluna user_state.role).
 * Retorna true/false.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('user_state')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (error) return false
  return data?.role === 'admin'
}

/**
 * Exige papel admin. Lança 403 se não for admin.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  const admin = await isAdmin(user.id)
  if (!admin) {
    const err: any = new Error('Acesso negado: requer papel admin')
    err.status = 403
    throw err
  }
  return user
}

/**
 * Valida que o userId fornecido (de body/query) coincide com o usuário autenticado.
 * Se fornecido, deve ser igual ao auth.id, caso contrário lança 403 (IDOR).
 * Se não fornecido, retorna o auth.id.
 */
export async function resolveUserId(requestedUserId?: string | null): Promise<string> {
  const user = await requireAuth()
  if (requestedUserId && requestedUserId !== user.id) {
    const err: any = new Error('Acesso negado: ID de usuário não corresponde à sessão')
    err.status = 403
    throw err
  }
  return user.id
}
