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
  // PIX-014.6 — conflito de idempotência no provedor é causa PRÓPRIA, não erro genérico
  | 'MERCADOPAGO_IDEMPOTENCY_CONFLICT'

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
  providerOrderId?: string | null
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

// Tipos brutos mínimos da API (somente campos usados) — suporta /v1/payments e /v1/orders
interface RawPaymentResponse {
  id?: number | string
  status?: string
  status_detail?: string
  external_reference?: string | null
  transaction_amount?: number
  total_amount?: number | string
  currency_id?: string
  date_of_expiration?: string | null
  expiration_time?: string | null
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string | null
      qr_code_base64?: string | null
      ticket_url?: string | null
    } | null
  } | null
  transactions?: {
    payments?: Array<{
      id?: number | string
      status?: string
      status_detail?: string
      amount?: number | string
      payment_method?: {
        id?: string
        type?: string
        qr_code?: string | null
        qr_code_base64?: string | null
        ticket_url?: string | null
      } | null
      qr_code?: string | null
      qr_code_base64?: string | null
      ticket_url?: string | null
      expiration_time?: string | null
    }>
  }
  [k: string]: unknown
}

interface RawOrderResponse {
  id?: string
  external_reference?: string | null
  total_amount?: number | string
  status?: string
  payer?: { email?: string }
  transactions?: {
    payments?: Array<{
      id?: string | number
      amount?: number | string
      status?: string
      status_detail?: string
      payment_method?: {
        id?: string
        type?: string
        qr_code?: string | null
        qr_code_base64?: string | null
        ticket_url?: string | null
      }
      expiration_time?: string | null
    }>
  }
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
  // PIX-010.2 — Checkout Transparente via /v1/orders (não /v1/payments)
  const amountDecimal = centsToDecimal(params.amountCents)
  const amountStr = amountDecimal.toFixed(2)
  const body: Record<string, unknown> = {
    type: 'online',
    external_reference: params.orderId.trim(),
    total_amount: amountStr,
    description: params.description.trim().slice(0, 200),
    processing_mode: 'automatic',
    transactions: {
      payments: [
        {
          amount: amountStr,
          payment_method: {
            id: 'pix',
            type: 'bank_transfer',
          },
          // Pix expira em até 30min por padrão; usa P3Y6M... como fallback se não houver expires_at
          expiration_time: 'P1D',
        },
      ],
    },
  }
  if (params.payerEmail) {
    body.payer = { email: params.payerEmail.trim() }
  }
  return body
}

