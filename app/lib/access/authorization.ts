// app/lib/access/authorization.ts
// ============================================================
// PIX-015 — AUTORIZAÇÃO CENTRALIZADA (FREE / PREMIUM / ADMIN)
// ============================================================
// Problema corrigido: autenticação estava sendo tratada como autorização.
// Qualquer usuário autenticado (inclusive o usuário GRATUITO criado pelo
// ALFA-015) conseguia abrir /dashboard/manager por URL direta e chamar as APIs
// do Manager, porque não existia guard server-side fora de /dashboard/admin.
//
// Esta é a ÚNICA regra de decisão de acesso do produto. Ela NÃO recalcula
// privilégio: consome o serviço de acesso já existente (accessService), que é a
// fonte de verdade (access_grants + user_state.role, com expiração/revogação).
//
// Níveis:
//   anonymous → sem sessão válida
//   free      → autenticado, sem concessão Premium ativa
//   premium   → autenticado, com access_grant ativo (ou vitalício)
//   admin     → user_state.role = 'admin' (nunca bloqueado por esta guarda)
//
// Regras de uso:
//   - páginas Premium  → requireDashboardAccess() (redireciona)
//   - APIs Premium     → guardPremiumApi()      (401/403 em JSON)
// NUNCA usar "authenticated === true" como autorização Premium.
// ============================================================

import 'server-only'

import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { getAccessState } from '@/app/lib/access/accessService'
import { FREE_LANDING_PATH, safeInternalPath } from '@/app/lib/auth-flow'

export type AccessLevel = 'anonymous' | 'free' | 'premium' | 'admin'

export type AccessReason =
  | 'anonymous'
  | 'admin'
  | 'grant_active'
  | 'grant_expired'
  | 'grant_revoked'
  | 'grant_pending'
  | 'no_grant'

export interface AccessDecision {
  level: AccessLevel
  userId: string | null
  isAdmin: boolean
  isPremium: boolean
  reason: AccessReason
  /** status do grant considerado (active/expired/revoked/pending/none). */
  grantStatus: string
  plan: string | null
  expiresAt: string | null
}

/** Deriva o motivo a partir do estado devolvido pelo accessService (sem reinterpretar regras). */
function reasonFromState(isAdmin: boolean, hasAccess: boolean, grantStatus: string): AccessReason {
  if (isAdmin) return 'admin'
  if (hasAccess) return 'grant_active'
  if (grantStatus === 'expired') return 'grant_expired'
  if (grantStatus === 'revoked') return 'grant_revoked'
  if (grantStatus === 'pending') return 'grant_pending'
  return 'no_grant'
}

/**
 * Decide o nível de acesso do usuário da sessão (ou do userId informado).
 * `userId` é apenas um atalho server-side: quando informado, o accessService
 * valida que ele corresponde à sessão (nunca confia em valor de cliente).
 */
export async function resolveAccessDecision(userId?: string | null): Promise<AccessDecision> {
  try {
    const state = await getAccessState(userId ?? undefined)
    const reason = reasonFromState(state.isAdmin, state.hasAccess, state.status)
    const level: AccessLevel = state.isAdmin ? 'admin' : state.hasAccess ? 'premium' : 'free'

    return {
      level,
      userId: state.userId,
      isAdmin: state.isAdmin,
      isPremium: level === 'premium',
      reason,
      grantStatus: state.status,
      plan: state.plan,
      expiresAt: state.expiresAt,
    }
  } catch (e) {
    const status = (e as { status?: number })?.status
    // 401 = sem sessão válida → anônimo. Qualquer outro erro é infraestrutura e
    // NÃO deve ser mascarado como "sem acesso" (fail-closed para o recurso, mas
    // explícito para quem chamou).
    if (status === 401) {
      return {
        level: 'anonymous',
        userId: null,
        isAdmin: false,
        isPremium: false,
        reason: 'anonymous',
        grantStatus: 'none',
        plan: null,
        expiresAt: null,
      }
    }
    throw e
  }
}

/** Atalho booleano: o usuário tem acesso Premium (premium ou admin)? */
export async function hasPremiumAccess(userId?: string | null): Promise<boolean> {
  const decision = await resolveAccessDecision(userId)
  return decision.level === 'premium' || decision.level === 'admin'
}

/**
 * Guard de PÁGINA Premium (área /dashboard).
 * - anonymous → /login preservando o destino
 * - free      → /planos (porta de entrada comercial, define o funil)
 * - premium   → liberado
 * - admin     → liberado (administração nunca é bloqueada por esta guarda)
 */
export async function requireDashboardAccess(currentPath: string = '/dashboard'): Promise<AccessDecision> {
  const decision = await resolveAccessDecision()

  if (decision.level === 'premium' || decision.level === 'admin') return decision

  if (decision.level === 'anonymous') {
    const target = safeInternalPath(currentPath, '/dashboard') ?? '/dashboard'
    redirect(`/login?next=${encodeURIComponent(target)}`)
  }

  // FASE 3: distingue expirado/revogado/pending de nunca teve VIP
  if (
    decision.reason === 'grant_expired' ||
    decision.reason === 'grant_revoked' ||
    decision.reason === 'grant_pending'
  ) {
    redirect(`${FREE_LANDING_PATH}?motivo=expired`)
  }

  redirect(`${FREE_LANDING_PATH}?motivo=premium`)
}

/**
 * Guard de API Premium.
 * Retorna `null` quando liberado, ou uma NextResponse pronta (401/403) quando negado.
 * Uso: `const denied = await guardPremiumApi(); if (denied) return denied`
 */
export async function guardPremiumApi(): Promise<NextResponse | null> {
  const decision = await resolveAccessDecision()

  if (decision.level === 'premium' || decision.level === 'admin') return null

  if (decision.level === 'anonymous') {
    return NextResponse.json(
      { success: false, error: 'Não autenticado', code: 'NOT_AUTHENTICATED' },
      { status: 401 }
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Este recurso é exclusivo do acesso Premium. Escolha um plano para liberar.',
      code: 'PREMIUM_REQUIRED',
      access: { level: decision.level, reason: decision.reason, grantStatus: decision.grantStatus },
    },
    { status: 403 }
  )
}
