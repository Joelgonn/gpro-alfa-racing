// app/lib/payments/paymentStateMachine.ts
// ALFA-014.1 — Máquina de estados para orders e payments (sem gateway, sem VIP)

import type { OrderStatus, PremiumOrderStatus, PremiumPaymentStatus } from './types'

// Transições válidas para premium_orders
const ORDER_TRANSITIONS: Record<PremiumOrderStatus, PremiumOrderStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['awaiting_payment', 'cancelled', 'expired', 'failed'],
  awaiting_payment: ['paid', 'cancelled', 'expired', 'failed'],
  paid: ['refunded', 'chargeback'],
  cancelled: [],
  expired: [],
  failed: [],
  refunded: [],
  chargeback: [],
}

// Transições para premium_payments
const PAYMENT_TRANSITIONS: Record<PremiumPaymentStatus, PremiumPaymentStatus[]> = {
  created: ['pending', 'failed'],
  pending: ['confirmed', 'failed', 'refunded', 'chargeback'],
  confirmed: ['refunded', 'chargeback'],
  failed: [],
  refunded: [],
  chargeback: [],
  // compat com PaymentStatus legado
  awaiting_payment: ['paid', 'expired', 'failed'] as any,
  paid: ['refunded'] as any,
  expired: [] as any,
}

export function canTransitionOrder(from: string, to: string): boolean {
  const allowed = ORDER_TRANSITIONS[from as PremiumOrderStatus] || []
  return allowed.includes(to as PremiumOrderStatus)
}

export function canTransitionPayment(from: string, to: string): boolean {
  const allowed = PAYMENT_TRANSITIONS[from as PremiumPaymentStatus] || []
  return allowed.includes(to as PremiumPaymentStatus)
}

export function assertCanTransitionOrder(from: string, to: string): void {
  if (!canTransitionOrder(from, to)) {
    const err: any = new Error(`Transição inválida order ${from} -> ${to}`)
    err.code = 'INVALID_TRANSITION'
    throw err
  }
}

export function assertCanTransitionPayment(from: string, to: string): void {
  if (!canTransitionPayment(from, to)) {
    const err: any = new Error(`Transição inválida payment ${from} -> ${to}`)
    err.code = 'INVALID_TRANSITION'
    throw err
  }
}

// Relação grant: só após paid confirmado, via service_role, nunca frontend
export const GRANT_ISSUED_AFTER: OrderStatus[] = ['paid']
