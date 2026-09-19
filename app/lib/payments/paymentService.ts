// app/lib/payments/paymentService.ts
// ALFA-014.2 — Serviço de pagamentos com teste (sem Pix real, sem VIP)
// ALFA-014.3 — Fonte ÚNICA do pix_txid de teste + reuso determinístico e idempotente
//
// Regras desta camada:
// - NUNCA chamar gateway, NUNCA gerar QR Code, NUNCA gerar Pix real
// - NUNCA marcar pagamento como confirmado/pago nesta sprint
// - NUNCA conceder acesso premium automaticamente nesta sprint
// - pix_txid de teste é determinístico, persistido e reutilizado (nunca vem do frontend)

import 'server-only'
import { createHash } from 'crypto'
import { supabaseAdmin } from '../supabase-admin'
import { PAYMENT_PUBLIC_COLUMNS, type PremiumPayment } from './types'

/**
 * ALFA-014.3 — Única fonte de verdade do pix_txid de teste.
 * Determinístico: mesmo pedido (+ usuário/payload) produz sempre o mesmo identificador.
 * Formato: TEST-ALFA-0141-<12 hex maiúsculos> — nunca é um txid real de gateway.
 * Não contém CPF, telefone, e-mail, token ou dado bancário.
 * O hash interno nunca é exposto nem logado.
 */
export function createTestPixTxid(orderId: string, userId?: string, payloadHash?: string): string {
  const material = `TEST-ALFA-0141|${orderId}|${userId ?? ''}|${payloadHash ?? ''}`
  const hash = createHash('sha256').update(material).digest('hex').slice(0, 12).toUpperCase()
  return `TEST-ALFA-0141-${hash}`
}

// Erro seguro para pedido não pertencente ao usuário (mesmo 404 de pedido inexistente)
function orderNotOwnedError(): Error {
  const err = new Error('Pedido não encontrado') as Error & { status?: number }
  err.status = 404
  return err
}

// Cria pagamento para um pedido, com prevenção de duplicidade via order_id
// PIX-011.1: exige userId e valida ownership antes de qualquer escrita (IDOR)
export async function createPaymentForOrder(params: {
  orderId: string
  userId: string
  provider?: string
}): Promise<PremiumPayment> {
  const { orderId, userId, provider = 'mock' } = params
  if (!orderId) throw new Error('orderId obrigatório')
  if (!userId) throw new Error('userId obrigatório')

  // Verificar pedido existe e pertence ao usuário (ownership)
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('premium_orders')
    .select('id, user_id, amount_cents, currency, status')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single()
  if (orderErr || !order) throw new Error('Pedido não encontrado')

  // Idempotência: se já existe pagamento pending/created para este pedido, retorna
  const { data: existing } = await supabaseAdmin
    .from('premium_payments')
    .select(PAYMENT_PUBLIC_COLUMNS)
    .eq('order_id', orderId)
    .in('status', ['pending', 'created', 'confirmed'])
    .maybeSingle()
  if (existing) return existing as unknown as PremiumPayment

  const amount_cents = (order as any).amount_cents
  const currency = (order as any).currency

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('premium_payments')
    .insert({
      order_id: orderId,
      provider,
      status: 'pending',
      amount_cents,
      currency,
    })
    .select(PAYMENT_PUBLIC_COLUMNS)
    .single()
  if (insErr || !inserted) throw new Error(insErr?.message || 'Falha ao criar pagamento')
  return inserted as unknown as PremiumPayment
}

