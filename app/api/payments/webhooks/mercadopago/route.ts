// app/api/payments/webhooks/mercadopago/route.ts
// PIX-001.1 — Webhook do Mercado Pago (INFRAESTRUTURA, sem ativação financeira)
//
// Garantias desta sprint:
// - aceita SOMENTE POST (demais verbos → 405)
// - responde RÁPIDO (nada de trabalho pesado no caminho crítico)
// - valida Content-Type quando o corpo é enviado como JSON
// - limita o tamanho do corpo (proteção contra payload gigante)
// - EXIGE assinatura válida (fail-closed por padrão, sem flag de ambiente)
// - registra o evento de forma idempotente em payment_events (sem PII em claro)
// - NÃO confia no payload para decidir nada
// - NÃO chama o Mercado Pago (contrato não capturado)
// - NÃO altera premium_payments / premium_orders
// - NÃO concede VIP
// - NÃO expõe Access Token nem qualquer credencial
//
// Resposta: sempre 200 com corpo mínimo, EXCETO quando o pedido é inválido
// (405/415/400) ou quando a assinatura não é verificada (401). Motivo de responder
// 200 mesmo em erro interno: evitar que o provedor entre em retry infinito. Falhas
// ficam registradas para reconciliação.

import { NextRequest, NextResponse } from 'next/server'
import { accessLogger, nextCorrelationId } from '@/app/lib/access/accessLogger'
import {
  readSignatureHeaders,
  verifySignature,
  extractDataId,
  SIGNATURE_TEMPLATE_ENV,
  SIGNATURE_SECRET_ENV,
} from '@/app/lib/payments/mercadopago-signature'
import { processWebhookEvent } from '@/app/lib/payments/webhook-service'

// O webhook não pode usar cache nem página estática
// Nota Vercel: Preview deployments são protegidos por Vercel Authentication (SSO) por padrão.
// Para o Mercado Pago alcançar este endpoint, o Preview deve ser exposto via
// Deployment Protection Exceptions (ex: preview-*.vercel.app) ou via
// Protection Bypass for Automation (?x-vercel-protection-bypass=SECRET).
// Este código NÃO desativa a validação de assinatura do Mercado Pago (fail-closed).
export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_BODY_BYTES = 256 * 1024 // 256 KB — payloads de notificação são pequenos

export async function POST(request: NextRequest) {
  const correlationId = nextCorrelationId()
  const t0 = Date.now()

  // ---- 1. Content-Type (quando há corpo) -----------------------------------
  const contentType = request.headers.get('content-type') || ''
  const rawBody = await request.text().catch(() => '')

  if (rawBody.length > MAX_BODY_BYTES) {
    accessLogger.warn('pix.webhook.rejected', {
      correlationId,
      result: 'payload_too_large',
      durationMs: Date.now() - t0,
    })
    return NextResponse.json({ received: false, reason: 'payload_too_large' }, { status: 413 })
  }

  if (rawBody.length > 0 && !contentType.toLowerCase().includes('application/json')) {
    accessLogger.warn('pix.webhook.rejected', {
      correlationId,
      result: 'unsupported_media_type',
      durationMs: Date.now() - t0,
    })
    return NextResponse.json({ received: false, reason: 'unsupported_media_type' }, { status: 415 })
  }

  // ---- 2. Parse do payload -------------------------------------------------
  let payload: unknown = null
  if (rawBody.length > 0) {
    try {
      payload = JSON.parse(rawBody)
    } catch {
      accessLogger.warn('pix.webhook.rejected', {
        correlationId,
        result: 'invalid_json',
        durationMs: Date.now() - t0,
      })
      return NextResponse.json({ received: false, reason: 'invalid_json' }, { status: 400 })
    }
  }

  // ---- 3. Assinatura (FAIL-CLOSED, OBRIGATÓRIA) ----------------------------
  // O manifesto oficial ainda não foi capturado. O verificador só aprova se houver
  // TEMPLATE + SEGREDO configurados; caso contrário retorna 'not_verified'.
  const headers = readSignatureHeaders(request.headers)
  const dataId = extractDataId(payload)

  const verdict = verifySignature({
    headers,
    dataId,
    secret: process.env[SIGNATURE_SECRET_ENV] || null,
    template: process.env[SIGNATURE_TEMPLATE_ENV] || null,
  })

  // Fail-closed SEMPRE: não há mais flag de ambiente para desligar a verificação.
  // Qualquer veredito que não seja 'verified' (ausente, malformada, sem segredo,
  // sem template, divergente ou erro) encerra aqui — antes do passo 4 —, de modo
  // que NADA é gravado em payment_events. A ausência de MERCADOPAGO_WEBHOOK_SECRET
  // ou MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE resulta em rejeição segura, não em
  // permissão. O caminho legítimo só abre quando o contrato for capturado do
  // Sandbox e as variáveis reais forem configuradas — sem alterar este código.
  const signatureStatus = verdict.status

  if (verdict.status !== 'verified') {
    accessLogger.warn('pix.webhook.rejected', {
      correlationId,
      result: 'signature_not_verified',
      reason: verdict.status === 'invalid' ? 'mismatch' : verdict.status,
      durationMs: Date.now() - t0,
    })
    return NextResponse.json({ received: false, reason: 'signature_not_verified' }, { status: 401 })
  }

  accessLogger.info('pix.webhook.received', {
    correlationId,
    result: 'enforced',
    durationMs: Date.now() - t0,
    meta: {
      signature: signatureStatus,
      hasRequestId: Boolean(headers.requestId),
      hasDataId: Boolean(dataId),
    },
  })

  // ---- 4. Registro idempotente (SEM conceder nada) -------------------------
  try {
    const result = await processWebhookEvent({
      rawBody,
      payload,
      signatureStatus,
      signatureMethod: verdict.status === 'verified' ? verdict.method : null,
    })

    accessLogger.info('pix.webhook.processed', {
      correlationId,
      result: result.outcome,
      durationMs: Date.now() - t0,
      meta: {
        eventType: result.eventType,
        stored: result.stored,
        // nunca o id completo do pedido
        orderIdMasked: result.orderId ? result.orderId.slice(0, 8) + '***' : null,
      },
    })

    // Resposta mínima: nada de ids internos, nada de eco do payload.
    return NextResponse.json(
      { received: true, outcome: result.outcome, stored: result.stored },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: unknown) {
    // Falha inesperada: registra e responde 200 para evitar retry infinito do provedor.
    // O evento ficará pendente de reconciliação.
    accessLogger.error('pix.webhook.rejected', {
      correlationId,
      result: 'processing_error',
      reason: String((error as Error)?.message || 'erro').slice(0, 80),
      durationMs: Date.now() - t0,
    })
    return NextResponse.json({ received: true, outcome: 'storage_error' }, { status: 200 })
  }
}

// Somente POST é aceito.
export async function GET() {
  return NextResponse.json({ received: false, reason: 'method_not_allowed' }, { status: 405 })
}
export async function PUT() {
  return NextResponse.json({ received: false, reason: 'method_not_allowed' }, { status: 405 })
}
export async function PATCH() {
  return NextResponse.json({ received: false, reason: 'method_not_allowed' }, { status: 405 })
}
export async function DELETE() {
  return NextResponse.json({ received: false, reason: 'method_not_allowed' }, { status: 405 })
}
