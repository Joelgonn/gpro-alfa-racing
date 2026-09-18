// app/lib/payments/webhook-service.ts
// PIX-001.1 — Serviço do webhook do Mercado Pago (infraestrutura, SEM ativação financeira)
//
// ESCOPO DESTA SPRINT (deliberadamente restrito):
//   ✅ valida método e Content-Type
//   ✅ lê e mascaramento o payload
//   ✅ registra o evento em payment_events de forma IDEMPOTENTE
//   ✅ correlaciona por external_reference (quando presente) — apenas CONSULTA
//   ✅ classifica o desfecho para o log
//   ❌ NÃO confirma pagamento
//   ❌ NÃO altera premium_payments.status
//   ❌ NÃO altera premium_orders.status
//   ❌ NÃO concede VIP
//   ❌ NÃO chama o Mercado Pago (contrato ainda não capturado)
//
// O webhook é um OBSERVADOR nesta sprint. Ele registra o fato e para.

import 'server-only'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import {
  hashPayload,
  maskPayload,
  extractDataId,
  extractEventType,
} from './mercadopago-signature'

export type WebhookOutcome =
  | 'stored_pending'
  | 'duplicate_ignored'
  | 'unknown_event'
  | 'no_reference'
  | 'reference_not_found'
  | 'storage_error'

export interface WebhookProcessResult {
  outcome: WebhookOutcome
  /** true quando o evento é novo e foi persistido nesta chamada */
  stored: boolean
  eventType: string | null
  dataId: string | null
  /** id do premium_orders correlacionado, quando encontrado */
  orderId: string | null
}

const PROVIDER = 'mercadopago'

/**
 * Monta o `event_id` determinístico usado para deduplicação.
 * Usa `id` do evento + status quando disponível; recorre a hash do corpo.
 * Formato estável: "<eventType>:<dataId>:<status|hash8>".
 */
export function buildEventId(params: {
  eventType: string | null
  dataId: string | null
  status: string | null
  rawBody: string
}): string {
  const { eventType, dataId, status, rawBody } = params
  const suffix = status && status.trim() ? status.trim() : hashPayload(rawBody).slice(0, 8)
  return `${eventType ?? 'unknown'}:${dataId ?? 'noid'}:${suffix}`.slice(0, 200)
}

/** Extrai o status declarado no payload (para dedupe), sem confiar nele para decidir. */
export function extractDeclaredStatus(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const data = p.data as Record<string, unknown> | undefined
  const candidates = [data?.status, p.status, p.action]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim().slice(0, 40)
  }
  return null
}

/** Extrai external_reference do payload, quando o provedor o envia. */
export function extractExternalReference(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const data = p.data as Record<string, unknown> | undefined
  const candidates = [data?.external_reference, p.external_reference]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim().slice(0, 120)
  }
  return null
}

/** Tipos de evento que interessam nesta integração. Qualquer outro é registrado e ignorado.
 *  Nota: 'order.processed' (enviado pelo teste do Mercado Pago) NÃO é um evento de pagamento
 *  e retorna 'unknown_event' — o sistema propositalmente NÃO concede VIP para 'order.*'.
 *  Apenas 'payment' / 'payment.*' são relevantes para futura confirmação de Pix.
 */
export function isRelevantEvent(eventType: string | null): boolean {
  if (!eventType) return false
  const t = eventType.toLowerCase()
  return t === 'payment' || t === 'payments' || t.startsWith('payment.')
}

/**
 * Processa o webhook: registra o evento e correlaciona. NUNCA concede nada.
 * Retorna o desfecho para o handler decidir a resposta HTTP.
 */
export async function processWebhookEvent(params: {
  rawBody: string
  payload: unknown
  signatureStatus: 'verified' | 'not_verified' | 'invalid' | 'error'
  signatureMethod?: string | null
}): Promise<WebhookProcessResult> {
  const { rawBody, payload, signatureStatus, signatureMethod } = params

  const eventType = extractEventType(payload)
  const dataId = extractDataId(payload)
  const declaredStatus = extractDeclaredStatus(payload)
  const externalReference = extractExternalReference(payload)
  const eventId = buildEventId({ eventType, dataId, status: declaredStatus, rawBody })

  // Evento não relacionado a pagamento: registra como ignorado (não some sem rastro).
  const relevant = isRelevantEvent(eventType)

  // Correlação por external_reference — APENAS consulta, nada é alterado.
  let orderId: string | null = null
  if (externalReference) {
    const { data } = await supabaseAdmin
      .from('premium_orders')
      .select('id, user_id, status')
      .eq('id', externalReference)
      .maybeSingle()
    if (data) orderId = (data as { id: string }).id
  }

  // Insere de forma idempotente. Conflito em event_id => já processado.
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('payment_events')
    .insert({
      order_id: orderId,
      provider: PROVIDER,
      event_type: eventType,
      event_id: eventId,
      payload_hash: hashPayload(rawBody),
      payload_json: maskPayload(payload) as Record<string, unknown>,
      processing_status: relevant && orderId ? 'pending' : 'ignored',
      processed_at: new Date().toISOString(),
      error_message: relevant
        ? (orderId ? null : 'external_reference ausente ou nao encontrado')
        : 'evento fora do escopo do modulo Pix',
    })
    .select('id')
    .maybeSingle()

  if (insErr) {
    // 23505 = unique_violation em event_id => evento duplicado (comportamento correto)
    if ((insErr as { code?: string }).code === '23505') {
      return { outcome: 'duplicate_ignored', stored: false, eventType, dataId, orderId }
    }
    return { outcome: 'storage_error', stored: false, eventType, dataId, orderId }
  }

  if (!inserted) {
    return { outcome: 'duplicate_ignored', stored: false, eventType, dataId, orderId }
  }

  if (!relevant) return { outcome: 'unknown_event', stored: true, eventType, dataId, orderId }
  if (!externalReference) return { outcome: 'no_reference', stored: true, eventType, dataId, orderId }
  if (!orderId) return { outcome: 'reference_not_found', stored: true, eventType, dataId, orderId }

  void signatureStatus
  void signatureMethod
  return { outcome: 'stored_pending', stored: true, eventType, dataId, orderId }
}