export async function getPaymentForUser(paymentId: string, userId: string): Promise<PremiumPayment | null> {
  // Verifica via join com premium_orders.user_id
  const { data, error } = await supabaseAdmin
    .from('premium_payments')
    .select(`${PAYMENT_PUBLIC_COLUMNS}, premium_orders!inner(user_id)`)
    .eq('id', paymentId)
    .eq('premium_orders.user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  // Defesa adicional: nunca devolver pagamento cujo pedido não pertence ao usuário
  if (data && (data as any).premium_orders?.user_id !== userId) return null
  return data as unknown as PremiumPayment
}

/**
 * ALFA-014.3 — Leitura escopada do pagamento de teste de um pedido autorizado.
 * Escopo obrigatório: order_id + dono do pedido (user_id) + provider='test'.
 * Sem userId retorna null (nunca desce ao banco sem escopo).
 * Não filtra status: uso interno/diagnóstico; a apresentação ao usuário
 * exclui status terminais em orderService.
 */
export async function getTestPaymentForOrder(orderId: string, userId: string): Promise<PremiumPayment | null> {
  if (!orderId || !userId) return null

  const { data, error } = await supabaseAdmin
    .from('premium_payments')
    .select(`${PAYMENT_PUBLIC_COLUMNS}, premium_orders!inner(id, user_id)`)
    .eq('order_id', orderId)
    .eq('provider', 'test')
    .eq('premium_orders.user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as unknown as PremiumPayment) || null
}

/**
 * ALFA-014.3 — Cria (ou reutiliza) o pagamento de teste de um pedido autorizado.
 * - userId é OBRIGATÓRIO e sempre vem da sessão: impossível criar pagamento para pedido de terceiro.
 * - Validação de propriedade acontece ANTES de qualquer consulta a premium_payments.
 * - Reuso determinístico: se já existe pagamento do pedido, devolve a linha existente
 *   com o mesmo pix_txid persistido (nada é regravado).
 * - Nunca chama gateway, nunca gera QR Code, nunca confirma pagamento, nunca concede acesso premium.
 */
export async function createTestPaymentForOrder(orderId: string, userId: string): Promise<PremiumPayment> {
  if (!orderId || !userId) throw new Error('orderId e userId obrigatórios')

  // 1. Dono do pedido (order_id + user_id) — falha segura antes de qualquer leitura de pagamento
  const { data: order } = await supabaseAdmin
    .from('premium_orders')
    .select('id, user_id, amount_cents, currency')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!order) throw orderNotOwnedError()

  // 2. Reuso idempotente do pagamento de teste já existente
  const existing = await getTestPaymentForOrder(orderId, userId)
  if (existing) return existing

  // 3. Criação do pagamento de teste (provider test, status created, pix_txid persistido)
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('premium_payments')
    .insert({
      order_id: orderId,
      provider: 'test',
      status: 'created',
      amount_cents: (order as any).amount_cents,
      currency: (order as any).currency,
      pix_txid: createTestPixTxid(orderId, userId),
    })
    .select(PAYMENT_PUBLIC_COLUMNS)
    .single()

  if (insErr || !inserted) {
    // Concorrência: outro processo pode ter inserido o mesmo pagamento (unique pix_txid)
    if ((insErr as any)?.code === '23505') {
      const raced = await getTestPaymentForOrder(orderId, userId)
      if (raced) return raced
    }
    throw new Error(insErr?.message || 'Falha ao criar pagamento de teste')
  }

  // 4. O pagamento permanece em 'created' nesta sprint — nenhuma transição é executada
  return inserted as unknown as PremiumPayment
}

/**
 * ALFA-014.3 — Porta canônica idempotente para fluxos autenticados server-side.
 * Mantém o pagamento de teste em provider=test / status=created.
 * Nunca gera Pix real, QR Code, confirmação nem concessão de acesso.
 */
export async function ensureTestPaymentForOrder(orderId: string, userId: string): Promise<PremiumPayment> {
  return createTestPaymentForOrder(orderId, userId)
}

export async function getSafePaymentForUser(paymentId: string, userId: string): Promise<PremiumPayment | null> {
  return getPaymentForUser(paymentId, userId)
}

// ---------------------------------------------------------------------------
// PIX-008 — Integração Mercado Pago (adaptador real, condicionado a PIX_ENABLED)
// PIX-014.6 — CAMADA DE TENTATIVA (idempotência própria por tentativa)
// ---------------------------------------------------------------------------
// O adaptador Mercado Pago continua sendo o único ponto de comunicação com o
// provedor. O que mudou é QUAL chave de idempotência é enviada:
//
//   ANTES: chave do checkout (TEST-ALFA-0141-<PLANO>-<DIA>) — a MESMA chave em
//          todas as tentativas do mesmo plano no mesmo dia. Depois de uma tentativa
//          registrada no provedor (mesmo terminando em erro), a seguinte recebia
//          409 `idempotency_key_already_used`.
//
//   AGORA: chave POR TENTATIVA, persistida ANTES da chamada ao provedor:
//          TEST-ALFA-0141-MP-<orderId>-<n>
//
// Regras desta camada:
//   - retry da MESMA tentativa (timeout / resposta perdida / clique duplo) → MESMA chave;
//   - tentativa encerrada sem cobrança utilizável → NOVA tentativa com NOVA chave;
//   - QR válido existente → devolve sem chamar o provedor;
//   - Order recuperável por provider_order_id → reusa (GET /v1/orders), não duplica;
//   - 409 de idempotência → tratamento próprio, no máximo UMA recuperação (sem loop);
//   - nenhuma chave aleatória por requisição: a chave é determinística por tentativa.
//
// A chave é persistida em premium_payments.pix_txid — coluna cuja finalidade
// documentada é exatamente idempotência ("ID Pix para idempotência"), coberta pelo
// índice único parcial uniq_premium_payments_pix_txid: duas tentativas nunca
// compartilham a mesma chave, o que garante a proteção contra clique duplo.
// NENHUMA migration foi necessária.
//
// Erro de configuração (MERCADOPAGO_CONFIG_MISSING) continua NÃO fazendo fallback
// para provider=test, e esta camada NÃO concede acesso premium.

import {
  createPixPayment as mpCreatePixPayment,
  getMercadoPagoPayment as mpGetPayment,
  getMercadoPagoOrder as mpGetOrder,
  type MercadoPagoError,
  type MercadoPagoErrorDetail,
} from './mercadopago-client'

export async function fetchMercadoPagoPayment(paymentId: string) {
  return mpGetPayment(paymentId)
}

// ---------------------------------------------------------------------------
// PIX-014.6 — Tentativa Mercado Pago: tipos, chave e classificação (puros)
// ---------------------------------------------------------------------------

/** Janela em que uma tentativa sem QR ainda é considerada "em voo" e mantém a mesma chave. */
export const MP_ATTEMPT_IN_FLIGHT_MS = 90_000

const MP_ATTEMPT_COLUMNS =
  'id, order_id, provider, status, pix_txid, provider_payment_id, provider_status, external_reference, qr_code, qr_code_base64, ticket_url, expires_at, created_at, amount_cents, currency'

export interface MercadoPagoAttemptRow {
  id: string
  order_id: string
  provider: string
  status: string
  pix_txid: string | null
  provider_payment_id: string | null
  provider_status: string | null
  external_reference: string | null
  qr_code: string | null
  qr_code_base64: string | null
  ticket_url: string | null
  expires_at: string | null
  created_at: string
  amount_cents: number
  currency: string
}

/**
 * Estado da última tentativa de um pedido:
 * - `paid`      → já confirmada (nunca criar outra cobrança)
 * - `usable_qr` → existe QR válido: devolver sem chamar o provedor
 * - `in_flight` → sem QR e recente: retry deve usar a MESMA chave
 * - `stale`     → sem QR e antiga: pode ser encerrada e substituída por nova tentativa
 * - `closed`    → encerrada sem cobrança utilizável: nova tentativa com nova chave
 * - `none`      → nenhuma tentativa ainda
 */
export type MercadoPagoAttemptState = 'none' | 'paid' | 'usable_qr' | 'in_flight' | 'stale' | 'closed'

/**
 * Chave de idempotência DA TENTATIVA (determinística e persistida).
 * Nunca é aleatória por requisição: é função do pedido e do número da tentativa.
 */
export function buildMercadoPagoAttemptKey(orderId: string, attemptNumber: number): string {
  return `TEST-ALFA-0141-MP-${orderId}-${attemptNumber}`
}

/** Classificação pura da tentativa mais recente — sem banco, testável isoladamente. */
export function classifyMercadoPagoAttempt(
  row: MercadoPagoAttemptRow | null,
  now: Date = new Date(),
): MercadoPagoAttemptState {
  if (!row) return 'none'
  if (row.status === 'confirmed') return 'paid'

  const hasQr = Boolean(row.qr_code)
  if (hasQr && (row.status === 'created' || row.status === 'pending')) {
    if (!row.expires_at) return 'usable_qr'
    const expires = new Date(row.expires_at)
    if (Number.isNaN(expires.getTime())) return 'usable_qr'
    return expires.getTime() > now.getTime() ? 'usable_qr' : 'closed'
  }

  if (row.status === 'created') {
    const created = new Date(row.created_at)
    const age = Number.isNaN(created.getTime()) ? Number.POSITIVE_INFINITY : now.getTime() - created.getTime()
    return age < MP_ATTEMPT_IN_FLIGHT_MS ? 'in_flight' : 'stale'
  }

  // 'pending' sem QR, ou tentativa já encerrada (failed/refunded/chargeback):
  // não há cobrança utilizável ⇒ a próxima tentativa recebe chave nova.
  return 'closed'
}

// ---------------------------------------------------------------------------
// PIX-014.6 — Persistência da tentativa (sempre ANTES de chamar o provedor)
// ---------------------------------------------------------------------------

async function getLatestMercadoPagoAttempt(orderId: string): Promise<MercadoPagoAttemptRow | null> {
  const { data } = await supabaseAdmin
    .from('premium_payments')
    .select(MP_ATTEMPT_COLUMNS)
    .eq('order_id', orderId)
    .eq('provider', 'mercadopago')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as unknown as MercadoPagoAttemptRow | null) ?? null
}

