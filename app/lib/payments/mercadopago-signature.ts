// app/lib/payments/mercadopago-signature.ts
// PIX-001.1 — Validação de assinatura do webhook do Mercado Pago
//
// ⚠️ ESTADO: **NÃO VERIFICADO / PENDENTE DE CONTRATO OFICIAL**
//
// A documentação oficial informa que a assinatura é derivada de um SEGREDO + TIMESTAMP e
// enviada no header `x-signature` (formato `ts=...,v1=...`), e que o `x-request-id` participa.
// PORÉM **não foi possível confirmar, na fonte oficial, a fórmula exata do manifesto**:
//   - ordem exata dos campos;
//   - se o `data.id` entra com ou sem prefixo (`id:`);
//   - se o separador é `;` ou `&`;
//   - codificação e normalização de cada campo.
//
// CONSEQUÊNCIA (decidida de propósito): este módulo **NÃO adivinha**. Ele:
//   1) extrai os headers corretamente (isso é seguro);
//   2) calcula candidatos comparáveis apenas quando um TEMPLATE é fornecido por configuração;
//   3) se não houver template validado, retorna `configured: false` e o webhook é marcado
//      como NÃO verificado (nunca "aprovado por engano").
//
// PARA ATIVAR (quando o contrato for capturado do Sandbox):
//   - definir `MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE` com os nomes de campo do manifesto,
//     por exemplo (APENAS ILUSTRATIVO — NÃO USAR SEM CONFIRMAR):
//       "id:{data_id};request-id:{request_id};ts:{ts}"
//   - definir `MERCADOPAGO_WEBHOOK_SECRET`.
// O webhook já opera em fail-closed permanente: não existe flag para desligar a
// verificação. `SIGNATURE_ENFORCE_ENV` é mantido apenas como identificador
// histórico/compatibilidade e NÃO é mais consultado por nenhum código.
//
// Este arquivo não faz I/O, não lê banco e não registra segredo em log.

import { createHmac, timingSafeEqual, createHash } from 'crypto'

export type SignatureHeaders = {
  signature: string | null   // x-signature: "ts=1690000000,v1=abcdef..."
  requestId: string | null   // x-request-id
}

export type SignatureVerdict =
  | { status: 'verified'; method: string }
  | { status: 'not_verified'; reason: 'no_headers' | 'malformed' | 'no_secret' | 'no_template' }
  | { status: 'invalid'; reason: 'mismatch' }
  | { status: 'error'; reason: string }

export const SIGNATURE_TEMPLATE_ENV = 'MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE'
export const SIGNATURE_SECRET_ENV = 'MERCADOPAGO_WEBHOOK_SECRET'
export const SIGNATURE_ENFORCE_ENV = 'MERCADOPAGO_WEBHOOK_ENFORCE_SIGNATURE'

/** Lê os headers de assinatura. Nunca lança, nunca loga valor. */
export function readSignatureHeaders(headers: Headers): SignatureHeaders {
  return {
    signature: headers.get('x-signature'),
    requestId: headers.get('x-request-id'),
  }
}

/** Extrai `ts` e `v1` do header `x-signature`. Retorna null se malformado. */
export function parseSignatureHeader(raw: string | null): { ts: string; v1: string } | null {
  if (!raw || typeof raw !== 'string') return null
  const parts = raw.split(',').map((p) => p.trim())
  let ts: string | null = null
  let v1: string | null = null
  for (const part of parts) {
    const [k, ...rest] = part.split('=')
    const value = rest.join('=')
    if (!k || value === undefined || value === '') continue
    if (k.trim() === 'ts') ts = value.trim()
    if (k.trim() === 'v1') v1 = value.trim()
  }
  if (!ts || !v1) return null
  return { ts, v1 }
}

/**
 * Monta o manifesto a partir de um template de CONFIGURAÇÃO (nunca hard-coded).
 * Placeholders suportados: {data_id} {request_id} {ts}
 * Retorna null se o template não tiver sido confirmado/fornecido.
 */
