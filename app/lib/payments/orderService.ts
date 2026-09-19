// app/lib/payments/orderService.ts
// ALFA-014.2 — Serviço de pedidos com Idempotency-Key (sem VIP, sem Pix real)

import 'server-only'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import type { PremiumOrder, PaymentDTO, OrderDetailsDTO } from './types'
import { canTransitionOrder } from './paymentStateMachine'
import { PAYMENT_PUBLIC_COLUMNS, TERMINAL_PAYMENT_STATUSES } from './types'

// Cria pedido idempotente: captura preço vigente de premium_plans no backend, nunca do frontend
export async function createOrderIdempotent(params: {
  userId: string
  planId: string
}): Promise<PremiumOrder> {
  const { userId, planId } = params
  if (!userId || !planId) throw new Error('userId e planId obrigatórios')

  // Idempotência: se já existe pending/awaiting_payment para mesmo user+plan, retorna existente
  const { data: existing } = await supabaseAdmin
    .from('premium_orders')
    .select('id, user_id, plan_id, status, amount_cents, currency, pix_txid, payload_hash, expires_at, paid_at, cancelled_at, created_at, updated_at')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .in('status', ['pending', 'awaiting_payment', 'draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return existing as unknown as PremiumOrder

  // Captura preço vigente do plano (nunca do frontend)
  const { data: plan, error: planErr } = await supabaseAdmin
    .from('premium_plans')
    .select('id, price_cents, currency, is_active')
    .eq('id', planId)
    .eq('is_active', true)
    .single()

  if (planErr || !plan) throw new Error('Plano não encontrado ou inativo')

  const amount_cents = (plan as any).price_cents as number
  const currency = (plan as any).currency as string

  const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min para pagar (exemplo)

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('premium_orders')
    .insert({
      user_id: userId,
      plan_id: planId,
      status: 'pending',
      amount_cents,
      currency,
      expires_at,
    })
    .select('id, user_id, plan_id, status, amount_cents, currency, pix_txid, payload_hash, expires_at, paid_at, cancelled_at, created_at, updated_at')
    .single()

  if (insErr || !inserted) throw new Error(insErr?.message || 'Falha ao criar pedido')

  return inserted as unknown as PremiumOrder
}

export async function getOrderForUser(orderId: string, userId: string): Promise<PremiumOrder | null> {
  const { data, error } = await supabaseAdmin
    .from('premium_orders')
    .select('id, user_id, plan_id, status, amount_cents, currency, pix_txid, payload_hash, expires_at, paid_at, cancelled_at, created_at, updated_at')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as PremiumOrder) || null
}

export async function transitionOrderStatus(orderId: string, toStatus: string, userId: string): Promise<PremiumOrder> {
  if (!orderId || !userId || !toStatus) throw new Error('orderId, toStatus e userId obrigatórios')
  const { data: order } = await supabaseAdmin.from('premium_orders').select('status, user_id').eq('id', orderId).eq('user_id', userId).single()
  if (!order) throw new Error('Pedido não encontrado')
  if ((order as any).user_id !== userId) throw new Error('Acesso negado')
  if (!canTransitionOrder((order as any).status, toStatus)) throw new Error(`Transição inválida ${(order as any).status} -> ${toStatus}`)
  const updates: any = { status: toStatus }
  if (toStatus === 'paid') updates.paid_at = new Date().toISOString()
  if (toStatus === 'cancelled') updates.cancelled_at = new Date().toISOString()
  const { data, error } = await supabaseAdmin.from('premium_orders').update(updates).eq('id', orderId).eq('user_id', userId).select('*').single()
  if (error) throw new Error(error.message)
  return data as unknown as PremiumOrder
}

// ALFA-014.2 — Helpers para POST /api/payments/orders

export function normalizeIdempotencyKey(raw: string | null): string {
  if (!raw || typeof raw !== 'string') throw new Error('Idempotency-Key ausente')
  const trimmed = raw.trim()
  if (trimmed.length < 8) throw new Error('Idempotency-Key muito curta')
  if (trimmed.length > 128) throw new Error('Idempotency-Key muito longa')
  if (!trimmed.startsWith('TEST-ALFA-0141-')) throw new Error('Idempotency-Key deve começar com TEST-ALFA-0141-')
  return trimmed
}

export function normalizePlanCode(raw: any): string {
  if (typeof raw !== 'string') throw new Error('planCode deve ser string')
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('planCode obrigatório')
  if (trimmed.length > 64) throw new Error('planCode muito longo')
  return trimmed
}

export function calculateOrderPayloadHash(userId: string, idempotencyKey: string): string {
  // Hash apenas de userId + Idempotency-Key para detectar mesmo key com payload diferente (planCode)
  const normalized = `${userId}|${idempotencyKey}`
  return createHash('sha256').update(normalized).digest('hex')
}

export async function findIdempotentOrder(userId: string, payloadHash: string): Promise<PremiumOrder | null> {
  const { data, error } = await supabaseAdmin
    .from('premium_orders')
    .select('id, user_id, plan_id, status, amount_cents, currency, pix_txid, payload_hash, expires_at, paid_at, cancelled_at, created_at, updated_at')
    .eq('user_id', userId)
    .eq('payload_hash', payloadHash)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as PremiumOrder) || null
}