async function countMercadoPagoAttempts(orderId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('premium_payments')
    .select('id')
    .eq('order_id', orderId)
    .eq('provider', 'mercadopago')
  return Array.isArray(data) ? data.length : 0
}

/** Existe cobrança Mercado Pago com QR ainda válido para este pedido? (leitura pura) */
export async function hasUsableMercadoPagoPayment(orderId: string): Promise<boolean> {
  if (!orderId) return false
  const latest = await getLatestMercadoPagoAttempt(orderId)
  return classifyMercadoPagoAttempt(latest) === 'usable_qr'
}

/**
 * Abre a tentativa `n` gravando a chave ANTES da chamada ao provedor.
 * Em corrida (clique duplo), o índice único de pix_txid faz uma das requisições
 * perder com 23505 — ela então ADOTA a linha vencedora, de modo que as duas
 * chamadas usem exatamente a mesma chave e o provedor devolva a mesma Order.
 */
async function openMercadoPagoAttempt(params: {
  orderId: string
  attemptNumber: number
  amountCents: number
  currency: string
}): Promise<MercadoPagoAttemptRow> {
  const key = buildMercadoPagoAttemptKey(params.orderId, params.attemptNumber)

  const { data, error } = await supabaseAdmin
    .from('premium_payments')
    .insert({
      order_id: params.orderId,
      provider: 'mercadopago',
      status: 'created',
      amount_cents: params.amountCents,
      currency: params.currency,
      external_reference: params.orderId,
      pix_txid: key,
    })
    .select(MP_ATTEMPT_COLUMNS)
    .single()

  if (!error && data) return data as unknown as MercadoPagoAttemptRow

  if ((error as unknown as { code?: string })?.code === '23505') {
    const raced = await getLatestMercadoPagoAttempt(params.orderId)
    if (raced) return raced
  }

  throw new Error(error?.message || 'Falha ao registrar tentativa Mercado Pago')
}

