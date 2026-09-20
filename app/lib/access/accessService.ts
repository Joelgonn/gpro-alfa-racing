// app/lib/access/accessService.ts
// ============================================
// SERVIÇO CENTRAL DE ACESSO VIP/PREMIUM
// ALFA-011.2 — sem enforcement (VIP_CHECK=false)
// ============================================
// Somente server-side. Não usa localStorage, não confia em cliente.
// user_state é cache; access_grants é fonte quando disponível.
// ============================================

import 'server-only'

import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { isAdmin as checkIsAdmin } from '@/app/lib/auth'
import { accessLogger, maskUserId, maskGrantId, maskInviteId } from '@/app/lib/access/accessLogger'

// ============================================
// FEATURE FLAG
// ============================================
// VIP_CHECK=false => sistema NÃO bloqueia usuários sem VIP.
// Quando ativado futuramente (VIP_CHECK=true), requireVip() passará a lançar 403.
// Flag explícita, default false, sem depender de env ausente.

export const VIP_CHECK = false as const

// ============================================
// TIPOS
// ============================================

export type AccessStatus = 'active' | 'expired' | 'revoked' | 'pending' | 'none'

export type AccessPlan = 'premium' | 'full_premium' | string

export interface AccessGrantRow {
  id: string
  user_id: string
  source: 'invite' | 'manual' | 'payment' | 'admin' | string
  invite_code_id: string | null
  plan: AccessPlan
  status: 'active' | 'expired' | 'revoked' | 'pending' | string
  starts_at: string | null
  expires_at: string | null
  revoked_at: string | null
  revoked_by: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export interface AccessState {
  userId: string
  isAdmin: boolean
  hasAccess: boolean
  status: AccessStatus
  plan: AccessPlan | null
  isLifetime: boolean
  isExpired: boolean
  isRevoked: boolean
  isPending: boolean
  startsAt: string | null
  expiresAt: string | null
  grantId: string | null
  source: string | null
  // Separação cálculo vs enforcement
  enforcementEnabled: boolean
  allowed: boolean
  // Limitação: se true, não havia access_grants e usou cache user_state
  fromCache: boolean
}

// ============================================
// HELPERS PUROS (testáveis sem Supabase)
// ============================================

/**
 * Interpreta uma concessão isolada de forma determinística.
 * Não consulta DB, não confia em vip_status.
 */
export function interpretGrant(grant: AccessGrantRow | null, now: Date = new Date()): Omit<AccessState, 'userId' | 'isAdmin' | 'enforcementEnabled' | 'allowed' | 'fromCache'> {
  if (!grant) {
    return {
      hasAccess: false,
      status: 'none',
      plan: null,
      isLifetime: false,
      isExpired: false,
      isRevoked: false,
      isPending: false,
      startsAt: null,
      expiresAt: null,
      grantId: null,
      source: null,
    }
  }

  const status = grant.status as AccessStatus
  const expiresAt = grant.expires_at
  const isRevoked = status === 'revoked' || grant.revoked_at !== null
  const isPending = status === 'pending'

  // Revogado nunca libera, mesmo com expires_at futuro
  if (isRevoked) {
    return {
      hasAccess: false,
      status: 'revoked',
      plan: grant.plan ?? null,
      isLifetime: false,
      isExpired: false,
      isRevoked: true,
      isPending: false,
      startsAt: grant.starts_at,
      expiresAt: grant.expires_at,
      grantId: grant.id,
      source: grant.source ?? null,
    }
  }

  if (isPending) {
    return {
      hasAccess: false,
      status: 'pending',
      plan: grant.plan ?? null,
      isLifetime: false,
      isExpired: false,
      isRevoked: false,
      isPending: true,
      startsAt: grant.starts_at,
      expiresAt: grant.expires_at,
      grantId: grant.id,
      source: grant.source ?? null,
    }
  }

  // status active/expired — mas expiração é autoritativa (evita confiar só em status)
  if (grant.expires_at === null) {
    // Vitalício: só libera se status não for pending/revoked e plano existir
    const isActiveLike = status === 'active'
    return {
      hasAccess: isActiveLike,
      status: isActiveLike ? 'active' : 'none',
      plan: grant.plan ?? null,
      isLifetime: isActiveLike,
      isExpired: false,
      isRevoked: false,
      isPending: false,
      startsAt: grant.starts_at,
      expiresAt: null,
      grantId: grant.id,
      source: grant.source ?? null,
    }
  }

  // Com expires_at: validar data
  const exp = new Date(grant.expires_at)
  const isValidDate = !isNaN(exp.getTime())
  if (!isValidDate) {
    return {
      hasAccess: false,
      status: 'none',
      plan: grant.plan ?? null,
      isLifetime: false,
      isExpired: false,
      isRevoked: false,
      isPending: false,
      startsAt: grant.starts_at,
      expiresAt: grant.expires_at,
      grantId: grant.id,
      source: grant.source ?? null,
    }
  }

  const isExpired = exp.getTime() <= now.getTime()
  if (isExpired) {
    return {
      hasAccess: false,
      status: 'expired',
      plan: grant.plan ?? null,
      isLifetime: false,
      isExpired: true,
      isRevoked: false,
      isPending: false,
      startsAt: grant.starts_at,
      expiresAt: grant.expires_at,
      grantId: grant.id,
      source: grant.source ?? null,
    }
  }

  // Ativo com expiração futura
  return {
    hasAccess: status === 'active',
    status: status === 'active' ? 'active' : 'none',
    plan: grant.plan ?? null,
    isLifetime: false,
    isExpired: false,
    isRevoked: false,
    isPending: false,
    startsAt: grant.starts_at,
    expiresAt: grant.expires_at,
    grantId: grant.id,
    source: grant.source ?? null,
  }
}

/**
 * Escolhe a concessão mais relevante entre várias (determinístico).
 * Prioridade: active não-expirada mais futura > pending > expired > revoked > none.
 * Dentro de active, prefere expiresAt maior (null=vitalício é máximo).
 */
export function pickBestGrant(grants: AccessGrantRow[], now: Date = new Date()): AccessGrantRow | null {
  if (!grants || grants.length === 0) return null

  // Primeiro, tente active com acesso real (hasAccess true)
  let bestActive: AccessGrantRow | null = null
  let bestActiveExp: number = -1

  for (const g of grants) {
    const interpreted = interpretGrant(g, now)
    if (interpreted.hasAccess) {
      const expVal = interpreted.isLifetime ? Number.POSITIVE_INFINITY : new Date(g.expires_at!).getTime()
      if (expVal > bestActiveExp) {
        bestActiveExp = expVal
        bestActive = g
      }
    }
  }
  if (bestActive) return bestActive

  // Senão, prefere pending > expired > revoked > none (para relatório)
  const pending = grants.find((g) => g.status === 'pending')
  if (pending) return pending
  const expired = grants.find((g) => interpretGrant(g, now).status === 'expired')
  if (expired) return expired
  const revoked = grants.find((g) => interpretGrant(g, now).status === 'revoked')
  if (revoked) return revoked
  return grants[0]
}

// ============================================
// LEITURA SERVER-SIDE (com Supabase)
// ============================================

/**
 * Resolve userId com segurança: se fornecido, deve coincidir com auth.
 * Reutiliza requireAuth/isAdmin existentes (não recria auth).
 */
async function resolveUserIdSecure(requestedUserId?: string | null): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    const err: any = new Error('Não autenticado')
    err.status = 401
    throw err
  }
  if (requestedUserId && requestedUserId !== data.user.id) {
    const err: any = new Error('Acesso negado: ID de usuário não corresponde à sessão')
    err.status = 403
    throw err
  }
  return data.user.id
}

