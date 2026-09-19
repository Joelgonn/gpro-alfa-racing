'use server'

// app/actions/freeSignup.ts
// ============================================
// ALFA-015.0 — CADASTRO GRATUITO (porta de entrada do produto)
// ============================================
// Regra fundamental: criar conta NÃO concede Premium.
// Este action NUNCA cria/consulta/altera:
//   - access_grants / access_events
//   - premium_orders / premium_payments / payment_events
//   - user_state.vip_status / vip_expires_at / access_plan / access_grant_id / role != 'user'
// O único caminho para Premium continua sendo o fluxo PIX já existente
// (webhook confirmado → access_grant). Nenhum atalho é criado aqui.
//
// Autenticação: usa EXCLUSIVAMENTE o Supabase Auth existente (supabase.auth.signUp),
// respeitando a configuração do projeto (signup habilitado? confirmação de e-mail?).
// Não existe segundo mecanismo de autenticação.
// ============================================

import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { accessLogger, maskEmail, maskUserId, nextCorrelationId } from '@/app/lib/access/accessLogger'
import {
  FREE_LANDING_PATH,
  mapSupabaseSignupError,
  isDuplicateEmailResponse,
  validateFreeSignup,
  type FreeSignupErrorCode,
  type FreeSignupField,
} from '@/app/lib/auth-flow'

export interface FreeSignupResult {
  ok: boolean
  /** null em caso de sucesso. */
  code: FreeSignupErrorCode | 'UNEXPECTED' | null
  message: string
  /** Campos que devem receber destaque no formulário. */
  fields: FreeSignupField[]
  /** true quando já existe sessão válida (Supabase com auto-confirmar ligado). */
  authenticated: boolean
  /** true quando o Supabase exige confirmação de e-mail antes do primeiro login. */
  requiresEmailConfirmation: boolean
  /** Destino após sucesso — sempre a porta de entrada comercial (/planos). */
  redirectTo: string
  /** E-mail normalizado (o próprio usuário digitou; nunca de terceiros). */
  email: string
  /** false apenas se a linha de perfil não pôde ser inicializada (uso interno/log). */
  profileReady: boolean
}

const SIGNUP_ERROR_MESSAGE = 'Não foi possível concluir o cadastro agora. Tente novamente em instantes.'

/**
 * Origem usada no link de confirmação de e-mail.
 * Preferimos o header `origin`; em Server Action ele é confiável para este fim
 * (apenas monta a URL de retorno) e o Supabase ainda valida a URL contra a
 * allowlist de Redirect URLs do projeto.
 */
function resolveOrigin(requestHeaders: Headers): string | null {
  const origin = requestHeaders.get('origin')
  if (origin && origin !== 'null' && /^https?:\/\/[^\s]+$/i.test(origin)) {
    return origin.replace(/\/+$/, '')
  }
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  if (!host || !/^[^\s/]+$/.test(host)) return null
  const proto = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
  return `${proto}://${host}`
}

/**
 * Inicializa a linha de perfil do usuário gratuito (user_state) de forma idempotente.
 *
 * - `ignoreDuplicates` (ON CONFLICT DO NOTHING): NUNCA sobrescreve uma linha existente.
 *   Assim é impossível apagar/alterar rolé, VIP ou access_plan de um usuário real.
 * - role explícito 'user': o cadastro público jamais cria admin.
 * - Campos VIP/access_* não são tocados → nascem NULL (usuário gratuito).
 */
async function ensureFreeProfile(userId: string): Promise<boolean> {
  const payload = { user_id: userId, role: 'user', track: 'Interlagos' }

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await supabaseAdmin
      .from('user_state')
      .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: true })

    if (!error) return true

    accessLogger.error('free.signup.profile_failed', {
      userIdMasked: maskUserId(userId),
      result: attempt === 1 ? 'retry' : 'failed',
      reason: String(error.message || 'unknown').slice(0, 80),
    })
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 150))
  }

  return false
}

/**
 * Cadastro gratuito de usuário.
 *
 * Lê SOMENTE os quatro campos do formulário. Qualquer campo extra enviado pelo
 * cliente (role, premium, access_grant, plan, status de pagamento, ...) é ignorado
 * por construção: nada além dos quatro campos abaixo é lido do FormData.
 */