/** Encerra a tentativa sem cobrança utilizável, preservando o motivo para diagnóstico. */
async function closeMercadoPagoAttempt(rowId: string, marker: string, rawMasked?: Record<string, unknown>): Promise<void> {
  try {
    await supabaseAdmin
      .from('premium_payments')
      .update({
        status: 'failed',
        provider_status: marker.slice(0, 120),
        ...(rawMasked ? { raw_response_masked: rawMasked as unknown as Record<string, never> } : {}),
      })
      .eq('id', rowId)
  } catch {
    // Melhor esforço: a chave já foi usada no provedor; a próxima tentativa terá chave nova.
  }
}

/**
 * A falha deixa o desfecho DESCONHECIDO no provedor?
 * Timeout, falha de rede, 429 e 5xx podem ter criado a Order sem nos devolver a
 * resposta. Nesses casos a tentativa continua "em voo" e o retry deve reutilizar
 * a MESMA chave (por isso não é encerrada agora). Rejeição definitiva (4xx
 * processado pelo provedor, inclusive 409 de idempotência) encerra a tentativa.
 */
function isAttemptOutcomeUnknown(err: MercadoPagoError & { code?: string; status?: number }): boolean {
  if (err?.code === 'MERCADOPAGO_TIMEOUT') return true
  if (err?.code === 'MERCADOPAGO_RATE_LIMITED') return true
  const status = err?.status
  if (typeof status !== 'number') return true // falha de rede: nenhuma resposta do provedor
  return status >= 500
}

