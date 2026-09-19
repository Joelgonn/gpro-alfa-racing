// app/api/payments/orders/route.ts
// ALFA-014.2 — Criação controlada de pedidos com Idempotency-Key (sem Pix real, sem grant)
// PIX-009 — Integração checkout real Mercado Pago (condicional por PIX_ENABLED)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { createOrderFromPlanCode } from '@/app/lib/payments/orderService'
import { createTestPaymentForOrder, createMercadoPagoPixPaymentForOrder, hasUsableMercadoPagoPayment } from '@/app/lib/payments/paymentService'
import { MercadoPagoError } from '@/app/lib/payments/mercadopago-client'

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

    // Impedir pedido expirado.
    // PIX-014.6: a exceção é ter ainda uma cobrança Pix VÁLIDA para o pedido — nesse
    // caso o usuário recebe de volta o MESMO QR (sem nova Order, sem cobrança nova).
    // Depois da Parte B, "expirado sem cobrança utilizável" já chega aqui como pedido
    // novo (createOrderFromPlanCode substitui o pedido); este bloqueio é a rede de segurança.
    if (result.order.expires_at && new Date(result.order.expires_at).getTime() < Date.now()) {
      const stillPayable = await hasUsableMercadoPagoPayment(result.order.id)
      if (!stillPayable) {
        return NextResponse.json({ success: false, error: 'Pedido expirado' }, { status: 409 })
      }
    }

    const pixEnabled = process.env.PIX_ENABLED === 'true'

    // PIX_ENABLED=false → fluxo teste (não chama Mercado Pago)
    // PIX_ENABLED=true → fluxo real, sem fallback silencioso para test
    let payment: any = null
    let pizzData: { qrCode: string | null; qrCodeBase64: string | null; ticketUrl: string | null } | null = null

    if (!pixEnabled) {
      try {
        payment = await createTestPaymentForOrder(result.order.id, userId)
      } catch (e: unknown) {
        const msg = (e as Error)?.message?.slice(0, 80) || 'Falha ao criar pagamento de teste'
        console.error('Falha ao criar pagamento de teste', msg)
      }
    } else {
      // Fluxo real — exige configuração Mercado Pago
      // PIX-014.5: Production bloqueia @testuser.com antes de chamar MP
      const payerEmailRaw = (user as unknown as { email?: string })?.email?.trim() ?? ''
      if (process.env.VERCEL_ENV === 'production' && payerEmailRaw.toLowerCase().endsWith('@testuser.com')) {
        return NextResponse.json({ success: false, error: 'Usuário de teste não pode realizar pagamento em Production' }, { status: 400 })
      }
      try {
        payment = await createMercadoPagoPixPaymentForOrder(result.order.id, userId, {
          description: `VIP ${planCode}`,
          idempotencyKey,
          payerEmail: payerEmailRaw || undefined,
        })

        // Validar resposta antes de expor — já validado no client, mas checa consistência adicional
        if (!payment || !payment.id) {
          throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'Resposta sem ID')
        }
        // Moeda e valor já validados no client contra o pedido; reconfirma que amount bate
        if (typeof payment.amount_cents === 'number' && payment.amount_cents !== result.order.amount_cents) {
          console.error('Divergencia de valor MP vs pedido', { orderId: result.order.id.slice(0, 8) + '***' })
          return NextResponse.json({ success: false, error: 'Falha ao criar cobrança' }, { status: 503 })
        }

        pizzData = {
          qrCode: (payment as unknown as { qr_code?: string | null }).qr_code ?? null,
          qrCodeBase64: (payment as unknown as { qr_code_base64?: string | null }).qr_code_base64 ?? null,
          ticketUrl: (payment as unknown as { ticket_url?: string | null }).ticket_url ?? null,
        }
      } catch (e: unknown) {
        const err = e as MercadoPagoError & { code?: string; status?: number }
        if (err?.code === 'MERCADOPAGO_CONFIG_MISSING') {
          return NextResponse.json({ success: false, error: 'Serviço de pagamento indisponível' }, { status: 503 })
        }
        // Sanitiza sem truncar em 80 — preserva code/message/cause do MP para diagnóstico (até ~300)
        const rawSafe = String(err?.message || 'Falha ao criar cobrança').replace(/(apikey|token|secret|authorization)\s*[:=]\s*\S+/gi, '$1=[redigido]').replace(/(eyJ[A-Za-z0-9._-]{10,})/g, '[jwt]').slice(0, 300)
        console.error(`Falha ao criar pagamento Mercado Pago status=${err?.status ?? 'unknown'} ${rawSafe}`)
        return NextResponse.json({ success: false, error: 'Falha ao criar cobrança' }, { status: 503 })
      }
    }

    // Resposta segura — nunca retorna payload_json, service_role, tokens
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
      providerPaymentId: (payment as unknown as { provider_payment_id?: string }).provider_payment_id ?? null,
    } : null

    const statusCode = result.idempotent ? 200 : 201
    // Quando PIX_ENABLED=true, retorna QR somente se existir e for seguro
    if (pixEnabled && pizzData) {
      return NextResponse.json({ order: orderSafe, payment: paymentSafe, pizzData, idempotent: result.idempotent }, { status: statusCode })
    }
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