/**
 * Consulta estado VIP — server-side, sem escrita, sem dados sensíveis.
 * Fonte: access_grants (quando existir) + fallback cache user_state.
 */
export async function getAccessState(requestedUserId?: string | null): Promise<AccessState> {
  const userId = await resolveUserIdSecure(requestedUserId)
  const isAdminUser = await checkIsAdmin(userId)

  // Tenta buscar grants via service_role (bypass RLS)
  // Se tabela ainda vazia (ALFA-011.1), cai no fallback user_state
  let grants: AccessGrantRow[] = []
  let fromCache = false

  try {
    const { data, error } = await supabaseAdmin
      .from('access_grants')
      .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!error && data) {
      grants = data as unknown as AccessGrantRow[]
    }
  } catch {
    // Se tabela não existir ainda ou erro transitório, usa fallback
    grants = []
  }

  let interpreted: Omit<AccessState, 'userId' | 'isAdmin' | 'enforcementEnabled' | 'allowed' | 'fromCache'>

  if (grants.length > 0) {
    const best = pickBestGrant(grants)
    interpreted = interpretGrant(best)
  } else {
    // Fallback: cache user_state (sem confiar cegamente em vip_status, recalcula expiração)
    fromCache = true
    try {
      const { data: userState, error: userStateError } = await supabaseAdmin
        .from('user_state')
        .select('vip_status, vip_expires_at, access_plan, access_grant_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (!userStateError && userState) {
        const expiresAt = (userState as any).vip_expires_at as string | null
        const accessPlan = (userState as any).access_plan as string | null
        const grantId = (userState as any).access_grant_id as string | null
        // Não confia em vip_status; recalcula via expires_at
        if (!expiresAt && (userState as any).vip_status === 'lifetime' && accessPlan) {
          interpreted = {
            hasAccess: true,
            status: 'active',
            plan: accessPlan,
            isLifetime: true,
            isExpired: false,
            isRevoked: false,
            isPending: false,
            startsAt: null,
            expiresAt: null,
            grantId,
            source: null,
          }
        } else if (expiresAt) {
          const exp = new Date(expiresAt)
          const valid = !isNaN(exp.getTime())
          const expired = valid ? exp.getTime() <= Date.now() : true
          if (!valid) {
            interpreted = {
              hasAccess: false,
              status: 'none',
              plan: accessPlan,
              isLifetime: false,
              isExpired: false,
              isRevoked: false,
              isPending: false,
              startsAt: null,
              expiresAt,
              grantId,
              source: null,
            }
          } else if (expired) {
            interpreted = {
              hasAccess: false,
              status: 'expired',
              plan: accessPlan,
              isLifetime: false,
              isExpired: true,
              isRevoked: false,
              isPending: false,
              startsAt: null,
              expiresAt,
              grantId,
              source: null,
            }
          } else {
            interpreted = {
              hasAccess: !!accessPlan,
              status: accessPlan ? 'active' : 'none',
              plan: accessPlan,
              isLifetime: false,
              isExpired: false,
              isRevoked: false,
              isPending: false,
              startsAt: null,
              expiresAt,
              grantId,
              source: null,
            }
          }
        } else {
          interpreted = {
            hasAccess: false,
            status: 'none',
            plan: accessPlan,
            isLifetime: false,
            isExpired: false,
            isRevoked: false,
            isPending: false,
            startsAt: null,
            expiresAt: null,
            grantId,
            source: null,
          }
        }
      } else {
        interpreted = {
          hasAccess: false,
          status: 'none',
          plan: null,
          isLifetime: false,
          isExpired: false,
          isRevoked: false,
          isPending: false,
          startsAt: null,
          expiresAt: null,
          grantId: null,
          source: null,
        }
      }
    } catch {
      interpreted = {
        hasAccess: false,
        status: 'none',
        plan: null,
        isLifetime: false,
        isExpired: false,
        isRevoked: false,
        isPending: false,
        startsAt: null,
        expiresAt: null,
        grantId: null,
        source: null,
      }
    }
  }

  // Admin sempre tem acesso lógico (não é plano comercial)
  const hasAccessWithAdmin = isAdminUser ? true : interpreted.hasAccess
  const statusWithAdmin: AccessStatus = isAdminUser ? 'active' : interpreted.status

  // Separação cálculo vs enforcement
  const enforcementEnabled = VIP_CHECK
  const allowed = enforcementEnabled ? hasAccessWithAdmin : true

  return {
    userId,
    isAdmin: isAdminUser,
    hasAccess: hasAccessWithAdmin,
    status: statusWithAdmin,
    plan: interpreted.plan,
    isLifetime: isAdminUser ? false : interpreted.isLifetime,
    isExpired: isAdminUser ? false : interpreted.isExpired,
    isRevoked: interpreted.isRevoked,
    isPending: interpreted.isPending,
    startsAt: interpreted.startsAt,
    expiresAt: interpreted.expiresAt,
    grantId: interpreted.grantId,
    source: interpreted.source,
    enforcementEnabled,
    allowed,
    fromCache,
  }
}

