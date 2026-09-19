// app/lib/auth-flow.ts
// ============================================
// ALFA-015.0 — FLUXO DE ENTRADA GRATUITA (cadastro público)
// ============================================
// Módulo PURO: sem imports, sem "server-only", sem acesso a rede/DB.
// É reutilizado por:
//   - app/cadastro/page.tsx      (feedback imediato no formulário)
//   - app/actions/freeSignup.ts  (AUTORIDADE: revalida tudo no servidor)
//   - app/login/page.tsx         (destino pós-login e ?next= seguro)
//   - app/auth/confirmar/route.ts (destino após confirmação de e-mail)
//
// Regra fundamental: nada aqui concede ou infere privilégio. Este módulo só
// valida entrada, traduz erros do Supabase Auth e resolve navegação interna.
// Free/Premium/Admin continua sendo decidido por access_grants + user_state.role.
// ============================================

// ============================================
// CONSTANTES
// ============================================

/** Destino comercial do usuário gratuito (porta de entrada do produto). */
export const FREE_LANDING_PATH = '/planos'
/** Destino preservado do fluxo atual (VIP/admin) — não muda o comportamento existente. */
export const PREMIUM_LANDING_PATH = '/dashboard/manager'

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72
export const NAME_MIN_LENGTH = 2
export const NAME_MAX_LENGTH = 80
const EMAIL_MAX_LENGTH = 254
const SAFE_PATH_MAX_LENGTH = 512

// ============================================
// TIPOS
// ============================================

export type FreeSignupField = 'name' | 'email' | 'password' | 'confirmPassword'

export type FreeSignupErrorCode =
  | 'MISSING_FIELDS'
  | 'INVALID_NAME'
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'PASSWORD_MISMATCH'
  | 'EMAIL_ALREADY_EXISTS'
  | 'SIGNUP_DISABLED'
  | 'RATE_LIMITED'
  | 'SIGNUP_UNAVAILABLE'

export interface FreeSignupValues {
  name: string
  email: string
  password: string
}

export type FreeSignupValidationResult =
  | { ok: true; values: FreeSignupValues }
  | { ok: false; code: FreeSignupErrorCode; message: string; fields: FreeSignupField[] }

export interface PostLoginAccess {
  role?: string | null
  accessPlan?: string | null
}

// ============================================
// HELPERS INTERNOS
// ============================================

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/** E-mail: trim + minúsculas (normalização feita no servidor, nunca no cliente). */
export function normalizeEmail(value: unknown): string {
  return asText(value).trim().toLowerCase()
}

