// app/lib/access/accessLogger.ts
// ALFA-012.1 — Observabilidade segura VIP (sem sensível, sem DB)
// Server-only, estruturado, mascarado, correlacionável

import 'server-only'

export type LogLevel = 'info' | 'warn' | 'error'

export type VipEvent =
  | 'vip.invite.created'
  | 'vip.invite.revoked'
  | 'vip.invite.consume.started'
  | 'vip.invite.consume.succeeded'
  | 'vip.invite.consume.failed'
  | 'vip.signup.started'
  | 'vip.signup.auth_created'
  | 'vip.signup.invite_consumed'
  | 'vip.signup.grant_created'
  | 'vip.signup.grant_failed'
  | 'vip.signup.compensation.started'
  | 'vip.signup.compensation.succeeded'
  | 'vip.signup.compensation.failed'
  | 'vip.grant.created'
  | 'vip.grant.reprocessed'
  | 'vip.grant.renewed'
  | 'vip.grant.revoked'
  | 'vip.grant.expired'
  | 'vip.grant.sync.started'
  | 'vip.grant.sync.succeeded'
  | 'vip.grant.sync.failed'
  | 'vip.access.denied'
  // PIX-001 — eventos da integração Pix / Mercado Pago (aditivo, não altera os existentes)
  | 'pix.plan.updated'
  | 'pix.order.created'
  | 'pix.charge.created'
  | 'pix.charge.failed'
  | 'pix.webhook.received'
  | 'pix.webhook.rejected'
  | 'pix.webhook.processed'
  | 'pix.payment.confirmed'
  | 'pix.payment.failed'
  | 'pix.grant.created'
  | 'pix.grant.reused'
  // ALFA-015.0 — eventos do cadastro gratuito (aditivo, não altera os existentes)
  // Não são eventos VIP: o cadastro gratuito nunca concede access_grant.
  | 'free.signup.started'
  | 'free.signup.auth_created'
  | 'free.signup.completed'
  | 'free.signup.confirmation_required'
  | 'free.signup.confirmed'
  | 'free.signup.confirmation_failed'
  | 'free.signup.rejected'
  | 'free.signup.profile_failed'

// Helpers mascaramento — nunca registram completo
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '***'
  const at = email.indexOf('@')
  if (at <= 1) return '***'
  return email.slice(0, 2) + '***' + email.slice(at)
}

export function maskCode(code: string): string {
  if (!code || typeof code !== 'string') return '***'
  const trimmed = code.trim()
  if (trimmed.length <= 4) return '***'
  return trimmed.slice(0, 4) + '***' + trimmed.slice(-2)
}

export function maskUserId(userId: string): string {
  if (!userId) return '***'
  return userId.slice(0, 8) + '***'
}

export function maskGrantId(grantId: string): string {
  if (!grantId) return '***'
  return grantId.slice(0, 8) + '***'
}

export function maskInviteId(inviteId: string): string {
  if (!inviteId) return '***'
  return inviteId.slice(0, 8) + '***'
}

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined
  // Remover campos sensíveis se algum dia forem passados
  const blocked = ['password', 'token', 'service_role', 'raw_data', 'gpro_token', 'code', 'email']
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (blocked.includes(k.toLowerCase())) continue
    // Não registrar metadata integral se for grande
    if (typeof v === 'string' && v.length > 120) {
      out[k] = String(v).slice(0, 120) + '…'
    } else {
      out[k] = v
    }
  }
  return Object.keys(out).length ? out : undefined
}

export interface LogPayload {
  event: VipEvent
  level: LogLevel
  correlationId?: string
  userIdMasked?: string
  grantIdMasked?: string
  inviteIdMasked?: string
  code?: string // sempre mascarado se presente
  emailMasked?: string
  result?: string
  reason?: string
  durationMs?: number
  errorCode?: string
  env?: string
  meta?: Record<string, unknown>
}

let correlationCounter = 0
export function nextCorrelationId(): string {
  correlationCounter = (correlationCounter + 1) % 1000000
  return `vip-${Date.now().toString(36)}-${correlationCounter.toString(36)}`
}

function baseEnv(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'
}

export function logVipEvent(payload: LogPayload): void {
  const entry = {
    timestamp: new Date().toISOString(),
    env: payload.env ?? baseEnv(),
    level: payload.level,
    event: payload.event,
    correlationId: payload.correlationId,
    userId: payload.userIdMasked,
    grantId: payload.grantIdMasked,
    inviteId: payload.inviteIdMasked,
    email: payload.emailMasked,
    code: payload.code ? maskCode(payload.code) : undefined,
    result: payload.result,
    reason: payload.reason,
    durationMs: payload.durationMs,
    errorCode: payload.errorCode,
    meta: sanitizeMeta(payload.meta),
  }
  // Remover undefined para JSON limpo
  const clean = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined))
  const line = JSON.stringify(clean)
  if (payload.level === 'error') console.error(line)
  else if (payload.level === 'warn') console.warn(line)
  else console.log(line)
}

// Convenience wrappers
export const accessLogger = {
  info: (event: VipEvent, fields: Omit<LogPayload, 'event' | 'level'>) => logVipEvent({ event, level: 'info', ...fields }),
  warn: (event: VipEvent, fields: Omit<LogPayload, 'event' | 'level'>) => logVipEvent({ event, level: 'warn', ...fields }),
  error: (event: VipEvent, fields: Omit<LogPayload, 'event' | 'level'>) => logVipEvent({ event, level: 'error', ...fields }),
}