// ============================================
// VERIFICAÇÃO BOOLEAN (hasVipAccess)
// ============================================

export async function hasVipAccess(requestedUserId?: string | null): Promise<boolean> {
  const state = await getAccessState(requestedUserId)
  return state.allowed
}

// ============================================
// GUARD FUTURO (requireVip) — NÃO APLICAR EM ROTAS NESTA SPRINT
// ============================================

export async function requireVip(requestedUserId?: string | null): Promise<AccessState> {
  const state = await getAccessState(requestedUserId)

  if (!state.enforcementEnabled) {
    return state // VIP_CHECK=false => permite fluxo atual
  }

  if (!state.allowed || !state.hasAccess) {
    const err: any = new Error(state.status === 'expired' ? 'VIP expirado' : state.status === 'revoked' ? 'VIP revogado' : 'VIP requerido')
    err.status = 403
    err.code = state.status === 'expired' ? 'VIP_EXPIRED' : state.status === 'revoked' ? 'VIP_REVOKED' : 'VIP_REQUIRED'
    err.accessState = state
    throw err
  }

  return state
}

// ============================================
// CONCESSÃO VIP — helpers puros + idempotente
// ALFA-011.8 — server-side, idempotente, sem VIP_CHECK
// ============================================

export type InviteForGrant = {
  id: string
  invite_type: string | null
  expires_at: string | null
  duration_days?: number | null
}