/** Nome: trim + colapso de espaços internos; nunca vazio. */
export function normalizeName(value: unknown): string {
  return asText(value).replace(/\s+/g, ' ').trim()
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/

// ============================================
// VALIDAÇÃO POR CAMPO (usada no formulário e revalidada no servidor)
// ============================================

export function nameFieldError(value: unknown): string | null {
  const name = normalizeName(value)
  if (!name) return 'Informe seu nome.'
  if (name.length < NAME_MIN_LENGTH) return `O nome deve ter pelo menos ${NAME_MIN_LENGTH} caracteres.`
  if (name.length > NAME_MAX_LENGTH) return `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`
  if (/[\u0000-\u001f\u007f]/.test(name)) return 'O nome contém caracteres inválidos.'
  return null
}

export function emailFieldError(value: unknown): string | null {
  const email = normalizeEmail(value)
  if (!email) return 'Informe seu e-mail.'
  if (email.length > EMAIL_MAX_LENGTH) return 'E-mail muito longo.'
  if (!EMAIL_PATTERN.test(email)) return 'Informe um e-mail válido.'
  return null
}

export function passwordFieldError(value: unknown): string | null {
  const password = asText(value)
  if (!password) return 'Informe uma senha.'
  if (password.length < PASSWORD_MIN_LENGTH) return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
  if (password.length > PASSWORD_MAX_LENGTH) return `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`
  if (!/[A-Za-z]/.test(password)) return 'A senha deve conter pelo menos uma letra.'
  if (!/[0-9]/.test(password)) return 'A senha deve conter pelo menos um número.'
  return null
}

export function confirmPasswordFieldError(password: unknown, confirm: unknown): string | null {
  const confirmText = asText(confirm)
  if (!confirmText) return 'Confirme a senha.'
  if (asText(password) !== confirmText) return 'As senhas não conferem.'
  return null
}

// ============================================
// VALIDAÇÃO COMPLETA (autoridade do servidor)
// ============================================

/**
 * Valida o cadastro gratuito de forma determinística.
 * Ordem: campos obrigatórios → nome → e-mail → senha → confirmação.
 * Retorna os valores normalizados para uso server-side.
 */
export function validateFreeSignup(input: Partial<Record<FreeSignupField, unknown>>): FreeSignupValidationResult {
  const rawName = input?.name
  const rawEmail = input?.email
  const rawPassword = input?.password
  const rawConfirm = input?.confirmPassword

  const missing: FreeSignupField[] = []
  if (!normalizeName(rawName)) missing.push('name')
  if (!normalizeEmail(rawEmail)) missing.push('email')
  if (!asText(rawPassword)) missing.push('password')
  if (!asText(rawConfirm)) missing.push('confirmPassword')

  if (missing.length > 0) {
    return {
      ok: false,
      code: 'MISSING_FIELDS',
      message: 'Preencha todos os campos obrigatórios.',
      fields: missing,
    }
  }

  const nameError = nameFieldError(rawName)
  if (nameError) return { ok: false, code: 'INVALID_NAME', message: nameError, fields: ['name'] }

  const emailError = emailFieldError(rawEmail)
  if (emailError) return { ok: false, code: 'INVALID_EMAIL', message: emailError, fields: ['email'] }

  const passwordError = passwordFieldError(rawPassword)
  if (passwordError) return { ok: false, code: 'WEAK_PASSWORD', message: passwordError, fields: ['password'] }

  const confirmError = confirmPasswordFieldError(rawPassword, rawConfirm)
  if (confirmError) return { ok: false, code: 'PASSWORD_MISMATCH', message: confirmError, fields: ['confirmPassword'] }

  return {
    ok: true,
    values: {
      name: normalizeName(rawName),
      email: normalizeEmail(rawEmail),
      password: asText(rawPassword),
    },
  }
}

// ============================================
// TRADUÇÃO DE ERROS DO SUPABASE AUTH
// ============================================

/**
 * Traduz a mensagem do Supabase Auth para código + mensagem segura ao usuário.
 * Nunca repassa texto bruto do provedor (evita vazar detalhes internos).
 */
export function mapSupabaseSignupError(rawMessage: unknown): { code: FreeSignupErrorCode; message: string } {
  const raw = asText(rawMessage)

  if (/already\s+(been\s+)?registered|already\s+exists|user\s+already/i.test(raw)) {
    return { code: 'EMAIL_ALREADY_EXISTS', message: 'Este e-mail já está cadastrado. Faça login para continuar.' }
  }
  if (/signups?\s+not\s+allowed|signup\s+is\s+disabled|signups?\s+disabled|not\s+allowed\s+for\s+this\s+instance/i.test(raw)) {
    return {
      code: 'SIGNUP_DISABLED',
      message: 'O cadastro público está desativado no momento. Fale com a equipe Alfa Racing para liberar seu acesso.',
    }
  }
  if (/rate\s*limit|too\s+many\s+requests|for\s+security\s+purposes|over_email_send_rate_limit/i.test(raw)) {
    return { code: 'RATE_LIMITED', message: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.' }
  }
  if (/password\s+should\s+be\s+at\s+least|weak\s+password|password\s+is\s+too\s+short/i.test(raw)) {
    return {
      code: 'WEAK_PASSWORD',
      message: `Senha muito fraca. Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`,
    }
  }
  if (/invalid\s+email|unable\s+to\s+validate\s+email|email\s+address.*(invalid|not\s+valid)/i.test(raw)) {
    return { code: 'INVALID_EMAIL', message: 'Informe um e-mail válido.' }
  }

  return { code: 'SIGNUP_UNAVAILABLE', message: 'Não foi possível concluir o cadastro agora. Tente novamente em instantes.' }
}

/**
 * Detecta e-mail já cadastrado quando o Supabase responde "sucesso" sem sessão
 * (comportamento anti-enumeração do GoTrue com confirmação de e-mail ligada:
 * o usuário retornado vem com `identities` vazio e nenhum novo registro é criado).
 */
export function isDuplicateEmailResponse(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  const identities = (user as { identities?: unknown }).identities
  return Array.isArray(identities) && identities.length === 0
}

// ============================================
// NAVEGAÇÃO INTERNA SEGURA
// ============================================

/**
 * Aceita apenas caminho interno relativo.
 * Bloqueia open redirect: "//evil.com", "https://x", "\", controles e CRLF.
 */
export function safeInternalPath(raw: unknown, fallback: string | null = null): string | null {
  const value = asText(raw).trim()
  if (!value) return fallback
  if (value.length > SAFE_PATH_MAX_LENGTH) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback
  if (value.includes('\\')) return fallback
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  // "/planos?x=1" é válido; esquema/protocolo não é
  if (/^\/[^/]*:/.test(value)) return fallback
  return value
}

/**
 * Destino após login bem-sucedido.
 *
 * Ordem de precedência:
 * 1. `?next=` interno explicitamente pedido pelo usuário (ex.: voltar para /planos).
 * 2. Acesso desconhecido (sem linha em user_state / consulta falhou) → comportamento
 *    atual preservado.
 * 3. Admin → comportamento atual preservado.
 * 4. Qualquer usuário COM plano registrado (ativo, vitalício ou vencido) → comportamento
 *    atual preservado. Decisão deliberada: não alterar a jornada de quem já comprou.
 * 5. Usuário gratuito autenticado (sem plano) → /planos (porta de entrada comercial).
 */
export function resolvePostLoginDestination(
  input: { next?: unknown; access: PostLoginAccess | null },
  fallback: string = PREMIUM_LANDING_PATH
): string {
  const wanted = safeInternalPath(input?.next, null)
  if (wanted) return wanted

  const access = input?.access
  if (!access) return fallback
  if (access.role === 'admin') return fallback

  const plan = (access.accessPlan ?? '').trim()
  if (plan) return fallback

  return FREE_LANDING_PATH
}