export async function signUpFreeUser(formData: FormData): Promise<FreeSignupResult> {
  const correlationId = nextCorrelationId()
  const startedAt = Date.now()

  const rawName = formData.get('name')
  const rawEmail = formData.get('email')
  const rawPassword = formData.get('password')
  const rawConfirmPassword = formData.get('confirmPassword')

  const fail = (
    code: FreeSignupErrorCode | 'UNEXPECTED',
    message: string,
    fields: FreeSignupField[] = []
  ): FreeSignupResult => ({
    ok: false,
    code,
    message,
    fields,
    authenticated: false,
    requiresEmailConfirmation: false,
    redirectTo: FREE_LANDING_PATH,
    email: '',
    profileReady: false,
  })

  // 1. Validação server-side (autoridade). O cliente não define nada além dos campos.
  const validation = validateFreeSignup({
    name: rawName,
    email: rawEmail,
    password: rawPassword,
    confirmPassword: rawConfirmPassword,
  })

  if (!validation.ok) {
    accessLogger.warn('free.signup.rejected', {
      correlationId,
      code: validation.code,
      result: 'validation',
      durationMs: Date.now() - startedAt,
    })
    return fail(validation.code, validation.message, validation.fields)
  }

  const { name, email, password } = validation.values

  accessLogger.info('free.signup.started', {
    correlationId,
    emailMasked: maskEmail(email),
  })

  // 2. Destino do link de confirmação (quando o Supabase exigir confirmação).
  let emailRedirectTo: string | undefined
  try {
    const origin = resolveOrigin(await headers())
    if (origin) {
      emailRedirectTo = `${origin}/auth/confirmar?next=${encodeURIComponent(FREE_LANDING_PATH)}`
    }
  } catch (e) {
    accessLogger.warn('free.signup.rejected', {
      correlationId,
      result: 'no_origin',
      reason: String((e as Error)?.message || e).slice(0, 80),
    })
  }

  try {
    // 3. Criação do usuário no Supabase Auth EXISTENTE (mesmo provedor do /login).
    //    Nome vai para user_metadata.full_name (Auth), sem criar tabela paralela.
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    })

    if (error) {
      const mapped = mapSupabaseSignupError(error.message)
      accessLogger.warn('free.signup.rejected', {
        correlationId,
        emailMasked: maskEmail(email),
        code: mapped.code,
        result: 'auth_error',
        durationMs: Date.now() - startedAt,
      })
      return fail(mapped.code, mapped.message)
    }

    const user = data?.user ?? null

    if (!user?.id) {
      accessLogger.error('free.signup.rejected', {
        correlationId,
        emailMasked: maskEmail(email),
        result: 'no_user',
        durationMs: Date.now() - startedAt,
      })
      return fail('SIGNUP_UNAVAILABLE', SIGNUP_ERROR_MESSAGE)
    }

    // 4. Anti-enumeração do GoTrue: e-mail já existente volta como "sucesso" sem sessão,
    //    com identities vazio e sem criar usuário. Tratamos como e-mail já cadastrado.
    if (isDuplicateEmailResponse(user)) {
      accessLogger.warn('free.signup.rejected', {
        correlationId,
        emailMasked: maskEmail(email),
        code: 'EMAIL_ALREADY_EXISTS',
        result: 'duplicate_email',
        durationMs: Date.now() - startedAt,
      })
      return fail(
        'EMAIL_ALREADY_EXISTS',
        'Este e-mail já está cadastrado. Faça login para continuar.'
      )
    }

    accessLogger.info('free.signup.auth_created', {
      correlationId,
      userIdMasked: maskUserId(user.id),
      emailMasked: maskEmail(email),
      durationMs: Date.now() - startedAt,
    })

    // 5. Perfil inicial (user_state) — role 'user', sem qualquer benefício pago.
    const profileReady = await ensureFreeProfile(user.id)

    const authenticated = Boolean(data?.session)
    const requiresEmailConfirmation = !authenticated

    accessLogger.info(
      requiresEmailConfirmation ? 'free.signup.confirmation_required' : 'free.signup.completed',
      {
        correlationId,
        userIdMasked: maskUserId(user.id),
        emailMasked: maskEmail(email),
        result: profileReady ? (authenticated ? 'authenticated' : 'pending_confirmation') : 'profile_pending',
        durationMs: Date.now() - startedAt,
        meta: { profileReady },
      }
    )

    return {
      ok: true,
      code: null,
      message: authenticated
        ? 'Conta criada. Bem-vindo ao Alfa Racing!'
        : 'Conta criada! Confirme seu e-mail para entrar.',
      fields: [],
      authenticated,
      requiresEmailConfirmation,
      redirectTo: FREE_LANDING_PATH,
      email,
      profileReady,
    }
  } catch (e) {
    accessLogger.error('free.signup.rejected', {
      correlationId,
      emailMasked: maskEmail(email),
      result: 'exception',
      reason: String((e as Error)?.message || e).slice(0, 80),
      durationMs: Date.now() - startedAt,
    })
    return fail('SIGNUP_UNAVAILABLE', SIGNUP_ERROR_MESSAGE)
  }
}
