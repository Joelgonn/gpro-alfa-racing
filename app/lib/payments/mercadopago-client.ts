// app/lib/payments/mercadopago-client.ts
// PIX-008 — Adaptador Mercado Pago server-only (criação e consulta PIX)
// Responsabilidade exclusiva: comunicação HTTPS com api.mercadopago.com
// NÃO insere access_grants, NÃO concede VIP, NÃO depende de React/PIX_ENABLED

import 'server-only'

// ---------------------------------------------------------------------------
// Configuração segura
// ---------------------------------------------------------------------------

export const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com'
const DEFAULT_TIMEOUT_MS = 12000

export type MercadoPagoErrorCode =
  | 'MERCADOPAGO_CONFIG_MISSING'
  | 'MERCADOPAGO_REQUEST_FAILED'
  | 'MERCADOPAGO_INVALID_RESPONSE'
  | 'MERCADOPAGO_TIMEOUT'
  | 'MERCADOPAGO_UNAUTHORIZED'
  | 'MERCADOPAGO_RATE_LIMITED'
  | 'MERCADOPAGO_NOT_FOUND'

export class MercadoPagoError extends Error {
  readonly code: MercadoPagoErrorCode
  readonly status?: number
  constructor(code: MercadoPagoErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'MercadoPagoError'
    this.code = code
    this.status = status
  }
}

interface MercadoPagoConfig {
  accessToken: string
}

function getMercadoPagoConfig(): MercadoPagoConfig {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new MercadoPagoError('MERCADOPAGO_CONFIG_MISSING', 'Configuracao Mercado Pago ausente')
  }
  const trimmed = token.trim()
  if (trimmed.length < 10) {
    throw new MercadoPagoError('MERCADOPAGO_CONFIG_MISSING', 'Configuracao Mercado Pago ausente')
  }
  return { accessToken: trimmed }
}

// ---------------------------------------------------------------------------
// Tipos internos — payload e resposta normalizada
// ---------------------------------------------------------------------------

export interface CreatePixPaymentParams {
  orderId: string
  amountCents: number
  currency?: string
  description: string
  payerEmail?: string
  idempotencyKey?: string
}

export interface MercadoPagoPixPayment {
  providerPaymentId: string
  providerStatus: string
  statusDetail: string | null
  externalReference: string | null
  amount: number
  currency: string
  qrCode: string | null
  qrCodeBase64: string | null
  ticketUrl: string | null
  expiresAt: string | null
  rawResponseMasked: Record<string, unknown>
}

// Tipos brutos mínimos da API (somente campos usados)
interface RawPaymentResponse {
  id?: number | string
  status?: string
  status_detail?: string
  external_reference?: string | null
  transaction_amount?: number
  currency_id?: string
  date_of_expiration?: string | null
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string | null
      qr_code_base64?: string | null
      ticket_url?: string | null
    } | null
  } | null
  [k: string]: unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function centsToDecimal(cents: number): number {
  return Math.round(cents) / 100
}

function validateCreateParams(params: CreatePixPaymentParams): void {
  if (!params.orderId || typeof params.orderId !== 'string' || !params.orderId.trim()) {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'orderId invalido')
  }
  if (!/^[0-9a-f-]{36}$/i.test(params.orderId.trim())) {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'orderId deve ser UUID')
  }
  if (typeof params.amountCents !== 'number' || !Number.isInteger(params.amountCents) || params.amountCents <= 0) {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'amountCents deve ser inteiro positivo')
  }
  if (!Number.isFinite(params.amountCents)) {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'amountCents invalido')
  }
  const currency = (params.currency || 'BRL').toUpperCase()
  if (currency !== 'BRL') {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'currency deve ser BRL')
  }
  if (!params.description || typeof params.description !== 'string' || !params.description.trim()) {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'description obrigatoria')
  }
  if (params.description.trim().length > 200) {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'description muito longa')
  }
  if (params.payerEmail !== undefined && params.payerEmail !== null) {
    if (typeof params.payerEmail !== 'string' || !params.payerEmail.includes('@')) {
      throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'payerEmail invalido')
    }
  }
}

function buildPixPayload(params: CreatePixPaymentParams): Record<string, unknown> {
  const currency = (params.currency || 'BRL').toUpperCase()
  const amountDecimal = centsToDecimal(params.amountCents)
  const body: Record<string, unknown> = {
    transaction_amount: amountDecimal,
    description: params.description.trim().slice(0, 200),
    payment_method_id: 'pix',
    external_reference: params.orderId.trim(),
    currency_id: currency,
  }
  if (params.payerEmail) {
    body.payer = { email: params.payerEmail.trim() }
  }
  return body
}

function maskRawResponse(raw: RawPaymentResponse): Record<string, unknown> {
  // Retorna apenas campos seguros, nunca token, nunca payer completo
  const out: Record<string, unknown> = {}
  const allowed = ['id', 'status', 'status_detail', 'external_reference', 'transaction_amount', 'currency_id', 'date_of_expiration']
  for (const k of allowed) {
    if (k in raw) out[k] = raw[k as keyof RawPaymentResponse] as unknown
  }
  if (raw.point_of_interaction?.transaction_data) {
    const td = raw.point_of_interaction.transaction_data
    out.point_of_interaction = {
      transaction_data: {
        qr_code: td.qr_code ? '[qr_code]' : null,
        qr_code_base64: td.qr_code_base64 ? '[base64]' : null,
        ticket_url: td.ticket_url ? String(td.ticket_url).slice(0, 120) : null,
      },
    }
  }
  return out
}

