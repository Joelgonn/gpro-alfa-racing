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
  parseSignatureHeader,
  buildManifest,
  computeHmacHex,
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
  // PIX-020: contrato oficial Orders API
  //   Manifest: id:<data.id em lowercase>;request-id:<x-request-id>;ts:<ts>;
  //   data.id para HMAC vem do QUERY PARAM data.id (lowercase), não do body.
  //   Body data.id é preservado apenas para processamento pós-assinatura.
  const headers = readSignatureHeaders(request.headers)
  const queryDataIdRaw = request.nextUrl.searchParams.get('data.id')
  const queryDataId = queryDataIdRaw ? queryDataIdRaw.trim() : null
  const bodyDataId = extractDataId(payload)
  // Para assinatura, usar query param (lowercase tratado em buildManifest/verifySignature)
  const signatureDataId = queryDataId
  // Para diagnóstico, manter ambos (bodyDataId pode divergir)
  const dataId = bodyDataId || queryDataId

  const verdict = verifySignature({
    headers,
    dataId: signatureDataId,
    secret: process.env[SIGNATURE_SECRET_ENV] || null,
    template: process.env[SIGNATURE_TEMPLATE_ENV] || null,
  })
  // Para logs mascarados, reutilizar env (sem expor)
  const secretForLog = process.env[SIGNATURE_SECRET_ENV] || null
  const templateForLog = process.env[SIGNATURE_TEMPLATE_ENV] || null

  // Fail-closed SEMPRE: não há mais flag de ambiente para desligar a verificação.
  const signatureStatus = verdict.status

  if (verdict.status !== 'verified') {
    // Observabilidade segura PIX-020 — granular sem expor segredo
    const parsed = parseSignatureHeader(headers.signature)
    const ts = parsed?.ts ?? null
    const v1 = parsed?.v1 ?? null
    let driftMs: number | null = null
    if (ts) {
      const tsNum = Number(ts)
      if (Number.isFinite(tsNum)) {
        const tsMs = tsNum < 1e12 ? tsNum * 1000 : tsNum
        driftMs = Math.abs(Date.now() - tsMs)
      }
    }
    const templateHasTs = typeof templateForLog === 'string' && templateForLog.includes('{ts}')
    // Prefixos mascarados (6 chars) para diagnóstico sem expor HMAC completo
    const dataIdPrefix = signatureDataId ? signatureDataId.slice(0, 8) + '***' : null
    const requestIdPrefix = headers.requestId ? headers.requestId.slice(0, 8) + '***' : null
    const v1Prefix = v1 ? v1.slice(0, 6) + '***' : null
    let expectedPrefix: string | null = null
    if (signatureDataId && ts && secretForLog && templateHasTs) {
      try {
        const manifestForLog = buildManifest(templateForLog ?? undefined, {
          dataId: signatureDataId,
          requestId: headers.requestId,
          ts,
        })
        if (manifestForLog) {
          const expected = computeHmacHex(secretForLog, manifestForLog)
          expectedPrefix = expected.slice(0, 6) + '***'
        }
      } catch {}
    }
    // Reason granular PIX-020
    let granularReason: string
    if (verdict.status === 'not_verified') {
      const r = (verdict as { reason: string }).reason
      if (r === 'no_headers') granularReason = 'missing_headers'
      else if (r === 'malformed') granularReason = 'malformed_signature'
      else if (r === 'missing_data_id') granularReason = 'missing_data_id'
      else if (r === 'no_template') granularReason = 'missing_template'
      else if (r === 'no_secret') granularReason = 'missing_secret'
      else granularReason = r
    } else if (verdict.status === 'invalid') {
      const r = (verdict as { reason: string }).reason
      if (r === 'timestamp_expired') granularReason = 'timestamp_expired'
      else if (r === 'hmac_mismatch') granularReason = 'hmac_mismatch'
      else granularReason = 'mismatch'
    } else {
      granularReason = (verdict as { reason?: string }).reason || verdict.status
    }

    accessLogger.warn('pix.webhook.rejected', {
      correlationId,
      result: 'signature_not_verified',
      reason: granularReason,
      durationMs: Date.now() - t0,
      meta: {
        dataIdPrefix,
        requestIdPrefix,
        ts,
        driftMs,
        v1Prefix,
        expectedPrefix,
        templateHasTs,
        // Compatibilidade: has* para logs antigos
        hasRequestId: Boolean(headers.requestId),
        hasDataId: Boolean(signatureDataId),
        bodyDataIdPrefix: bodyDataId ? bodyDataId.slice(0, 8) + '***' : null,
      },
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
      hasDataId: Boolean(signatureDataId),
      dataIdPrefix: signatureDataId ? signatureDataId.slice(0, 8) + '***' : null,
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