/** Mantém a tentativa EM VOO (mesma chave no retry), apenas registrando o motivo. */
async function markAttemptUncertain(rowId: string, marker: string, rawMasked?: Record<string, unknown>): Promise<void> {
  try {
    await supabaseAdmin
      .from('premium_payments')
      .update({
        status: 'created',
        provider_status: marker.slice(0, 120),
        ...(rawMasked ? { raw_response_masked: rawMasked as unknown as Record<string, never> } : {}),
      })
      .eq('id', rowId)
  } catch {
    // Melhor esforço: sem marcação a tentativa continua 'created' de qualquer forma.
  }
}

function isValidDate(value: string | null | undefined): boolean {
  if (!value) return false
  return !Number.isNaN(new Date(value).getTime())
}

/** Persiste o resultado do provedor na linha da tentativa (nunca cria cobrança nova). */
async function persistAttemptResult(rowId: string, mp: {
  providerPaymentId: string
  providerStatus: string
  externalReference: string | null
  qrCode: string | null
  qrCodeBase64: string | null
  ticketUrl: string | null
  expiresAt: string | null
  rawResponseMasked: Record<string, unknown>
}): Promise<MercadoPagoAttemptRow | null> {
  const hasQr = Boolean(mp.qrCode || mp.qrCodeBase64 || mp.ticketUrl)
  const { data } = await supabaseAdmin
    .from('premium_payments')
    .update({
      // QR disponível → cobrança apresentável: status: 'pending'.
      // Sem QR não há cobrança apresentável: permanece 'created' para que o retry
      // reuse ESTA tentativa (mesma chave) em vez de abrir outra Order.
      ...(hasQr ? { status: 'pending' } : { status: 'created' }),
      provider_payment_id: mp.providerPaymentId,
      provider_status: mp.providerStatus,
      external_reference: mp.externalReference,
      qr_code: mp.qrCode,
      qr_code_base64: mp.qrCodeBase64,
      ticket_url: mp.ticketUrl,
      // expires_at é timestamptz: só grava valor realmente parseável
      expires_at: isValidDate(mp.expiresAt) ? mp.expiresAt : null,
      raw_response_masked: mp.rawResponseMasked as unknown as Record<string, never>,
    })
    .eq('id', rowId)
    .select(MP_ATTEMPT_COLUMNS)
    .single()

  return (data as unknown as MercadoPagoAttemptRow | null) ?? null
}

/**
 * Recuperação: se o pedido já tem provider_order_id, consulta a Order no provedor
 * antes de abrir nova tentativa — evita criar uma segunda Order quando a primeira
 * existe (timeout, resposta perdida, retry após conflito de idempotência).
 */
async function recoverAttemptFromProviderOrder(
  orderId: string,
  attempt: MercadoPagoAttemptRow,
): Promise<MercadoPagoAttemptRow | null> {
  const { data: orderRow } = await supabaseAdmin
    .from('premium_orders')
    .select('provider_order_id')
    .eq('id', orderId)
    .maybeSingle()

  const providerOrderId = (orderRow as unknown as { provider_order_id?: string | null } | null)?.provider_order_id
  if (!providerOrderId) return null

  try {
    const mp = await mpGetOrder(providerOrderId)
    if (!mp.qrCode && !mp.qrCodeBase64 && !mp.ticketUrl) return null
    const persisted = await persistAttemptResult(attempt.id, {
      providerPaymentId: mp.providerPaymentId,
      providerStatus: mp.providerStatus,
      externalReference: mp.externalReference || orderId,
      qrCode: mp.qrCode,
      qrCodeBase64: mp.qrCodeBase64,
      ticketUrl: mp.ticketUrl,
      expiresAt: mp.expiresAt,
      rawResponseMasked: mp.rawResponseMasked,
    })
    return persisted
  } catch {
    // Order inexistente/inutilizável no provedor → segue para nova tentativa legítima.
    return null
  }
}