/**
 * Calcula expires_at do access_grant derivado do convite.
 * FASE 1: duration_days tem prioridade sobre invite_type legado.
 * - duration_days = null => lifetime (vitalício)
 * - duration_days = 7|30|... => now + duration_days
 * - fallback invite_type:
 *   - vip_lifetime => null
 *   - vip_custom => invite.expires_at (compatibilidade)
 *   - vip_30_days / null / undefined => now +30d
 * Não aceita validade do cliente — só invite do DB.
 */
export function calculateGrantExpiration(invite: InviteForGrant, now: Date = new Date()): string | null {
  const dur = (invite as { duration_days?: number | null }).duration_days
  // Prioridade: duration_days numérico válido (7,30,90,365)
  if (typeof dur === 'number' && Number.isInteger(dur) && dur >= 1 && dur <= 3650) {
    const d = new Date(now)
    d.setDate(d.getDate() + dur)
    return d.toISOString()
  }
  // duration null + vip_lifetime => vitalício (único caso onde null é lifetime)
  if (dur === null && invite.invite_type === 'vip_lifetime') return null
  // Fallback legado por invite_type
  const t = invite.invite_type
  if (t === 'vip_lifetime') return null
  if (t === 'vip_custom') return invite.expires_at ?? null
  if (t === 'vip_30_days' || t === null || t === undefined) {
    const d = new Date(now)
    d.setDate(d.getDate() + 30)
    return d.toISOString()
  }
  // fallback para qualquer outro tipo VIP futuro: 30d
  const d = new Date(now)
  d.setDate(d.getDate() + 30)
  return d.toISOString()
}

export function planForInvite(_invite: InviteForGrant): AccessPlan {
  return 'full_premium'
}

export function vipStatusForGrant(expiresAt: string | null): string {
  if (expiresAt === null) return 'lifetime'
  return 'active'
}

/**
 * FASE 2: calcula novo expires_at preservando período existente.
 * Regra: max(now, bestExpiresAt) + durationDays, com lifetime (null) preservado.
 * - bestGrant null/none/expired/revoked/pending => now + duration
 * - bestGrant active futuro => best.expires_at + duration
 * - durationDays null => lifetime (null)
 * - lifetime existente nunca é reduzido (null vence)
 */
