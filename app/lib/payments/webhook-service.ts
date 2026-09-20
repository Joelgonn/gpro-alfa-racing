// app/lib/payments/webhook-service.ts
// PIX-001.1 — Serviço do webhook do Mercado Pago (infraestrutura, SEM ativação financeira)
// PIX-010 — Confirmação segura e concessão idempotente VIP
//
// ESCOPO ATUAL:
//   ✅ valida método e Content-Type (route)
//   ✅ lê e mascaramento o payload
//   ✅ registra o evento em payment_events de forma IDEMPOTENTE
//   ✅ correlaciona por external_reference (quando presente) — apenas CONSULTA
//   ✅ consulta Mercado Pago server-to-server quando PIX_ENABLED=true
//   ✅ valida status approved, external_reference, valor, moeda, provider
//   ✅ confirma premium_payments (pending→confirmed) e premium_orders (pending→paid)
//   ✅ concede access_grants de forma idempotente (uniq_grant_payment_order)
//   ✅ trata estados não aprovados e retries de forma segura

import 'server-only'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import {
  hashPayload,
  maskPayload,
  extractDataId,
  extractEventType,
} from './mercadopago-signature'
import { getMercadoPagoPayment, getMercadoPagoOrder, MercadoPagoError } from './mercadopago-client'
import { canTransitionOrder, canTransitionPayment } from './paymentStateMachine'
import { syncUserStateWithGrant, pickBestGrant, interpretGrant, calculateRenewalExpiresAt } from '@/app/lib/access/accessService'

export type WebhookOutcome =
  | 'stored_pending'
  | 'duplicate_ignored'
  | 'unknown_event'
  | 'no_reference'
  | 'reference_not_found'
  | 'storage_error'
  // PIX-010 novos desfechos
  | 'confirmed'
  | 'grant_created'
  | 'grant_reused'
  | 'pending_observed'
  | 'rejected_observed'
  | 'cancelled_observed'
  | 'refunded_observed'
  | 'validation_failed'
  | 'fetch_failed'
  | 'not_approved'
  | 'already_confirmed'