// Mantido para compatibilidade com testes que verificam payload legado (não usado na criação atual)
function buildLegacyPixPayload(params: CreatePixPaymentParams): Record<string, unknown> {
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

function maskRawResponse(raw: RawPaymentResponse | RawOrderResponse): Record<string, unknown> {
  // Retorna apenas campos seguros, nunca token, nunca payer completo
  const out: Record<string, unknown> = {}
  const allowed = ['id', 'status', 'status_detail', 'external_reference', 'transaction_amount', 'total_amount', 'currency_id', 'date_of_expiration', 'expiration_time']
  for (const k of allowed) {
    if (k in raw) out[k] = (raw as Record<string, unknown>)[k] as unknown
  }
  const anyRaw = raw as RawOrderResponse
  if (anyRaw.transactions?.payments?.[0]) {
    const p = anyRaw.transactions.payments[0] as Record<string, unknown>
    out.transactions = {
      payments: [
        {
          id: (p as Record<string, unknown>).id ? '[id]' : null,
          status: (p as Record<string, unknown>).status ?? null,
          amount: (p as Record<string, unknown>).amount ?? null,
          payment_method: (() => {
            const pm = (p as Record<string, unknown>).payment_method as Record<string, unknown> | undefined
            if (!pm) return null
            return {
              qr_code: pm.qr_code ? '[qr_code]' : null,
              qr_code_base64: pm.qr_code_base64 ? '[base64]' : null,
              ticket_url: pm.ticket_url ? String(pm.ticket_url).slice(0, 120) : null,
            }
          })(),
        },
      ],
    }
  } else if ((raw as RawPaymentResponse).point_of_interaction?.transaction_data) {
    const td = (raw as RawPaymentResponse).point_of_interaction!.transaction_data!
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
  // Legado /v1/payments
  if (raw.id === undefined || raw.id === null || String(raw.id).trim() === '') {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'Resposta sem ID do pagamento')
  }
  const providerPaymentId = String(raw.id)
  const providerStatus = typeof raw.status === 'string' ? raw.status : 'unknown'
  const statusDetail = typeof raw.status_detail === 'string' ? raw.status_detail : null
  const externalReference = typeof raw.external_reference === 'string' ? raw.external_reference : null
  const amount = typeof raw.transaction_amount === 'number' ? raw.transaction_amount : 0
  const currency = typeof raw.currency_id === 'string' ? raw.currency_id : 'BRL'
  const td = (raw as RawPaymentResponse).point_of_interaction?.transaction_data
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

function normalizeOrder(raw: RawOrderResponse): MercadoPagoPixPayment {
  // Novo /v1/orders — extrai payment de transactions.payments[0]
  const orderId = raw.id ? String(raw.id) : null
  if (!orderId) throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'Resposta sem ID da order')
  const externalReference = typeof raw.external_reference === 'string' ? raw.external_reference : null
  const payment = raw.transactions?.payments?.[0]
  if (!payment || payment.id === undefined || String(payment.id).trim() === '') {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'Resposta sem ID do pagamento na order')
  }
  const providerPaymentId = String(payment.id)
  const providerStatus = typeof payment.status === 'string' ? payment.status : typeof raw.status === 'string' ? raw.status : 'unknown'
  const statusDetail = typeof (payment as Record<string, unknown>).status_detail === 'string' ? (payment as Record<string, unknown>).status_detail as string : null
  const amountRaw = (payment as Record<string, unknown>).amount ?? raw.total_amount
  const amount = typeof amountRaw === 'number' ? amountRaw : typeof amountRaw === 'string' ? parseFloat(amountRaw) : 0
  const currency = 'BRL'
  const pm = (payment as Record<string, unknown>).payment_method as Record<string, unknown> | undefined
  const qrCode = pm?.qr_code && typeof pm.qr_code === 'string' ? (pm.qr_code as string) : null
  const qrCodeBase64 = pm?.qr_code_base64 && typeof pm.qr_code_base64 === 'string' ? (pm.qr_code_base64 as string) : null
  const ticketUrl = (pm?.ticket_url as string) || ((payment as Record<string, unknown>).ticket_url as string) || null
  const expiresAt = (payment as Record<string, unknown>).expiration_time as string | null || (raw as Record<string, unknown>).expiration_time as string | null || null

  return {
    providerPaymentId,
    providerOrderId: orderId,
    providerStatus,
    statusDetail,
    externalReference,
    amount,
    currency,
    qrCode,
    qrCodeBase64: qrCodeBase64,
    ticketUrl: ticketUrl && typeof ticketUrl === 'string' ? ticketUrl : null,
    expiresAt: expiresAt && typeof expiresAt === 'string' ? expiresAt : null,
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
  // Tenta extrair mensagem estruturada do Mercado Pago (errors[].code/message/cause)
  let mpDetail = ''
  let mpErrorCode = ''
  if (truncated) {
    try {
      const parsed = JSON.parse(truncated) as Record<string, unknown>
      const errors = (parsed as { errors?: Array<{ code?: string; message?: string; cause?: unknown }> }).errors
      if (Array.isArray(errors) && errors.length > 0) {
        const first = errors[0]
        const code = typeof first.code === 'string' ? first.code : ''
        mpErrorCode = code
        const msg = typeof first.message === 'string' ? first.message : ''
        const cause = first.cause !== undefined ? ` cause=${String(first.cause).slice(0, 120)}` : ''
        mpDetail = ` code=${code} message=${msg}${cause}`.trim()
      } else if (typeof (parsed as { message?: string }).message === 'string') {
        mpDetail = ` message=${String((parsed as { message: string }).message).slice(0, 120)}`
      }
    } catch {
      // body não é JSON — usa truncated
    }
  }
  const sanitizedMp = mpDetail ? ` Mercado Pago ${status}${mpDetail}` : truncated ? `: ${truncated.slice(0, 200)}` : ''
  if (status === 401) {
    throw new MercadoPagoError('MERCADOPAGO_UNAUTHORIZED', `Nao autorizado${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 80) : '')}`, 401)
  }
  if (status === 402) {
    throw new MercadoPagoError('MERCADOPAGO_REQUEST_FAILED', `Mercado Pago 402 code=failed${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 120) : '')}`, 402)
  }
  if (status === 404) {
    throw new MercadoPagoError('MERCADOPAGO_NOT_FOUND', `Recurso nao encontrado${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 80) : '')}`, 404)
  }
  // PIX-014.6 — 409 do Mercado Pago tem causa própria e exige tratamento próprio:
  // `idempotency_key_already_used` significa que a chave já foi registrada no provedor
  // (a resposta anterior, mesmo com erro, "queima" a chave). Não é erro genérico:
  // quem chamou precisa decidir entre reutilizar o resultado existente ou abrir uma
  // NOVA tentativa com NOVA chave. Nunca tratar como falha indefinida.
  if (status === 409) {
    if (/idempotency_key_already_used/i.test(mpErrorCode) || /idempotency_key_already_used/i.test(truncated)) {
      throw new MercadoPagoError(
        'MERCADOPAGO_IDEMPOTENCY_CONFLICT',
        `Chave de idempotencia ja utilizada no Mercado Pago${sanitizedMp}`,
        409,
      )
    }
    throw new MercadoPagoError('MERCADOPAGO_REQUEST_FAILED', `Conflito ${status}${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 120) : '')}`, 409)
  }
  if (status === 429) {
    throw new MercadoPagoError('MERCADOPAGO_RATE_LIMITED', 'Rate limit Mercado Pago', 429)
  }
  if (status >= 500) {
    throw new MercadoPagoError('MERCADOPAGO_REQUEST_FAILED', `Erro gateway ${status}${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 80) : '')}`, status)
  }
  throw new MercadoPagoError('MERCADOPAGO_REQUEST_FAILED', `Requisicao falhou ${status}${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 80) : '')}`, status)
}

// ---------------------------------------------------------------------------
// API publica: criacao
// ---------------------------------------------------------------------------

export async function createPixPayment(params: CreatePixPaymentParams): Promise<MercadoPagoPixPayment> {
  // PIX-010.2 — cria via /v1/orders (Checkout Transparente), não /v1/payments (legacy)
  validateCreateParams(params)
  getMercadoPagoConfig()

  const payload = buildPixPayload(params)
  const idempotencyKey = params.idempotencyKey?.trim() || params.orderId.trim()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': idempotencyKey,
  }

  const res = await mercadoPagoFetch('/v1/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const text = await res.text().catch(() => '')

  if (!res.ok) {
    handleHttpError(res.status, text)
  }

  let raw: RawOrderResponse
  try {
    raw = text ? (JSON.parse(text) as RawOrderResponse) : ({} as RawOrderResponse)
  } catch {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'Resposta JSON invalida do Mercado Pago')
  }

  return normalizeOrder(raw)
}

