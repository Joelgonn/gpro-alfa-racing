// app/api/payments/orders/route.ts
// ALFA-014.2 — Criação controlada de pedidos com Idempotency-Key (sem Pix real, sem grant)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { createOrderFromPlanCode } from '@/app/lib/payments/orderService'
import { createTestPaymentForOrder } from '@/app/lib/payments/paymentService'

export async function POST(request: NextRequest) {
  try {
    // Autenticação obrigatória — user_id exclusivamente da sessão
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
    }
    const userId = user.id

    // Validar body JSON
    let body: any
    try {
      const text = await request.text()
      if (!text || !text.trim()) return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
      body = JSON.parse(text)
    } catch {
      return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
    }

    // Rejeitar campos inesperados se enviados (ignorar de forma segura, mas se forem sensíveis, não usar)
    // Apenas planCode é permitido como identificador lógico
    const planCode = body.planCode
    if (planCode === undefined || planCode === null) {
      return NextResponse.json({ success: false, error: 'planCode obrigatório' }, { status: 400 })
    }

    // Validar Idempotency-Key header
    const idempotencyKey = request.headers.get('Idempotency-Key') || request.headers.get('idempotency-key')
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      return NextResponse.json({ success: false, error: 'Idempotency-Key ausente ou inválida' }, { status: 400 })
    }

    // Criar pedido idempotente (captura preço do banco, nunca do frontend)
    let result: { order: any; idempotent: boolean }
    try {
      result = await createOrderFromPlanCode({ userId, planCode, idempotencyKey })
    } catch (e: any) {
      const status = e.status || (e.message?.includes('não encontrado') ? 404 : e.message?.includes('inativo') ? 409 : e.message?.includes('Idempotency-Key') ? 409 : e.message?.includes('planCode') ? 400 : 400)
      return NextResponse.json({ success: false, error: e.message }, { status })
    }

    // Criar pagamento de teste associado (provider test, status created, TEST-ALFA-0141-)
    let payment: any = null
    try {
      payment = await createTestPaymentForOrder(result.order.id, userId)
    } catch (e: any) {
      // Falha ao criar pagamento não deve falhar pedido — log e continua
      console.error('Falha ao criar pagamento de teste', e.message?.slice(0, 80))
    }

    // Resposta segura — nunca retorna payload_json, service_role, tokens, pix_txid real
    const orderSafe = {
      id: result.order.id,
      planCode,
      status: result.order.status,
      amountCents: result.order.amount_cents,
      currency: result.order.currency,
      expiresAt: result.order.expires_at,
      createdAt: result.order.created_at,
    }
    const paymentSafe = payment ? {
      id: payment.id,
      status: payment.status,
      provider: payment.provider,
    } : null

    const statusCode = result.idempotent ? 200 : 201
    return NextResponse.json({ order: orderSafe, payment: paymentSafe, idempotent: result.idempotent }, { status: statusCode })

  } catch (error: any) {
    console.error('POST /api/payments/orders error', error.message?.slice(0, 80))
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use POST.' }, { status: 405 })
}
export async function PUT() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
export async function PATCH() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
export async function DELETE() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
