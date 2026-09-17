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