export interface WebhookProcessResult {
  outcome: WebhookOutcome
  /** true quando o evento é novo e foi persistido nesta chamada */
  stored: boolean
  eventType: string | null
  dataId: string | null
  /** id do premium_orders correlacionado, quando encontrado */
  orderId: string | null
  /** id do pagamento MP quando consultado */
  providerPaymentId?: string | null
  /** id do grant quando criado/reusado */
  grantId?: string | null
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
 *  PIX-010.2: com Checkout Transparente via /v1/orders, 'order'/'order.processed' também é relevante
 *  (contém o pagamento Pix dentro de transactions.payments[0]).
 *  Mantém compatibilidade com 'payment' legado.
 */
export function isRelevantEvent(eventType: string | null): boolean {
  if (!eventType) return false
  const t = eventType.toLowerCase()
  return t === 'payment' || t === 'payments' || t.startsWith('payment.') || t === 'order' || t === 'orders' || t.startsWith('order.')
}

export function isOrderEvent(eventType: string | null): boolean {
  if (!eventType) return false
  const t = eventType.toLowerCase()
  return t === 'order' || t === 'orders' || t.startsWith('order.')
}

// ---------------------------------------------------------------------------
// Helpers PIX-010 — validações e concessão
// ---------------------------------------------------------------------------

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

/**
 * Valida pagamento MP retornado server-to-server.
 * Retorna motivo sanitizado se inválido, null se ok.
 */
export function validateMpPayment(
  mp: { providerStatus: string; externalReference: string | null; amount: number; currency: string },
  order: { id: string; amount_cents: number; currency: string },
): string | null {
  const normalizedStatus = (mp.providerStatus || '').toLowerCase()
  // Orders API retorna processed/accredited para Pix aprovado; Payments API legado retorna approved
  if (normalizedStatus !== 'approved' && normalizedStatus !== 'processed') {
    return `status_not_approved:${mp.providerStatus}`
  }
  if (!mp.externalReference || !isValidUUID(mp.externalReference)) {
    return 'external_reference_invalido'
  }
  if (mp.externalReference !== order.id) {
    return 'external_reference_divergente'
  }
  const expectedDecimal = Math.round(order.amount_cents) / 100
  // Comparação segura sem ponto flutuante: compara centavos
  const mpCents = Math.round(mp.amount * 100)
  if (mpCents !== order.amount_cents) {
    return `valor_divergente:mp=${mpCents}_order=${order.amount_cents}_expected=${expectedDecimal}`
  }
  if ((mp.currency || 'BRL').toUpperCase() !== 'BRL') {
    return `moeda_divergente:${mp.currency}`
  }
  if ((order.currency || 'BRL').toUpperCase() !== 'BRL') {
    return 'moeda_pedido_nao_BRL'
  }
  return null
}

async function confirmPaymentAndOrder(
  orderId: string,
  paymentRowId: string,
  mpProviderPaymentId: string,
): Promise<{ orderConfirmed: boolean; paymentConfirmed: boolean }> {
  // Buscar estados atuais
  const { data: order } = await supabaseAdmin.from('premium_orders').select('id, status').eq('id', orderId).maybeSingle()
  const { data: payment } = await supabaseAdmin.from('premium_payments').select('id, status').eq('id', paymentRowId).maybeSingle()

  let orderConfirmed = false
  let paymentConfirmed = false

  if (payment) {
    const from = (payment as unknown as { status: string }).status
    if (from === 'confirmed') {
      paymentConfirmed = true // já confirmado, idempotente
    } else if (canTransitionPayment(from, 'confirmed')) {
      const { error } = await supabaseAdmin
        .from('premium_payments')
        .update({ status: 'confirmed', provider_status: 'approved', provider_payment_id: mpProviderPaymentId, paid_at: new Date().toISOString() })
        .eq('id', paymentRowId)
        .in('status', ['pending', 'created'])
      if (!error) paymentConfirmed = true
      else {
        // Tentar re-ler — pode ter sido confirmado por concorrência
        const { data: recheck } = await supabaseAdmin.from('premium_payments').select('status').eq('id', paymentRowId).maybeSingle()
        if ((recheck as unknown as { status: string })?.status === 'confirmed') paymentConfirmed = true
      }
    } else if (from === 'pending' || from === 'created') {
      // Fallback: tenta atualizar mesmo se transição não prevista, mas com where
      const { error } = await supabaseAdmin.from('premium_payments').update({ status: 'confirmed', provider_status: 'approved', paid_at: new Date().toISOString() }).eq('id', paymentRowId).in('status', ['pending', 'created'])
      if (!error) paymentConfirmed = true
    }
  }

  if (order) {
    const from = (order as unknown as { status: string }).status
    if (from === 'paid') {
      orderConfirmed = true
    } else if (canTransitionOrder(from, 'paid')) {
      const { error } = await supabaseAdmin.from('premium_orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', orderId).in('status', ['pending', 'awaiting_payment', 'draft'])
      if (!error) orderConfirmed = true
      else {
        const { data: recheck } = await supabaseAdmin.from('premium_orders').select('status').eq('id', orderId).maybeSingle()
        if ((recheck as unknown as { status: string })?.status === 'paid') orderConfirmed = true
      }
    } else {
      // Fallback
      const { error } = await supabaseAdmin.from('premium_orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', orderId).eq('status', 'pending')
      if (!error) orderConfirmed = true
    }
  }

  return { orderConfirmed, paymentConfirmed }
}

async function ensurePaymentGrant(
  order: { id: string; user_id: string; plan_id: string },
): Promise<{ grantId: string | null; isNew: boolean }> {
  // Buscar duração do plano para calcular expires_at — FASE 2: usa melhor grant para preservar período
  const { data: plan } = await supabaseAdmin.from('premium_plans').select('duration_days').eq('id', order.plan_id).maybeSingle()
  const durationDays = (plan as unknown as { duration_days: number | null })?.duration_days ?? 30
  const now = new Date()
  // FASE 2: calcula com max(now, bestExpiresAt) + duration, preserva lifetime
  let expiresAt: string | null
  try {
    const { data: grants } = await supabaseAdmin
      .from('access_grants')
      .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
      .eq('user_id', order.user_id)
    const best = pickBestGrant((grants as unknown as never[]) ?? [], now)
    expiresAt = calculateRenewalExpiresAt(best as unknown as never, durationDays, now)
  } catch {
    // Fallback seguro: comportamento antigo se falhar
    expiresAt = durationDays === null ? null : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
  }
  // Metadata preserva duração para auditoria
  const durationForMeta = durationDays

  // Idempotência: já existe grant para este pedido?
  const { data: existing } = await supabaseAdmin
    .from('access_grants')
    .select('id')
    .eq('user_id', order.user_id)
    .eq('source', 'payment')
    .contains('metadata', { order_id: order.id } as unknown as string)
    .maybeSingle()

  // Fallback para índice parcial metadata->>'order_id' via filter (sem limit artificial)
  if (existing) {
    return { grantId: (existing as unknown as { id: string }).id, isNew: false }
  }
  const { data: existing2 } = await supabaseAdmin
    .from('access_grants')
    .select('id')
    .eq('user_id', order.user_id)
    .eq('source', 'payment')
    .filter('metadata->>order_id', 'eq', order.id)
    .maybeSingle()
  if (existing2) {
    return { grantId: (existing2 as unknown as { id: string }).id, isNew: false }
  }

  const payload = {
    user_id: order.user_id,
    source: 'payment' as const,
    plan: 'full_premium' as const,
    status: 'active' as const,
    starts_at: now.toISOString(),
    expires_at: expiresAt,
    metadata: {
      order_id: order.id,
      created_via: 'pix010_webhook',
      duration_days: durationForMeta,
    } as unknown as Record<string, unknown>,
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('access_grants')
    .insert(payload)
    .select('id')
    .single()

  if (!error && inserted) {
    return { grantId: (inserted as unknown as { id: string }).id, isNew: true }
  }

  if ((error as unknown as { code?: string })?.code === '23505') {
    // Concorrência: grant já inserido — busca direta via índice parcial sem limit artificial
    const { data: raced } = await supabaseAdmin
      .from('access_grants')
      .select('id')
      .eq('user_id', order.user_id)
      .eq('source', 'payment')
      .filter('metadata->>order_id', 'eq', order.id)
      .maybeSingle()
    if (raced) return { grantId: (raced as unknown as { id: string }).id, isNew: false }
    // Fallback via contains para compatibilidade
    const { data: raced2 } = await supabaseAdmin
      .from('access_grants')
      .select('id')
      .eq('user_id', order.user_id)
      .eq('source', 'payment')
      .contains('metadata', { order_id: order.id } as unknown as string)
      .maybeSingle()
    if (raced2) return { grantId: (raced2 as unknown as { id: string }).id, isNew: false }
  }

  return { grantId: null, isNew: false }
}

/**
 * Processa o webhook: registra o evento e, quando PIX_ENABLED=true e evento relevante,
 * confirma pagamento via server-to-server e concede VIP de forma idempotente.
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

  // PIX-010.2: order também é relevante (Checkout Transparente)
  const isOrder = isOrderEvent(eventType)

  // Correlação por external_reference — APENAS consulta, nada é alterado (para registro inicial).
  // PIX-011.1 #4: dedupe primeiro, fetch depois — não fazer getMercadoPagoOrder antes do insert (evita DoS/rate-limit antes do dedupe)
  // Para isOrder, externalReference será resolvido via getMercadoPagoOrder(dataId) APÓS o dedupe
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
  // Para isOrder, considerar pending mesmo sem orderId inicial (será resolvido via fetch após dedupe)
  const shouldBePending = isOrder ? true : relevant && Boolean(orderId)
  const initialError = isOrder
    ? null
    : relevant
      ? orderId ? null : 'external_reference ausente ou nao encontrado'
      : 'evento fora do escopo do modulo Pix'
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('payment_events')
    .insert({
      order_id: orderId,
      provider: PROVIDER,
      event_type: eventType,
      event_id: eventId,
      payload_hash: hashPayload(rawBody),
      payload_json: maskPayload(payload) as Record<string, unknown>,
      processing_status: shouldBePending ? 'pending' : 'ignored',
      processed_at: new Date().toISOString(),
      error_message: initialError,
    })
    .select('id')
    .maybeSingle()

  if (insErr) {
    // 23505 = unique_violation em event_id => evento duplicado (comportamento correto)
    // Para isOrder com status incompleto, permitir reprocessamento se anterior foi ignored
    if ((insErr as { code?: string }).code === '23505') {
      // Verifica se o evento existente está como ignored/no_reference e pode ser recuperado
      const { data: existing } = await supabaseAdmin
        .from('payment_events')
        .select('processing_status, order_id')
        .eq('event_id', eventId)
        .maybeSingle()
      const canRecover =
        existing &&
        (existing as { processing_status: string }).processing_status === 'ignored' &&
        isOrder
      if (canRecover && orderId) {
        // Atualiza o registro legado em vez de deletar (preserva idempotência sem violar teste de segurança)
        const { error: updErr } = await supabaseAdmin
          .from('payment_events')
          .update({
            order_id: orderId,
            processing_status: 'pending',
            error_message: null,
            payload_hash: hashPayload(rawBody),
            payload_json: maskPayload(payload) as Record<string, unknown>,
            processed_at: new Date().toISOString(),
          })
          .eq('event_id', eventId)
        if (!updErr) {
          // Recuperação bem-sucedida — continua para o fluxo principal abaixo
        } else {
          return { outcome: 'duplicate_ignored', stored: false, eventType, dataId, orderId }
        }
      } else {
        return { outcome: 'duplicate_ignored', stored: false, eventType, dataId, orderId }
      }
    } else {
      return { outcome: 'storage_error', stored: false, eventType, dataId, orderId }
    }
  }

  if (!inserted) {
    return { outcome: 'duplicate_ignored', stored: false, eventType, dataId, orderId }
  }

  if (!relevant && !isOrder) return { outcome: 'unknown_event', stored: true, eventType, dataId, orderId }
  if (!externalReference && !isOrder) return { outcome: 'no_reference', stored: true, eventType, dataId, orderId }
  if (!orderId && !isOrder) return { outcome: 'reference_not_found', stored: true, eventType, dataId, orderId }

  // PIX-010: a partir daqui, evento relevante com orderId (ou order), mas ainda sem confirmação.
  // Se PIX_ENABLED=false, preserva comportamento antigo (stored_pending, sem MP).
  const pixEnabled = process.env.PIX_ENABLED === 'true'
  if (!pixEnabled) {
    void signatureStatus
    void signatureMethod
    return { outcome: 'stored_pending', stored: true, eventType, dataId, orderId }
  }

  // PIX_ENABLED=true: precisa de data.id (paymentId ou orderId) para consultar MP
  if (!dataId) {
    await supabaseAdmin.from('payment_events').update({ processing_status: 'ignored', error_message: 'data.id ausente, sem consulta MP' }).eq('event_id', eventId)
    return { outcome: 'unknown_event', stored: true, eventType, dataId, orderId }
  }

  // Consulta server-to-server (fonte de verdade) — suporta /v1/payments e /v1/orders
  let mp: Awaited<ReturnType<typeof getMercadoPagoPayment>>
  try {
    if (isOrder) {
      // Checkout Transparente: data.id é orderId, buscar order e extrair payment
      const orderMp = await getMercadoPagoOrder(dataId)
      // Se a order contém o pagamento, usa-o; senão, usa a própria order como mp (para validação via total_amount)
      // Para compatibilidade, se orderMp já tem providerPaymentId (do payment dentro), usa orderMp
      mp = orderMp
      // Se a order não tem external_reference no nível da order, mas tem no payment, já está em orderMp.externalReference
      // Garante que orderId seja derivado do external_reference da order se ainda não tínhamos
      if (!orderId && orderMp.externalReference) {
        const { data: orderByExt } = await supabaseAdmin.from('premium_orders').select('id').eq('id', orderMp.externalReference as string).maybeSingle()
        if (orderByExt) orderId = (orderByExt as { id: string }).id
      }
      if (!orderId) {
        await supabaseAdmin.from('payment_events').update({ processing_status: 'failed', error_message: 'external_reference ausente na order' }).eq('event_id', eventId)
        return { outcome: 'no_reference', stored: true, eventType, dataId, orderId }
      }
      // Atualiza payment_events com orderId resolvido via Order (para auditoria e idempotência)
      await supabaseAdmin.from('payment_events').update({ order_id: orderId }).eq('event_id', eventId)
    } else {
      mp = await getMercadoPagoPayment(dataId)
    }
  } catch (e: unknown) {
    const err = e as MercadoPagoError
    const code = (err as unknown as { code?: string })?.code || 'UNKNOWN'
    const msg = String((err as Error)?.message || '').slice(0, 80)
    // Erros esperados: CONFIG_MISSING, UNAUTHORIZED, NOT_FOUND, RATE_LIMITED, TIMEOUT, etc.
    // Não concede VIP, registra erro sanitizado e retorna 200 para evitar retry infinito (exceto 429/timeout que MP já retém)
    await supabaseAdmin.from('payment_events').update({ processing_status: 'failed', error_message: `mp_fetch_failed:${code}:${msg}`.slice(0, 200) }).eq('event_id', eventId)
    if (code === 'MERCADOPAGO_CONFIG_MISSING') {
      return { outcome: 'validation_failed', stored: true, eventType, dataId, orderId }
    }
    return { outcome: 'fetch_failed', stored: true, eventType, dataId, orderId }
  }

  // Validações obrigatórias antes de confirmar
  // Buscar pedido completo para validar valor/moeda/usuário
  const { data: fullOrder } = await supabaseAdmin.from('premium_orders').select('id, user_id, plan_id, amount_cents, currency, status').eq('id', orderId).maybeSingle()
  if (!fullOrder) {
    await supabaseAdmin.from('payment_events').update({ processing_status: 'failed', error_message: 'pedido nao encontrado apos mp fetch' }).eq('event_id', eventId)
    return { outcome: 'reference_not_found', stored: true, eventType, dataId, orderId }
  }

  // Validar provider: deve ser mercadopago, não test
  // Buscar pagamento local correspondente (deve existir, criado em POST /api/payments/orders)
  const { data: localPayment } = await supabaseAdmin
    .from('premium_payments')
    .select('id, order_id, provider, status, amount_cents, currency')
    .eq('order_id', orderId)
    .eq('provider', 'mercadopago')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!localPayment) {
    await supabaseAdmin.from('payment_events').update({ processing_status: 'failed', error_message: 'pagamento local mercadopago nao encontrado' }).eq('event_id', eventId)
    return { outcome: 'validation_failed', stored: true, eventType, dataId, orderId }
  }
  if ((localPayment as unknown as { provider: string }).provider !== 'mercadopago') {
    await supabaseAdmin.from('payment_events').update({ processing_status: 'failed', error_message: 'provider divergente' }).eq('event_id', eventId)
    return { outcome: 'validation_failed', stored: true, eventType, dataId, orderId }
  }

  const orderForValidation = fullOrder as unknown as { id: string; amount_cents: number; currency: string; user_id: string; plan_id: string; status: string }
  const validationError = validateMpPayment(
    { providerStatus: mp.providerStatus, externalReference: mp.externalReference, amount: mp.amount, currency: mp.currency },
    { id: orderForValidation.id, amount_cents: orderForValidation.amount_cents, currency: orderForValidation.currency },
  )

  if (validationError) {
    // Estados não aprovados: pending, in_process, rejected, etc.
    const status = mp.providerStatus
    if (status === 'pending' || status === 'in_process' || status === 'authorized') {
      await supabaseAdmin.from('payment_events').update({ processing_status: 'pending', error_message: `mp_status:${status}` }).eq('event_id', eventId)
      return { outcome: 'pending_observed', stored: true, eventType, dataId, orderId, providerPaymentId: mp.providerPaymentId }
    }
    if (status === 'rejected' || status === 'cancelled') {
      await supabaseAdmin.from('payment_events').update({ processing_status: 'ignored', error_message: `mp_rejected:${status}` }).eq('event_id', eventId)
      return { outcome: 'rejected_observed', stored: true, eventType, dataId, orderId, providerPaymentId: mp.providerPaymentId }
    }
    if (status === 'refunded' || status === 'charged_back') {
      await supabaseAdmin.from('payment_events').update({ processing_status: 'ignored', error_message: `mp_refunded:${status}` }).eq('event_id', eventId)
      return { outcome: 'refunded_observed', stored: true, eventType, dataId, orderId, providerPaymentId: mp.providerPaymentId }
    }
    // Demais falhas de validação (valor, moeda, external_reference)
    await supabaseAdmin.from('payment_events').update({ processing_status: 'failed', error_message: `validation:${validationError}`.slice(0, 200) }).eq('event_id', eventId)
    return { outcome: 'validation_failed', stored: true, eventType, dataId, orderId, providerPaymentId: mp.providerPaymentId }
  }

  // Status approved e validações ok → confirmar pagamento e pedido
  // Verificar se já estava confirmado (idempotência)
  const alreadyConfirmed = (localPayment as unknown as { status: string }).status === 'confirmed'
  const { data: alreadyPaidOrder } = await supabaseAdmin.from('premium_orders').select('status').eq('id', orderId).maybeSingle()
  const alreadyPaid = (alreadyPaidOrder as unknown as { status: string })?.status === 'paid'

  if (alreadyConfirmed && alreadyPaid) {
    // Verifica grant existente para retorno idempotente
    const { data: existingGrant } = await supabaseAdmin
      .from('access_grants')
      .select('id')
      .eq('user_id', orderForValidation.user_id)
      .eq('source', 'payment')
      .contains('metadata', { order_id: orderId } as unknown as string)
      .maybeSingle()
    const grantId = (existingGrant as unknown as { id: string } | null)?.id ?? null
    // PIX-021: sincroniza user_state com o melhor grant ativo (idempotente, não bloqueia webhook)
    if (grantId) {
      try {
        const { data: allGrants } = await supabaseAdmin
          .from('access_grants')
          .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
          .eq('user_id', orderForValidation.user_id)
        const best = pickBestGrant((allGrants as unknown as never[]) ?? [], new Date())
        if (best && interpretGrant(best as never).hasAccess) {
          await syncUserStateWithGrant(orderForValidation.user_id, best as never)
        } else if (existingGrant) {
          const { data: ensured } = await supabaseAdmin
            .from('access_grants')
            .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
            .eq('id', grantId)
            .maybeSingle()
          if (ensured && interpretGrant(ensured as never).hasAccess) {
            await syncUserStateWithGrant(orderForValidation.user_id, ensured as never)
          }
        }
      } catch {}
    }
    await supabaseAdmin.from('payment_events').update({ processing_status: 'processed', error_message: null }).eq('event_id', eventId)
    return { outcome: 'already_confirmed', stored: true, eventType, dataId, orderId, providerPaymentId: mp.providerPaymentId, grantId }
  }

  const paymentRowId = (localPayment as unknown as { id: string }).id
  const { orderConfirmed, paymentConfirmed } = await confirmPaymentAndOrder(orderId as string, paymentRowId, mp.providerPaymentId)

  // Mesmo se já confirmado, prossegue para grant (idempotente)
  const grantRes = await ensurePaymentGrant({ id: orderForValidation.id, user_id: orderForValidation.user_id, plan_id: orderForValidation.plan_id })

  // PIX-021: sincroniza user_state com o melhor grant ativo (não altera se grant falhou)
  if (grantRes.grantId) {
    try {
      const { data: allGrants } = await supabaseAdmin
        .from('access_grants')
        .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
        .eq('user_id', orderForValidation.user_id)
      const best = pickBestGrant((allGrants as unknown as never[]) ?? [], new Date())
      if (best && interpretGrant(best as never).hasAccess) {
        await syncUserStateWithGrant(orderForValidation.user_id, best as never)
      } else {
        const { data: ensured } = await supabaseAdmin
          .from('access_grants')
          .select('id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at')
          .eq('id', grantRes.grantId)
          .maybeSingle()
        if (ensured && interpretGrant(ensured as never).hasAccess) {
          await syncUserStateWithGrant(orderForValidation.user_id, ensured as never)
        }
      }
    } catch {}
  }

  await supabaseAdmin.from('payment_events').update({ processing_status: 'processed', error_message: null }).eq('event_id', eventId)

  void signatureStatus
  void signatureMethod
  void orderConfirmed
  void paymentConfirmed

  if (grantRes.isNew) {
    return { outcome: 'grant_created', stored: true, eventType, dataId, orderId, providerPaymentId: mp.providerPaymentId, grantId: grantRes.grantId }
  }
  return { outcome: 'grant_reused', stored: true, eventType, dataId, orderId, providerPaymentId: mp.providerPaymentId, grantId: grantRes.grantId }
}