export function calculateRenewalExpiresAt(
  bestGrant: AccessGrantRow | null,
  durationDays: number | null,
  now: Date = new Date()
): string | null {
  if (durationDays === null) return null
  // Lifetime existente deve permanecer lifetime, não converter para temporal
  if (bestGrant && bestGrant.expires_at === null && bestGrant.status === 'active') {
    // Se duration é temporal mas best é lifetime, preserva lifetime (não reduz)
    // Produto decidiu: lifetime nunca reduzido por compra
    return null
  }
  let base: Date
  if (!bestGrant || !bestGrant.expires_at) {
    // Sem grant, grant sem expires, ou expirado/revogado já tratado como !bestGrant ativo
    // Para expirado, interpretGrant já marca hasAccess false, mas pickBestGrant não retorna expirado como bestActive
    // Então bestGrant será null ou ativo futuro; se null, base = now
    base = new Date(now)
  } else {
    const exp = new Date(bestGrant.expires_at)
    if (isNaN(exp.getTime())) {
      base = new Date(now)
    } else {
      // bestGrant ativo futuro => exp > now => base = exp, senão now
      const isExpired = exp.getTime() <= now.getTime()
      // Se expirado mas ainda é best (quando não há ativo), pickBestGrant retornaria expired, não active
      // Nesse caso, não devemos preservar expirado, mas usar now
      const interpreted = interpretGrant(bestGrant, now)
      if (!interpreted.hasAccess) {
        base = new Date(now)
      } else {
        base = exp.getTime() > now.getTime() ? exp : new Date(now)
      }
    }
  }
  // Se durationDays não foi passado mas best existe, usar 30 como fallback?
  const days = durationDays ?? 30
  const result = new Date(base)
  result.setDate(result.getDate() + days)
  return result.toISOString()
}

/**
 * Cria concessão VIP idempotente para o usuário + invite.
 * - Verifica se já existe grant com invite_code_id + user_id (idempotência)
 * - Se existir, retorna existente sem duplicar
 * - Se não existir, insere novo grant (active) com starts_at=now e expires_at calculado
 * - Em corrida, se insert falhar por concorrência, re-seleciona existente
 * Usa supabaseAdmin (service_role) — nunca expõe service_role.
 */