export async function createOrderFromPlanCode(params: {
  userId: string
  planCode: string
  idempotencyKey: string
}): Promise<{ order: PremiumOrder; idempotent: boolean }> {
  const { userId, planCode: rawCode, idempotencyKey: rawKey } = params
  const planCode = normalizePlanCode(rawCode)
  const idempotencyKey = normalizeIdempotencyKey(rawKey)
  const payloadHash = calculateOrderPayloadHash(userId, idempotencyKey)

  // Verificar idempotência por payload_hash + user_id (hash de user+key, sem planCode para detectar 409)
  const existing = await findIdempotentOrder(userId, payloadHash)
  if (existing) {
    // Detectar mesma Idempotency-Key com payload diferente (planCode diferente) → 409
    const { data: planFor409 } = await supabaseAdmin.from('premium_plans').select('id').eq('code', planCode).maybeSingle();
    if (planFor409 && (existing as any).plan_id !== (planFor409 as any).id) {
      const err: any = new Error('Idempotency-Key já usada com payload diferente');
      err.status = 409;
      throw err;
    }
    return { order: existing, idempotent: true }
  }

  // Verificar se mesma Idempotency-Key foi usada com payload diferente para mesmo usuário
  // Como não armazenamos key separada, não podemos detectar; então seguimos para criação
  // Buscar plano ativo por code (não por id arbitrário)
  const { data: plan, error: planErr } = await supabaseAdmin
    .from('premium_plans')
    .select('id, code, price_cents, currency, is_active')
    .eq('code', planCode)
    .single()
  if (planErr || !plan) {
    const err: any = new Error('Plano não encontrado')
    err.status = 404
    throw err
  }
  if (!(plan as any).is_active) {
    const err: any = new Error('Plano inativo')
    err.status = 409
    throw err
  }

  const amount_cents = (plan as any).price_cents
  const currency = (plan as any).currency || 'BRL'
  const planId = (plan as any).id
  const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  // Tentar inserir com payload_hash para idempotência
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('premium_orders')
    .insert({
      user_id: userId,
      plan_id: planId,
      status: 'pending',
      amount_cents,
      currency,
      payload_hash: payloadHash,
      expires_at,
    })
    .select('id, user_id, plan_id, status, amount_cents, currency, pix_txid, payload_hash, expires_at, paid_at, cancelled_at, created_at, updated_at')
    .single()

  if (insErr) {
    // Concorrência: verifica se outro processo criou com mesmo payload_hash
    if ((insErr as any).code === '23505') {
      const retry = await findIdempotentOrder(userId, payloadHash)
      if (retry) return { order: retry, idempotent: true }
    }
    throw new Error(insErr.message)
  }

  // Conflito de payload diferente com mesma key não detectável sem coluna key separada — documentado
  return { order: inserted as unknown as PremiumOrder, idempotent: false }
}

export async function getSafeOrderForUser(orderId: string, userId: string): Promise<PremiumOrder | null> {
  return getOrderForUser(orderId, userId)
}