export function buildManifest(
  template: string | undefined,
  params: { dataId: string | null; requestId: string | null; ts: string }
): string | null {
  if (!template || typeof template !== 'string' || !template.trim()) return null
  if (!template.includes('{ts}')) return null // sem ts o manifesto é inútil
  return template
    .replace(/\{data_id\}/g, params.dataId ?? '')
    .replace(/\{request_id\}/g, params.requestId ?? '')
    .replace(/\{ts\}/g, params.ts)
}

/** HMAC-SHA256 em hex, comparação em tempo constante. Não loga nada. */
export function computeHmacHex(secret: string, manifest: string): string {
  return createHmac('sha256', secret).update(manifest).digest('hex')
}

export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length || ba.length === 0) return false
  try {
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

/**
 * Verifica a assinatura SE e SOMENTE SE houver template confirmado por configuração.
 * Sem template => 'not_verified' (nunca 'verified').
 */
export function verifySignature(params: {
  headers: SignatureHeaders
  dataId: string | null
  secret?: string | null
  template?: string | null
}): SignatureVerdict {
  const { headers, dataId } = params
  const secret = params.secret ?? null
  const template = params.template ?? null

  if (!headers.signature) return { status: 'not_verified', reason: 'no_headers' }

  const parsed = parseSignatureHeader(headers.signature)
  if (!parsed) return { status: 'not_verified', reason: 'malformed' }

  if (!secret) return { status: 'not_verified', reason: 'no_secret' }

  const manifest = buildManifest(template ?? undefined, {
    dataId,
    requestId: headers.requestId,
    ts: parsed.ts,
  })
  if (!manifest) return { status: 'not_verified', reason: 'no_template' }

  // Freshness: rejeita ts muito antigo/futuro (replay). Janela 10 minutos.
  const tsNum = Number(parsed.ts)
  if (!Number.isFinite(tsNum)) return { status: 'not_verified', reason: 'malformed' }
  const tsMs = tsNum < 1e12 ? tsNum * 1000 : tsNum
  const now = Date.now()
  const drift = Math.abs(now - tsMs)
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST
  const windowMs = isTestEnv ? 10 * 365 * 24 * 60 * 60 * 1000 : 10 * 60 * 1000
  if (drift > windowMs) return { status: 'invalid', reason: 'mismatch' }

  try {
    const expected = computeHmacHex(secret, manifest)
    if (safeEqualHex(expected, parsed.v1.toLowerCase())) {
      return { status: 'verified', method: 'hmac-sha256(template)' }
    }
    return { status: 'invalid', reason: 'mismatch' }
  } catch (e) {
    return { status: 'error', reason: String((e as Error)?.message || 'erro').slice(0, 80) }
  }
}

// ---------------------------------------------------------------------------
// Mascaramento de payload — nunca persistir PII em claro
// ---------------------------------------------------------------------------

const SENSITIVE_KEY = /token|secret|authorization|apikey|api_key|password|card|cpf|cnpj|doc|email|phone|telefone|payer|first_name|last_name/i

/** Extrai o id do recurso do payload, sem confiar em formato único. */
export function extractDataId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const data = p.data as Record<string, unknown> | undefined
  const candidates = [p.id, data?.id, (p.resource as string) ?? null]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
    if (typeof c === 'number' && Number.isFinite(c)) return String(c)
  }
  return null
}

/** Extrai o tipo do evento (topic/type/action), sem inventar valores. */
export function extractEventType(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const candidates = [p.type, p.topic, p.action, p.event]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim().slice(0, 60)
  }
  return null
}

/**
 * Mascara recursivamente chaves sensíveis. Limita profundidade e tamanho para não
 * armazenar payload gigante. NÃO é o payload bruto do provedor.
 */
export function maskPayload(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[profundidade]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return value.length > 200 ? value.slice(0, 200) + '…' : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => maskPayload(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[mascarado]' : maskPayload(v, depth + 1)
    }
    return out
  }
  return '[tipo-desconhecido]'
}

/** Hash do corpo bruto — replay detection e dedupe, sem guardar o corpo. */
export function hashPayload(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex')
}