function normalizePayment(raw: RawPaymentResponse): MercadoPagoPixPayment {
  if (raw.id === undefined || raw.id === null || String(raw.id).trim() === '') {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'Resposta sem ID do pagamento')
  }
  const providerPaymentId = String(raw.id)
  const providerStatus = typeof raw.status === 'string' ? raw.status : 'unknown'
  const statusDetail = typeof raw.status_detail === 'string' ? raw.status_detail : null
  const externalReference = typeof raw.external_reference === 'string' ? raw.external_reference : null
  const amount = typeof raw.transaction_amount === 'number' ? raw.transaction_amount : 0
  const currency = typeof raw.currency_id === 'string' ? raw.currency_id : 'BRL'
  const td = raw.point_of_interaction?.transaction_data
  const qrCode = td?.qr_code && typeof td.qr_code === 'string' ? td.qr_code : null
  const qrCodeBase64 = td?.qr_code_base64 && typeof td.qr_code_base64 === 'string' ? td.qr_code_base64 : null
  const ticketUrl = td?.ticket_url && typeof td.ticket_url === 'string' ? td.ticket_url : null
  const expiresAt = typeof raw.date_of_expiration === 'string' ? raw.date_of_expiration : null

  return {
    providerPaymentId,
    providerStatus,
    statusDetail,
    externalReference,
    amount,
    currency,
    qrCode,
    qrCodeBase64,
    ticketUrl,
    expiresAt,
    rawResponseMasked: maskRawResponse(raw),
  }
}

function truncateErrorBody(text: string): string {
  if (!text) return ''
  return text.slice(0, 500)
}

// ---------------------------------------------------------------------------
// Cliente HTTP robusto
// ---------------------------------------------------------------------------

async function mercadoPagoFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const config = getMercadoPagoConfig()
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.accessToken}`,
    ...(init.headers as Record<string, string> | undefined),
  }

  try {
    const res = await fetch(`${MERCADOPAGO_API_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    })
    return res
  } catch (err: unknown) {
    const e = err as Error & { name?: string }
    if (e?.name === 'AbortError') {
      throw new MercadoPagoError('MERCADOPAGO_TIMEOUT', 'Timeout ao consultar Mercado Pago')
    }
    throw new MercadoPagoError('MERCADOPAGO_REQUEST_FAILED', 'Falha de rede ao consultar Mercado Pago')
  } finally {
    clearTimeout(timeout)
  }
}

function handleHttpError(status: number, bodyText: string): never {
  const truncated = truncateErrorBody(bodyText)
  if (status === 401) {
    throw new MercadoPagoError('MERCADOPAGO_UNAUTHORIZED', `Nao autorizado${truncated ? ': ' + truncated.slice(0, 80) : ''}`, 401)
  }
  if (status === 404) {
    throw new MercadoPagoError('MERCADOPAGO_NOT_FOUND', `Recurso nao encontrado${truncated ? ': ' + truncated.slice(0, 80) : ''}`, 404)
  }
  if (status === 429) {
    throw new MercadoPagoError('MERCADOPAGO_RATE_LIMITED', 'Rate limit Mercado Pago', 429)
  }
  if (status >= 500) {
    throw new MercadoPagoError('MERCADOPAGO_REQUEST_FAILED', `Erro gateway ${status}${truncated ? ': ' + truncated.slice(0, 80) : ''}`, status)
  }
  throw new MercadoPagoError('MERCADOPAGO_REQUEST_FAILED', `Requisicao falhou ${status}${truncated ? ': ' + truncated.slice(0, 80) : ''}`, status)
}

// ---------------------------------------------------------------------------
// API publica: criacao
// ---------------------------------------------------------------------------

export async function createPixPayment(params: CreatePixPaymentParams): Promise<MercadoPagoPixPayment> {
  validateCreateParams(params)
  // Validacao de configuracao antes de qualquer chamada externa
  getMercadoPagoConfig()

  const payload = buildPixPayload(params)
  const idempotencyKey = params.idempotencyKey?.trim() || params.orderId.trim()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': idempotencyKey,
  }

  const res = await mercadoPagoFetch('/v1/payments', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const text = await res.text().catch(() => '')

  if (!res.ok) {
    handleHttpError(res.status, text)
  }

  let raw: RawPaymentResponse
  try {
    raw = text ? (JSON.parse(text) as RawPaymentResponse) : ({} as RawPaymentResponse)
  } catch {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'Resposta JSON invalida do Mercado Pago')
  }

  // Campos PIX sao opcionais na resposta inicial — QR Code pode nao estar presente imediatamente
  return normalizePayment(raw)
}

// ---------------------------------------------------------------------------
// API publica: consulta server-to-server
// ---------------------------------------------------------------------------

export async function getMercadoPagoPayment(paymentId: string): Promise<MercadoPagoPixPayment> {
  if (!paymentId || typeof paymentId !== 'string' || !paymentId.trim()) {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'paymentId invalido')
  }
  getMercadoPagoConfig()

  const encoded = encodeURIComponent(paymentId.trim())
  const res = await mercadoPagoFetch(`/v1/payments/${encoded}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  const text = await res.text().catch(() => '')

  if (!res.ok) {
    handleHttpError(res.status, text)
  }

  let raw: RawPaymentResponse
  try {
    raw = text ? (JSON.parse(text) as RawPaymentResponse) : ({} as RawPaymentResponse)
  } catch {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'Resposta JSON invalida do Mercado Pago')
  }

  return normalizePayment(raw)
}

// Exportado para testes — nao usar fora de testes
export const _internal = {
  centsToDecimal,
  buildPixPayload,
  maskRawResponse,
  normalizePayment,
  validateCreateParams,
  truncateErrorBody,
}