/** Executa UMA chamada ao provedor com a chave DA TENTATIVA e persiste o resultado. */
async function performMercadoPagoAttempt(params: {
  attempt: MercadoPagoAttemptRow
  orderId: string
  amountCents: number
  currency: string
  description: string
  opts?: { description?: string; payerEmail?: string; idempotencyKey?: string }
}): Promise<MercadoPagoAttemptRow> {
  const { attempt, orderId, amountCents, currency, description, opts } = params
  const attemptKey = attempt.pix_txid?.trim() || buildMercadoPagoAttemptKey(orderId, 1)

  try {
    const mp = await mpCreatePixPayment({
      orderId,
      amountCents,
      currency,
      description,
      payerEmail: opts?.payerEmail,
      // PIX-014.6: a chave do provedor é a DA TENTATIVA — nunca a chave do checkout.
      idempotencyKey: attemptKey,
    })

    // Rastreabilidade da Order do provedor (persistida como antes, só no sucesso)
    if (mp.providerOrderId) {
      await supabaseAdmin
        .from('premium_orders')
        .update({
          provider_order_id: mp.providerOrderId,
          provider_external_reference: mp.externalReference || orderId,
        })
        .eq('id', orderId)
    }

    const persisted = await persistAttemptResult(attempt.id, {
      providerPaymentId: mp.providerPaymentId,
      providerStatus: mp.providerStatus,
      externalReference: mp.externalReference || orderId,
      qrCode: mp.qrCode,
      qrCodeBase64: mp.qrCodeBase64,
      ticketUrl: mp.ticketUrl,
      expiresAt: mp.expiresAt,
      rawResponseMasked: mp.rawResponseMasked,
    })

    if (persisted) return persisted

    throw new Error('Falha ao persistir pagamento Mercado Pago')
  } catch (e) {
    const err = e as MercadoPagoError & { code?: string; status?: number; detail?: MercadoPagoErrorDetail }
    const detail = err?.detail

    // PIX-015 — o provedor pode ter CRIADO a Order/pagamento e só então falhar a
    // transação (HTTP 402 processing_error). Sem persistir esses ids, a Order ficava
    // invisível para nós (provider_order_id NULL) e a recuperação era impossível.
    if (detail?.providerOrderId) {
      try {
        await supabaseAdmin
          .from('premium_orders')
          .update({
            provider_order_id: detail.providerOrderId,
            provider_external_reference: orderId,
          })
          .eq('id', orderId)
      } catch {
        // melhor esforço: a falha original é o que importa
      }
    }
    if (detail?.providerPaymentId) {
      try {
        await supabaseAdmin
          .from('premium_payments')
          .update({ provider_payment_id: detail.providerPaymentId })
          .eq('id', attempt.id)
      } catch {
        // melhor esforço
      }
    }

    const marker = `error:${err?.status ?? 'unknown'}:${err?.code ?? 'UNKNOWN'}${detail?.statusDetail ? ':' + detail.statusDetail : ''}`
    const rawMasked = {
      error_code: err?.code ?? 'UNKNOWN',
      error_status: err?.status ?? null,
      provider_error_code: detail?.providerErrorCode ?? null,
      provider_error_message: detail?.providerMessage ?? null,
      status_detail: detail?.statusDetail ?? null,
      details: detail?.details ?? [],
      provider_order_id: detail?.providerOrderId ?? null,
      provider_payment_id: detail?.providerPaymentId ?? null,
    }
    if (isAttemptOutcomeUnknown(err)) {
      // Timeout / rede / 429 / 5xx: a Order pode existir no provedor.
      // A tentativa PERMANECE em voo (janela de 90s) e o retry usa a MESMA chave.
      await markAttemptUncertain(attempt.id, marker, rawMasked)
    } else {
      // Rejeição definitiva (inclusive 409 idempotency_key_already_used):
      // esta chave não deve ser reutilizada → a próxima tentativa recebe chave nova.
      await closeMercadoPagoAttempt(attempt.id, marker, rawMasked)
    }
    throw e
  }
}

/**
 * Resolve a tentativa a usar para este pedido, sem nunca criar cobrança duplicada:
 * reuso de QR, retry da tentativa em voo, recuperação de Order existente ou nova tentativa.
 */