export async function ensureVipGrantForInvite(
  userId: string,
  invite: InviteForGrant
): Promise<{ grant: AccessGrantRow; isNew: boolean }> {
  if (!userId || !invite?.id) throw new Error('userId e invite.id são obrigatórios')

  // Idempotência: já existe grant para este invite+usuário?
  const { data: existing, error: selErr } = await supabaseAdmin
    .from('access_grants')
    .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
    .eq('user_id', userId)
    .eq('invite_code_id', invite.id)
    .eq('source', 'invite')
    .maybeSingle()

  if (selErr) {
    // Erro transitório — loga sem sensível e segue para tentativa de insert
    console.error('ensureVipGrantForInvite select error', { userId: userId.slice(0, 8) + '***', inviteId: invite.id.slice(0, 8) + '***' })
  }

  if (existing) {
    accessLogger.info('vip.grant.reprocessed', {
      userIdMasked: maskUserId(userId),
      grantIdMasked: maskGrantId((existing as any).id),
      inviteIdMasked: maskInviteId(invite.id),
      result: 'already_exists',
    })
    return { grant: existing as unknown as AccessGrantRow, isNew: false }
  }

  const nowIso = new Date().toISOString()
  const expiresAt = calculateGrantExpiration(invite, new Date(nowIso))
  const plan = planForInvite(invite)

  const durationForMeta = (invite as { duration_days?: number | null }).duration_days ?? null
  const payload = {
    user_id: userId,
    source: 'invite' as const,
    invite_code_id: invite.id,
    plan,
    status: 'active' as const,
    starts_at: nowIso,
    expires_at: expiresAt,
    metadata: { duration_days: durationForMeta } as any,
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('access_grants')
    .insert(payload)
    .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
    .single()

  if (!insErr && inserted) {
    accessLogger.info('vip.grant.created', {
      userIdMasked: maskUserId(userId),
      grantIdMasked: maskGrantId((inserted as any).id),
      inviteIdMasked: maskInviteId(invite.id),
      result: 'created',
      meta: { plan, expires_at: expiresAt },
    })
    return { grant: inserted as unknown as AccessGrantRow, isNew: true }
  }

  // Corrida: outro processo inseriu entre select e insert — tenta re-selecionar
  if (insErr && (insErr as any).code === '23505') {
    const { data: raced } = await supabaseAdmin
      .from('access_grants')
      .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
      .eq('user_id', userId)
      .eq('invite_code_id', invite.id)
      .maybeSingle()
    if (raced) {
      accessLogger.info('vip.grant.reprocessed', {
        userIdMasked: maskUserId(userId),
        grantIdMasked: maskGrantId((raced as any).id),
        inviteIdMasked: maskInviteId(invite.id),
        result: 'race_recovered',
      })
      return { grant: raced as unknown as AccessGrantRow, isNew: false }
    }
  }

  accessLogger.error('vip.grant.created', {
    userIdMasked: maskUserId(userId),
    inviteIdMasked: maskInviteId(invite.id),
    result: 'failed',
    reason: (insErr as any)?.message?.slice(0, 80) || 'unknown',
  })
  // Erro não recuperável — lança sem expor detalhes ao cliente (caller logará mascarado)
  throw new Error(insErr?.message || 'Falha ao criar concessão VIP')
}

/**
 * Registra evento de acesso (append-only). Não falha fluxo principal se falhar.
 */
export async function recordAccessEvent(params: {
  userId: string
  accessGrantId: string | null
  eventType: 'granted' | 'renewed' | 'revoked' | 'expired' | 'manually_adjusted'
  source: string
  actorUserId?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    accessLogger.info(`vip.grant.${params.eventType}` as any, {
      userIdMasked: maskUserId(params.userId),
      grantIdMasked: params.accessGrantId ? maskGrantId(params.accessGrantId) : undefined,
      result: 'recorded',
      meta: { source: params.source },
    })
    await supabaseAdmin.from('access_events').insert({
      user_id: params.userId,
      access_grant_id: params.accessGrantId,
      event_type: params.eventType,
      source: params.source,
      actor_user_id: params.actorUserId ?? null,
      metadata: (params.metadata ?? {}) as any,
    })
  } catch (e) {
    console.error('recordAccessEvent failed', { userId: params.userId.slice(0, 8) + '***', eventType: params.eventType })
  }
}

/**
 * Sincroniza resumo em user_state (vip_status, vip_expires_at, access_plan, access_grant_id)
 * Usa supabaseAdmin (service_role) para bypass do trigger ALFA-011.4 (authenticated bloqueado).
 * Não apaga concessão vitalícia com estado inferior: se já é lifetime (null) não sobrescreve com data.
 */
export async function syncUserStateWithGrant(userId: string, grant: AccessGrantRow): Promise<void> {
  accessLogger.info('vip.grant.sync.started', {
    userIdMasked: maskUserId(userId),
    grantIdMasked: maskGrantId(grant.id),
  })
  const vip_status = vipStatusForGrant(grant.expires_at)
  const vip_expires_at = grant.expires_at
  const access_plan = grant.plan
  const access_grant_id = grant.id

  // Preserva lifetime: se já é lifetime, não sobrescreve com não-lifetime (defesa)
  try {
    const { data: current } = await supabaseAdmin
      .from('user_state')
      .select('vip_expires_at, vip_status')
      .eq('user_id', userId)
      .maybeSingle()
    const curExpires = (current as any)?.vip_expires_at as string | null | undefined
    const curStatus = (current as any)?.vip_status as string | null | undefined
    if (curStatus === 'lifetime' && curExpires === null && vip_expires_at !== null) {
      // Não sobrescrever vitalício com expiração
      console.warn('syncUserStateWithGrant skip: preserva lifetime', { userId: userId.slice(0, 8) + '***' })
      return
    }
  } catch {}

  const { error } = await supabaseAdmin
    .from('user_state')
    .update({
      vip_status,
      vip_expires_at,
      access_plan,
      access_grant_id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    // Fallback upsert se linha não existir (usuário recém-criado sem user_state ainda commitado)
    const { error: upErr } = await supabaseAdmin
      .from('user_state')
      .upsert(
        {
          user_id: userId,
          vip_status,
          vip_expires_at,
          access_plan,
          access_grant_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    if (upErr) {
      accessLogger.error('vip.grant.sync.failed', {
        userIdMasked: maskUserId(userId),
        grantIdMasked: maskGrantId(grant.id),
        reason: upErr.message.slice(0, 80),
      })
      throw upErr
    }
    if (error && upErr) console.error('syncUserStateWithGrant failed', { userId: userId.slice(0, 8) + '***', err: error.message.slice(0, 80) })
  }
  accessLogger.info('vip.grant.sync.succeeded', {
    userIdMasked: maskUserId(userId),
    grantIdMasked: maskGrantId(grant.id),
  })
}

// ============================================
// CICLO DE VIDA — renovação, revogação, expiração, reprocessamento
// ALFA-011.9 — server-only, idempotente, sem VIP_CHECK
// ============================================

export async function renewGrant(grantId: string, actorUserId?: string | null): Promise<AccessGrantRow> {
  if (!grantId) throw new Error('grantId obrigatório')
  accessLogger.info('vip.grant.renewed', {
    grantIdMasked: maskGrantId(grantId),
    userIdMasked: actorUserId ? maskUserId(actorUserId) : undefined,
    result: 'started',
  })
  // Primeiro tenta via RPC SQL (transacional, com FOR UPDATE e evento)
  const { data, error } = await supabaseAdmin.rpc('renew_access_grant', {
    p_grant_id: grantId,
    p_actor_user_id: actorUserId ?? null,
  })
  if (!error && data) {
    // RPC retorna grant; também sincroniza user_state dentro da função SQL
    // Mas garante sync também via JS para o caso de RPC não ter feito (fallback)
    const grant = data as unknown as AccessGrantRow
    // Se RPC retornou, já fez evento renewed; não duplicar
    return grant
  }
  // Fallback JS idempotente (se RPC não existir em ambiente local sem migration aplicada)
  const { data: grant, error: fetchErr } = await supabaseAdmin
    .from('access_grants')
    .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
    .eq('id', grantId)
    .single()
  if (fetchErr || !grant) throw new Error('Grant não encontrado')
  const g = grant as unknown as AccessGrantRow
  if (g.status === 'revoked') throw new Error('Grant revogado não pode ser renovado')
  if (g.expires_at === null) return g // vitalício: preserva, idempotente
  const now = new Date()
  const curExp = g.expires_at ? new Date(g.expires_at) : now
  const base = curExp.getTime() > now.getTime() ? curExp : now
  const newExp = new Date(base)
  newExp.setDate(newExp.getDate() + 30)
  const newExpIso = newExp.toISOString()
  // Idempotência: se já foi renovado para exatamente mesmo newExp recentemente, não duplicar evento
  // Verifica último evento renewed para este grant com mesmo new_expires_at
  const { data: lastEvent } = await supabaseAdmin
    .from('access_events')
    .select('metadata, created_at')
    .eq('access_grant_id', grantId)
    .eq('event_type', 'renewed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastEvent && (lastEvent as any).metadata?.new_expires_at === newExpIso) {
    return g
  }
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('access_grants')
    .update({ expires_at: newExpIso, status: 'active', updated_at: new Date().toISOString() })
    .eq('id', grantId)
    .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
    .single()
  if (updErr || !updated) throw new Error(updErr?.message || 'Falha ao renovar')
  await recordAccessEvent({
    userId: g.user_id,
    accessGrantId: grantId,
    eventType: 'renewed',
    source: g.source,
    actorUserId: actorUserId ?? null,
    metadata: { new_expires_at: newExpIso, previous_expires_at: g.expires_at },
  })
  const renewedGrant = updated as unknown as AccessGrantRow
  await syncUserStateWithGrant(g.user_id, renewedGrant)
  return renewedGrant
}

export async function revokeGrant(grantId: string, actorUserId?: string | null): Promise<AccessGrantRow> {
  if (!grantId) throw new Error('grantId obrigatório')
  accessLogger.info('vip.grant.revoked', {
    grantIdMasked: maskGrantId(grantId),
    userIdMasked: actorUserId ? maskUserId(actorUserId) : undefined,
    result: 'started',
  })
  const { data, error } = await supabaseAdmin.rpc('revoke_access_grant', {
    p_grant_id: grantId,
    p_actor_user_id: actorUserId ?? null,
  })
  if (!error && data) return data as unknown as AccessGrantRow
  // Fallback JS
  const { data: grant, error: fetchErr } = await supabaseAdmin
    .from('access_grants')
    .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
    .eq('id', grantId)
    .single()
  if (fetchErr || !grant) throw new Error('Grant não encontrado')
  const g = grant as unknown as AccessGrantRow
  if (g.status === 'revoked') return g // idempotente
  const nowIso = new Date().toISOString()
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('access_grants')
    .update({ status: 'revoked', revoked_at: nowIso, revoked_by: actorUserId ?? null, updated_at: nowIso })
    .eq('id', grantId)
    .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
    .single()
  if (updErr || !updated) throw new Error(updErr?.message || 'Falha ao revogar')
  await recordAccessEvent({
    userId: g.user_id,
    accessGrantId: grantId,
    eventType: 'revoked',
    source: g.source,
    actorUserId: actorUserId ?? null,
    metadata: { revoked_at: nowIso },
  })
  // syncUserState: limpa se este era o ativo, ou recalcula via outro grant
  // Para manter simples, seta vip_status=revoked se este era o grant em user_state
  try {
    const { data: cur } = await supabaseAdmin.from('user_state').select('access_grant_id').eq('user_id', g.user_id).maybeSingle()
    if ((cur as any)?.access_grant_id === grantId) {
      await supabaseAdmin.from('user_state').update({ vip_status: 'revoked', vip_expires_at: null, updated_at: nowIso }).eq('user_id', g.user_id)
    }
  } catch {}
  return updated as unknown as AccessGrantRow
}

export async function expireOverdueGrants(): Promise<number> {
  accessLogger.info('vip.grant.expired', { result: 'started' })
  const { data, error } = await supabaseAdmin.rpc('expire_overdue_grants')
  if (!error && typeof data === 'number') return data
  // Fallback JS: batch update active where expires_at <= now()
  const nowIso = new Date().toISOString()
  const { data: overdue, error: selErr } = await supabaseAdmin
    .from('access_grants')
    .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lte('expires_at', nowIso)
  if (selErr || !overdue || overdue.length === 0) return 0
  let count = 0
  for (const row of overdue as unknown as AccessGrantRow[]) {
    if (row.expires_at === null) continue // nunca expira vitalício
    const { error: updErr } = await supabaseAdmin.from('access_grants').update({ status: 'expired', updated_at: nowIso }).eq('id', row.id)
    if (updErr) continue
    await recordAccessEvent({ userId: row.user_id, accessGrantId: row.id, eventType: 'expired', source: row.source, metadata: { expired_at: row.expires_at } })
    try {
      const { data: cur } = await supabaseAdmin.from('user_state').select('access_grant_id').eq('user_id', row.user_id).maybeSingle()
      if ((cur as any)?.access_grant_id === row.id) {
        await supabaseAdmin.from('user_state').update({ vip_status: 'expired', vip_expires_at: row.expires_at, updated_at: nowIso }).eq('user_id', row.user_id)
      }
    } catch {}
    count++
  }
  return count
}

/**
 * Reprocessa concessão pendente/falha: se usuário usou invite (used_by) mas não tem grant, cria.
 * Idempotente, sem dados do cliente como fonte de validade.
 */
export async function reprocessMissingGrant(userId: string, inviteId: string): Promise<{ grant: AccessGrantRow; isNew: boolean } | null> {
  accessLogger.info('vip.grant.reprocessed', {
    userIdMasked: maskUserId(userId),
    inviteIdMasked: maskInviteId(inviteId),
    result: 'started',
  })
  if (!userId || !inviteId) throw new Error('userId e inviteId obrigatórios')
  // Verifica se já tem grant
  const { data: existing } = await supabaseAdmin
    .from('access_grants')
    .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
    .eq('user_id', userId)
    .eq('invite_code_id', inviteId)
    .maybeSingle()
  if (existing) return { grant: existing as unknown as AccessGrantRow, isNew: false }

  // Verifica invite válido e que pertence ao usuário (used_by)
  const { data: invite, error: invErr } = await supabaseAdmin
    .from('invite_codes')
    .select('id, invite_type, expires_at, revoked_at, is_used, used_by')
    .eq('id', inviteId)
    .maybeSingle()
  if (invErr || !invite) return null
  if ((invite as any).revoked_at) return null
  if (!(invite as any).is_used) return null
  if ((invite as any).used_by && (invite as any).used_by !== userId) return null
  // Para convite antigo sem used_by, permitir reprocessamento se user_id foi passado explicitamente por admin
  const result = await ensureVipGrantForInvite(userId, {
    id: (invite as any).id,
    invite_type: (invite as any).invite_type,
    expires_at: (invite as any).expires_at,
  })
  if (result.isNew) {
    await recordAccessEvent({
      userId,
      accessGrantId: result.grant.id,
      eventType: 'granted',
      source: 'invite',
      metadata: { invite_code_id: inviteId, reprocessed: true },
    })
    await syncUserStateWithGrant(userId, result.grant)
  }
  return result
}

// ============================================
// EXPORT PURO PARA TESTES (sem Supabase)
// ============================================

export const _pure = {
  interpretGrant,
  pickBestGrant,
  calculateGrantExpiration,
  calculateRenewalExpiresAt,
  planForInvite,
  vipStatusForGrant,
}