// Mantido para compatibilidade com testes que verificam payload legado (não usado na criação atual)
export async function createPixPaymentLegacy(params: CreatePixPaymentParams): Promise<MercadoPagoPixPayment> {
  validateCreateParams(params)
  getMercadoPagoConfig()
  const payload = buildLegacyPixPayload(params)
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
  if (!res.ok) handleHttpError(res.status, text)
  let raw: RawPaymentResponse
  try {
    raw = text ? (JSON.parse(text) as RawPaymentResponse) : ({} as RawPaymentResponse)
  } catch {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'Resposta JSON invalida do Mercado Pago')
  }
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

export async function getMercadoPagoOrder(orderId: string): Promise<MercadoPagoPixPayment> {
  if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'orderId invalido')
  }
  getMercadoPagoConfig()
  const encoded = encodeURIComponent(orderId.trim())
  const res = await mercadoPagoFetch(`/v1/orders/${encoded}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) handleHttpError(res.status, text)
  let raw: RawOrderResponse
  try {
    raw = text ? (JSON.parse(text) as RawOrderResponse) : ({} as RawOrderResponse)
  } catch {
    throw new MercadoPagoError('MERCADOPAGO_INVALID_RESPONSE', 'Resposta JSON invalida do Mercado Pago')
  }
  return normalizeOrder(raw)
}

// Exportado para testes — nao usar fora de testes
export const _internal = {
  centsToDecimal,
  buildPixPayload,
  buildLegacyPixPayload,
  maskRawResponse,
  normalizePayment,
  normalizeOrder,
  validateCreateParams,
  truncateErrorBody,
}