async function resolveMercadoPagoAttempt(params: {
  orderId: string
  amountCents: number
  currency: string
  description: string
  opts?: { description?: string; payerEmail?: string; idempotencyKey?: string }
}): Promise<MercadoPagoAttemptRow> {
  const latest = await getLatestMercadoPagoAttempt(params.orderId)
  const state = classifyMercadoPagoAttempt(latest)

  if (latest && state === 'paid') return latest
  if (latest && state === 'usable_qr') return latest

  if (latest && state === 'in_flight') {
    // Timeout / resposta perdida / clique duplo: MESMA chave, mesma tentativa.
    return performMercadoPagoAttempt({ ...params, attempt: latest })
  }

  if (latest && (state === 'stale' || state === 'closed')) {
    const recovered = await recoverAttemptFromProviderOrder(params.orderId, latest)
    if (recovered) return recovered
    if (state === 'stale') {
      await closeMercadoPagoAttempt(latest.id, 'error:stale_attempt')
    }
  }

  const attemptNumber = (await countMercadoPagoAttempts(params.orderId)) + 1
  const attempt = await openMercadoPagoAttempt({
    orderId: params.orderId,
    attemptNumber,
    amountCents: params.amountCents,
    currency: params.currency,
  })

  // Corrida: a linha adotada pode já ter QR/confirmação da requisição vencedora.
  const adoptedState = classifyMercadoPagoAttempt(attempt)
  if (adoptedState === 'usable_qr' || adoptedState === 'paid') return attempt

  return performMercadoPagoAttempt({ ...params, attempt })
}

/**
 * Cria (ou retoma) a cobrança Pix real do pedido via Mercado Pago.
 *
 * - Valida dono do pedido (order_id + user_id)
 * - Valor e moeda vêm exclusivamente do pedido (nunca do frontend)
 * - external_reference = orderId (UUID)
 * - NÃO concede VIP e não altera a concessão de acesso
 *
 * PIX-014.6 — idempotência em duas camadas:
 *   nossa API: chave do checkout → premium_order (uma intenção de compra)
 *   provedor:  chave DA TENTATIVA (persistida) → uma Order por tentativa
 *
 * Retry da MESMA tentativa reutiliza a chave; tentativa encerrada sem cobrança
 * utilizável abre NOVA tentativa com NOVA chave. O conflito de idempotência do
 * provedor (409) tem recuperação única e limitada — nunca loop.
 */
export async function createMercadoPagoPixPaymentForOrder(
  orderId: string,
  userId: string,
  opts?: { description?: string; payerEmail?: string; idempotencyKey?: string },
): Promise<PremiumPayment> {
  if (!orderId || !userId) throw new Error('orderId e userId obrigatórios')

  const { data: order } = await supabaseAdmin
    .from('premium_orders')
    .select('id, user_id, amount_cents, currency, status, expires_at')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!order) throw orderNotOwnedError()

  const amountCents = (order as unknown as { amount_cents: number }).amount_cents
  const currency = (order as unknown as { currency: string }).currency || 'BRL'

  const description = opts?.description?.trim() || `VIP ${orderId.slice(0, 8)}`

  // PIX-014.5: Production nunca envia @testuser.com ao Mercado Pago (causa 402)
  const emailLower = opts?.payerEmail?.trim().toLowerCase() ?? ''
  if (process.env.VERCEL_ENV === 'production' && emailLower.endsWith('@testuser.com')) {
    const err = new Error('Usuário de teste não pode realizar pagamento em Production') as Error & { status?: number }
    err.status = 400
    throw err
  }

  const attemptParams = { orderId, amountCents, currency, description, opts }

  // Loop com recuperação ÚNICA para conflito de idempotência (nunca loop infinito).
  let conflictRecoveryUsed = false
  for (;;) {
    try {
      const attempt = await resolveMercadoPagoAttempt(attemptParams)
      return attempt as unknown as PremiumPayment
    } catch (e) {
      const err = e as MercadoPagoError & { code?: string }
      if (err?.code === 'MERCADOPAGO_IDEMPOTENCY_CONFLICT' && !conflictRecoveryUsed) {
        // A tentativa conflitante já foi encerrada em performMercadoPagoAttempt.
        // Na volta seguinte: recuperação por provider_order_id ou NOVA tentativa com NOVA chave.
        conflictRecoveryUsed = true
        continue
      }
      throw e
    }
  }
}
