// app/lib/payments/types.ts
// ALFA-014.1 — Domínio pagamentos (sem gateway real, sem cobrança Pix)
// Tabelas premium_plans (014.0) + premium_orders/payments/payment_events (014.1) — somente infra, sem VIP automático

/**
 * Plano comercial (futura tabela premium_plans)
 */
export interface PremiumPlan {
  id: string
  code: string // ex: vip_30_days
  name: string
  description?: string
  duration_days: number | null // null = vitalício
  price_cents: number // int, nunca float
  currency: string // BRL
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Pedido (tabela premium_orders) — idempotente por user+plan
 */
export type OrderStatus = 'draft' | 'pending' | 'awaiting_payment' | 'paid' | 'cancelled' | 'expired' | 'failed' | 'refunded' | 'chargeback'
export interface Order {
  id: string
  user_id: string
  plan_id: string
  status: OrderStatus
  amount_cents: number
  currency: string // BRL
  provider: string // ex: psp_mock
  provider_order_id: string | null
  expires_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

// ALFA-014.1 — PremiumOrder espelha premium_orders (com pix_txid/payload_hash)
export type PremiumOrderStatus = OrderStatus
export interface PremiumOrder {
  id: string
  user_id: string
  plan_id: string
  status: PremiumOrderStatus
  amount_cents: number
  currency: string // BRL, default
  pix_txid: string | null
  payload_hash: string | null
  expires_at: string | null
  paid_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export type PaymentProvider = 'mock' | 'efi' | 'pagarme' | 'gerencianet' | string

/**
 * Pagamento Pix (tabela premium_payments)
 */
export type PaymentStatus = 'pending' | 'awaiting_payment' | 'paid' | 'expired' | 'failed' | 'refunded'
// ALFA-014.1 statuses: created, pending, confirmed, failed, refunded, chargeback
export type PremiumPaymentStatus = 'created' | 'pending' | 'confirmed' | 'failed' | 'refunded' | 'chargeback' | PaymentStatus
export interface Payment {
  id: string
  order_id: string
  provider: string
  provider_payment_id: string | null
  status: PaymentStatus | PremiumPaymentStatus
  amount_cents: number
  currency: string // BRL
  pix_txid: string | null // idempotência
  qr_code_reference: string | null // referência, não QR real
  payload_hash: string | null
  paid_at: string | null
  raw_response_masked?: Record<string, unknown> // sempre mascarado, nunca raw completo
  created_at: string
  updated_at: string
}

export interface PremiumPayment {
  id: string
  order_id: string
  provider: PaymentProvider
  provider_payment_id: string | null
  pix_txid: string | null
  status: PremiumPaymentStatus
  amount_cents: number
  currency: string
  payload_hash: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Evento de pagamento (tabela payment_events) — auditoria idempotente
 */
export type PaymentEventType = 'created' | 'pix_generated' | 'paid' | 'expired' | 'failed' | 'refunded' | 'chargeback'
export interface PaymentEvent {
  id: string
  provider: PaymentProvider
  event_id: string // idempotência provider
  event_type: PaymentEventType
  order_id: string | null
  payment_id: string | null
  payload_hash: string // sha256 do payload para replay protection
  received_at: string
  processed_at: string | null
  processing_status: 'pending' | 'processed' | 'failed' | 'ignored'
  payload_json?: Record<string, unknown> | null // mascarado, nunca retornar por padrão ao frontend
  error_message?: string | null
}

// Máquina de estados documentada (sem execução nesta sprint)
// draft → pending → awaiting_payment → paid → grant_issued
// Exceções: cancelled, expired, failed, refunded, chargeback
// Transições válidas controladas por service_role após validação de assinatura webhook

// ============================================
// ALFA-014.3 — DTO seguro e projeções públicas
// ============================================
// Regras:
// - payload_hash NUNCA entra em lista de SELECT pública (nem em resposta HTTP)
// - user_id nunca é exposto no DTO
// - status terminais (failed/refunded/chargeback) nunca são apresentados como ativos

/** Status seguros de pagamento exibíveis (subset de PremiumPaymentStatus) */
export type SafePaymentStatus = 'created' | 'pending' | 'confirmed' | 'failed' | 'refunded' | 'chargeback'

/** Status terminais — nunca apresentados como pagamento ativo */
export const TERMINAL_PAYMENT_STATUSES = ['failed', 'refunded', 'chargeback'] as const

/** Projeção pública de premium_orders (sem payload_hash) */
export const ORDER_PUBLIC_COLUMNS =
  'id, user_id, plan_id, status, amount_cents, currency, pix_txid, expires_at, paid_at, cancelled_at, created_at, updated_at' as const

/** Projeção pública de premium_payments (sem payload_hash) */
export const PAYMENT_PUBLIC_COLUMNS =
  'id, order_id, provider, provider_payment_id, pix_txid, status, amount_cents, currency, paid_at, created_at, updated_at' as const

/** DTO de pedido — allow-list positiva, sem user_id e sem payload_hash */
export interface OrderDTO {
  id: string
  planCode: string
  status: string
  amountCents: number
  currency: string
  expiresAt: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

/** DTO de pagamento — allow-list positiva */
export interface PaymentDTO {
  id: string
  provider: string
  status: string
  pixTxid: string | null
  amountCents: number
  currency: string
}

/** Retorno do GET /api/payments/orders/:id (payment=null para pedido sem pagamento de teste) */
export interface OrderDetailsDTO {
  order: OrderDTO
  payment: PaymentDTO | null
}
