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
export async function createPaymentForOrder(params: {
  orderId: string
  provider?: string
}): Promise<PremiumPayment> {
  const { orderId, provider = 'mock' } = params
  if (!orderId) throw new Error('orderId obrigatório')

  // Verificar pedido existe e capturar amount
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('premium_orders')
    .select('id, user_id, amount_cents, currency, status')
    .eq('id', orderId)
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
// PIX-008 — Integração preparatória Mercado Pago (AINDA NÃO ATIVA)
// ---------------------------------------------------------------------------
// As funções abaixo preparam a persistência real sem ativar PIX.
// PIX_ENABLED permanece false nesta sprint; nenhuma rota as chama automaticamente.
// Quando PIX_ENABLED=true em Preview, a rota /api/payments/orders poderá
// chamar createMercadoPagoPixPaymentForOrder de forma controlada.
// Erro de configuração (MERCADOPAGO_CONFIG_MISSING) NÃO faz fallback para provider=test.

import { createPixPayment as mpCreatePixPayment, getMercadoPagoPayment as mpGetPayment } from './mercadopago-client'

export async function fetchMercadoPagoPayment(paymentId: string) {
  return mpGetPayment(paymentId)
}

/**
 * Cria pagamento Pix real via Mercado Pago e persiste em premium_payments.
 * - Valida dono do pedido (order_id + user_id)
 * - Reusa pagamento existente com qr_code (idempotência por order_id)
 * - Valor e moeda vêm exclusivamente do pedido (nunca do frontend)
 * - external_reference = orderId (UUID)
 * - NÃO concede VIP, NÃO altera access_grants
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

  // Reuso: se já existe pagamento mercadopago com qr_code, retorna
  const { data: existingMp } = await supabaseAdmin
    .from('premium_payments')
    .select(PAYMENT_PUBLIC_COLUMNS + ', qr_code, qr_code_base64, ticket_url, provider_status, external_reference, expires_at')
    .eq('order_id', orderId)
    .eq('provider', 'mercadopago')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingMp && (existingMp as unknown as { qr_code: string | null }).qr_code) {
    return existingMp as unknown as PremiumPayment
  }

  const description = opts?.description?.trim() || `VIP ${orderId.slice(0, 8)}`

  const mp = await mpCreatePixPayment({
    orderId,
    amountCents,
    currency,
    description,
    payerEmail: opts?.payerEmail,
    idempotencyKey: opts?.idempotencyKey || orderId,
  })

  // Persiste provider_order_id em premium_orders (coluna 20250919000001) para rastreabilidade da Order MP
  if ((mp as unknown as { providerOrderId?: string | null }).providerOrderId) {
    await supabaseAdmin
      .from('premium_orders')
      .update({
        provider_order_id: (mp as unknown as { providerOrderId: string }).providerOrderId,
        provider_external_reference: mp.externalReference || orderId,
      })
      .eq('id', orderId)
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('premium_payments')
    .insert({
      order_id: orderId,
      provider: 'mercadopago',
      provider_payment_id: mp.providerPaymentId,
      provider_status: mp.providerStatus,
      external_reference: mp.externalReference || orderId,
      status: 'pending',
      amount_cents: amountCents,
      currency,
      qr_code: mp.qrCode,
      qr_code_base64: mp.qrCodeBase64,
      ticket_url: mp.ticketUrl,
      expires_at: mp.expiresAt,
      raw_response_masked: mp.rawResponseMasked as unknown as Record<string, never>,
    })
    .select(PAYMENT_PUBLIC_COLUMNS + ', qr_code, qr_code_base64, ticket_url, provider_status, external_reference, expires_at')
    .single()

  if (insErr || !inserted) {
    if ((insErr as unknown as { code?: string })?.code === '23505') {
      const { data: raced } = await supabaseAdmin
        .from('premium_payments')
        .select(PAYMENT_PUBLIC_COLUMNS)
        .eq('order_id', orderId)
        .eq('provider', 'mercadopago')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (raced) return raced as unknown as PremiumPayment
    }
    throw new Error(insErr?.message || 'Falha ao persistir pagamento Mercado Pago')
  }

  return inserted as unknown as PremiumPayment
}
