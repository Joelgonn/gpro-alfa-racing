// app/api/payments/orders/[id]/route.ts
// ALFA-014.3 — Consulta segura de pedido (SOMENTE LEITURA, sem Pix real)
//
// Garantias deste handler:
// - exige sessão autenticada (401) e valida UUID (400)
// - userId vem EXCLUSIVAMENTE de supabase.auth.getUser() — nunca de body, query ou header
// - query string e body são IGNORADOS: nenhum parâmetro do cliente é lido
// - pedido inexistente e pedido de terceiro devolvem o MESMO 404 (não vaza existência)
// - NUNCA cria/atualiza/apaga nada: nenhuma escrita em banco neste caminho
// - DTO montado por allow-list positiva (nenhum campo sensível é incluído)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrderDetailsForUser } from '@/app/lib/payments/orderService'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

// Diagnóstico de exceção: só código/nome/mensagem, sanitizados e truncados.
// Nada de token, chave, JWT, URL de conexão ou payload — e nunca vai para a resposta.
function describeError(error: unknown): string {
  const e = (error || {}) as { code?: unknown; name?: unknown; message?: unknown }
  const raw = `${String(e.code ?? '-')}|${String(e.name ?? 'Error')}|${String(e.message ?? '')}`
  return raw
    .replace(/eyJ[A-Za-z0-9._-]{10,}/g, '[jwt]')
    .replace(/(apikey|api_key|password|secret|token|authorization)\s*[:=]\s*\S+/gi, '$1=[redigido]')
    .replace(/\bpostgres(ql)?:\/\/\S+/gi, '[conn]')
    .replace(/\s+/g, ' ')
    .slice(0, 160)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
    }
    const userId = user.id

    const { id } = await params
    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // `request` não é lido de propósito: ?userId=, ?status=, ?pixTxid= e qualquer body são ignorados.
    // O escopo é exclusivamente (id do path + userId da sessão).

    const details = await getOrderDetailsForUser(id, userId)
    if (!details) {
      // 404 idêntico para pedido inexistente e para pedido de terceiro (não vaza existência)
      return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 })
    }

    // DTO já vem montado por allow-list positiva no serviço:
    // order = { id, planCode, status, amountCents, currency, expiresAt, paidAt, createdAt, updatedAt }
    // payment = { id, provider, status, pixTxid, amountCents, currency } | null

    // PIX-009: quando PIX_ENABLED=true, anexa QR real do Mercado Pago (se existir)
    // Nunca retorna payload_json, nunca expõe token
    let pizzData: { qrCode: string | null; qrCodeBase64: string | null; ticketUrl: string | null } | null = null
    if (process.env.PIX_ENABLED === 'true') {
      const { data: mpPay } = await supabaseAdmin
        .from('premium_payments')
        .select('qr_code, qr_code_base64, ticket_url, provider, provider_payment_id')
        .eq('order_id', id)
        .eq('provider', 'mercadopago')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (mpPay) {
        const row = mpPay as unknown as { qr_code: string | null; qr_code_base64: string | null; ticket_url: string | null }
        if (row.qr_code || row.qr_code_base64 || row.ticket_url) {
          pizzData = { qrCode: row.qr_code, qrCodeBase64: row.qr_code_base64, ticketUrl: row.ticket_url }
        }
      }
    }

    if (pizzData) {
      return NextResponse.json({
        order: details.order,
        payment: details.payment,
        pizzData,
      })
    }
    return NextResponse.json({
      order: details.order,
      payment: details.payment,
    })

  } catch (error: unknown) {
    // Falha de infraestrutura (ex.: PGRST205 tabela ausente) NÃO é mascarada como 404.
    console.error('GET /api/payments/orders/[id] falhou', describeError(error))
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST() { return NextResponse.json({ success: false, error: 'Método não permitido. Use GET.' }, { status: 405 }) }
export async function PUT() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
export async function PATCH() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
export async function DELETE() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