// ALFA-014.3 — Leitura escopada do pagamento de teste de um pedido JÁ autorizado.
// Escopo simultâneo obrigatório: order_id + dono do pedido (premium_orders.user_id) + provider='test'.
// Status terminais (failed/refunded/chargeback) nunca são apresentados como pagamento ativo.
// Somente leitura: nunca cria, nunca atualiza, nunca apaga.
// PIX-009: também cobre provider='mercadopago' quando PIX_ENABLED=true (polling QR real)
export async function getSafePaymentForOrder(orderId: string, userId: string): Promise<PaymentDTO | null> {
  if (!orderId || !userId) return null

  // Quando PIX_ENABLED=true, prioriza mercadopago; caso contrário, test
  const pixEnabled = process.env.PIX_ENABLED === 'true'
  const providers = pixEnabled ? ['mercadopago', 'test'] : ['test']

  const { data } = await supabaseAdmin
    .from('premium_payments')
    .select(`${PAYMENT_PUBLIC_COLUMNS}, premium_orders!inner(id, user_id)`)
    .eq('order_id', orderId)
    .in('provider', providers)
    .eq('premium_orders.user_id', userId)
    .neq('status', TERMINAL_PAYMENT_STATUSES[0])
    .neq('status', TERMINAL_PAYMENT_STATUSES[1])
    .neq('status', TERMINAL_PAYMENT_STATUSES[2])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const payment = data as any
  // Defesa em profundidade: nunca devolver pagamento cujo pedido não é do usuário
  if (payment.premium_orders?.user_id !== userId) return null
  if (TERMINAL_PAYMENT_STATUSES.includes(payment.status)) return null

  return {
    id: payment.id,
    provider: payment.provider,
    status: payment.status,
    pixTxid: payment.pix_txid,
    amountCents: payment.amount_cents,
    currency: payment.currency,
  }
}

// PIX-009: leitura específica para Mercado Pago (usada pelo polling quando necessário)
export async function getMercadoPagoPaymentForOrder(orderId: string, userId: string): Promise<PaymentDTO | null> {
  if (!orderId || !userId) return null
  const { data } = await supabaseAdmin
    .from('premium_payments')
    .select(`${PAYMENT_PUBLIC_COLUMNS}, premium_orders!inner(id, user_id)`)
    .eq('order_id', orderId)
    .eq('provider', 'mercadopago')
    .eq('premium_orders.user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const p = data as any
  if (p.premium_orders?.user_id !== userId) return null
  return {
    id: p.id,
    provider: p.provider,
    status: p.status,
    pixTxid: p.pix_txid,
    amountCents: p.amount_cents,
    currency: p.currency,
  }
}

/**
 * ALFA-014.3 — Detalhes seguros de um pedido do usuário autenticado.
 * ESTRITAMENTE SOMENTE LEITURA: nunca cria pagamento, nunca altera banco.
 * `userId` é OBRIGATÓRIO e vem exclusivamente da sessão autenticada.
 * Pedido inexistente e pedido de terceiro produzem exatamente o mesmo resultado (null → 404).
 * Retorna DTO por allow-list positiva: sem user_id, sem payload_hash, sem payload_json.
 */
export async function getOrderDetailsForUser(orderId: string, userId: string): Promise<OrderDetailsDTO | null> {
  // Sem escopo completo não há consulta
  if (!orderId || !userId) return null

  // Isolamento: sempre order_id + user_id (pedido de terceiro é indistinguível de inexistente)
  const order = await getOrderForUser(orderId, userId)
  if (!order) return null

  // planCode seguro: vem do plano associado ao pedido autorizado, nunca do frontend
  const { data: plan } = await supabaseAdmin
    .from('premium_plans')
    .select('code')
    .eq('id', (order as any).plan_id)
    .maybeSingle()
  const planCode = (plan as any)?.code as string | undefined
  if (!planCode) return null

  // Pagamento associado: filtrado pelo pedido autorizado, provider=test, sem status terminais.
  // Nenhuma escrita acontece aqui — pedido legado sem pagamento devolve payment: null.
  const payment = await getSafePaymentForOrder(orderId, userId)

  return {
    order: {
      id: order.id,
      planCode,
      status: order.status,
      amountCents: order.amount_cents,
      currency: order.currency,
      expiresAt: order.expires_at,
      paidAt: order.paid_at,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    },
    payment,
  }
}
