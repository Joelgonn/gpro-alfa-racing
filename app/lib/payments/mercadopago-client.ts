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
  // PIX-015 — o provedor criou a Order/pagamento e a TRANSAÇÃO falhou (HTTP 402).
  // Causa distinta de falha de requisição: a cobrança chegou a existir no provedor.
  | 'MERCADOPAGO_TRANSACTION_FAILED'

/**
 * PIX-015 — Detalhe estruturado do erro do provedor.
 * Existe porque, até aqui, o 402 de Production era registrado apenas como
 * `code/message` do primeiro erro, descartando o motivo real da transação
 * (`status_detail`, `details`) e os identificadores criados (Order/payment) —
 * o que tornava a causa impossível de determinar pelos nossos logs.
 * Tudo aqui é sanitizado: nada de token, nada de PII.
 */
export interface MercadoPagoErrorDetail {
  /** código do erro do provedor (ex.: failed) */
  providerErrorCode: string | null
  /** mensagem do provedor, truncada */
  providerMessage: string | null
  /** motivos adicionais (details/cause), sanitizados e truncados */
  details: string[]
  /** status_detail do pagamento/order quando o provedor informa */
  statusDetail: string | null
  /** id da Order no provedor, quando presente no corpo do erro */
  providerOrderId: string | null
  /** id do pagamento no provedor, quando presente no corpo do erro */
  providerPaymentId: string | null
}

export class MercadoPagoError extends Error {
  readonly code: MercadoPagoErrorCode
  readonly status?: number
  readonly detail?: MercadoPagoErrorDetail
  constructor(code: MercadoPagoErrorCode, message: string, status?: number, detail?: MercadoPagoErrorDetail) {
    super(message)
    this.name = 'MercadoPagoError'
    this.code = code
    this.status = status
    this.detail = detail
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

/**
 * PIX-015 — Primeira data ISO-8601 VÁLIDA entre os candidatos.
 * O campo `expiration_time` do payload é uma DURAÇÃO ("P1D") e o provedor a devolve
 * ecoada na resposta; a data real de expiração vem em `date_of_expiration`.
 * Aceitar "P1D" como data fazia o QR nunca expirar localmente (premium_payments.expires_at
 * ficava NULL e o QR era tratado como utilizável para sempre). Evidência: resposta real
 * do provedor no sandbox traz `expiration_time: "P1D"` **e** `date_of_expiration` ISO.
 */
function firstValidIsoDate(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const text = value.trim()
    if (!text) continue
    if (/^P/i.test(text)) continue // duração ISO-8601 (ex.: P1D) não é data
    if (Number.isNaN(new Date(text).getTime())) continue
    return text
  }
  return null
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
  const expiresAt = firstValidIsoDate([
    (payment as Record<string, unknown>).date_of_expiration,
    (raw as Record<string, unknown>).date_of_expiration,
    (payment as Record<string, unknown>).expiration_time,
    (raw as Record<string, unknown>).expiration_time,
  ])

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
// PIX-015 — Extração DEFENSIVA do detalhe do erro do provedor
// ---------------------------------------------------------------------------
// Objetivo: não perder o motivo real da falha nem os identificadores criados.
// Não assume um shape único: procura os campos conhecidos e, se necessário,
// varre o corpo de forma limitada por ids do provedor (ORD.../PAY...).
// Sempre sanitizado (sem token, sem e-mail, truncado).

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeProviderText(value: unknown, max = 200): string | null {
  if (value === null || value === undefined) return null
  let raw: string
  if (typeof value === 'string') raw = value
  else if (typeof value === 'number' || typeof value === 'boolean') raw = String(value)
  else {
    try {
      raw = JSON.stringify(value)
    } catch {
      raw = String(value)
    }
  }
  const cleaned = raw
    .replace(/(eyJ[A-Za-z0-9._-]{10,})/g, '[jwt]')
    .replace(/(apikey|api_key|access_token|token|secret|authorization)\s*[:=]\s*\S+/gi, '$1=[redigido]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? cleaned.slice(0, max) : null
}

function collectDetails(source: unknown, out: string[], depth = 0): void {
  if (source === null || source === undefined || depth > 3 || out.length >= 5) return
  if (typeof source === 'string' || typeof source === 'number') {
    const text = sanitizeProviderText(source)
    if (text) out.push(text)
    return
  }
  if (Array.isArray(source)) {
    for (const item of source.slice(0, 5)) collectDetails(item, out, depth + 1)
    return
  }
  if (isRecord(source)) {
    const code = sanitizeProviderText(source.code, 80)
    const message = sanitizeProviderText(source.message, 160)
    if (code || message) out.push([code ? `code=${code}` : '', message ? `message=${message}` : ''].filter(Boolean).join(' '))
    for (const key of ['details', 'cause', 'description', 'reason', 'status_detail']) {
      if (source[key] !== undefined && !(code && key === 'details' && out.length > 0 && depth === 0)) {
        collectDetails(source[key], out, depth + 1)
      }
    }
  }
}

/** Procura um id do provedor (ORD.../PAY...) em qualquer profundidade limitada. */
function findProviderId(value: unknown, prefix: 'ORD' | 'PAY'): string | null {
  const pattern = new RegExp(`\\b(${prefix}[0-9A-Za-z]{6,})\\b`)
  const seen = new Set<unknown>()
  const walk = (node: unknown, depth: number): string | null => {
    if (node === null || node === undefined || depth > 4) return null
    if (typeof node === 'string') {
      const m = node.match(pattern)
      return m ? m[1] : null
    }
    if (typeof node !== 'object' || seen.has(node)) return null
    seen.add(node)
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 5)) {
        const found = walk(item, depth + 1)
        if (found) return found
      }
      return null
    }
    for (const child of Object.values(node as Record<string, unknown>)) {
      const found = walk(child, depth + 1)
      if (found) return found
    }
    return null
  }
  return walk(value, 0)
}

/** Procura `status_detail` em qualquer profundidade limitada (o provedor aninha esse campo). */
function findStatusDetail(value: unknown, depth = 0): string | null {
  if (value === null || value === undefined || depth > 4) return null
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 5)) {
      const found = findStatusDetail(item, depth + 1)
      if (found) return found
    }
    return null
  }
  if (!isRecord(value)) return null
  const direct = sanitizeProviderText(value.status_detail, 120)
  if (direct) return direct
  for (const child of Object.values(value)) {
    const found = findStatusDetail(child, depth + 1)
    if (found) return found
  }
  return null
}

/** Monta o detalhe estruturado a partir do corpo de erro bruto (já parseado). */
export function extractErrorDetail(parsedBody: unknown, fallbackCode = ''): MercadoPagoErrorDetail {
  const body = isRecord(parsedBody) ? parsedBody : {}
  const errors = Array.isArray(body.errors) ? (body.errors as unknown[]) : []
  const first = isRecord(errors[0]) ? (errors[0] as Record<string, unknown>) : {}

  const details: string[] = []
  if (first.details !== undefined) collectDetails(first.details, details)
  if (first.cause !== undefined) collectDetails(first.cause, details)
  if (first.message !== undefined && details.length === 0) collectDetails(first.message, details)
  if (details.length === 0 && errors.length > 1) collectDetails(errors.slice(1), details)

  const transactions = isRecord(body.transactions) ? (body.transactions as Record<string, unknown>) : {}
  const payments = Array.isArray(transactions.payments) ? (transactions.payments as unknown[]) : []
  const firstPayment = isRecord(payments[0]) ? (payments[0] as Record<string, unknown>) : {}
  const bodyPayment = isRecord(body.payment) ? (body.payment as Record<string, unknown>) : {}

  const statusDetail =
    sanitizeProviderText(firstPayment.status_detail, 120) ??
    sanitizeProviderText(bodyPayment.status_detail, 120) ??
    sanitizeProviderText(body.status_detail, 120) ??
    sanitizeProviderText(first.status_detail, 120) ??
    findStatusDetail(errors) ??
    findStatusDetail(body)

  return {
    providerErrorCode: sanitizeProviderText(first.code, 80) ?? sanitizeProviderText(fallbackCode, 80),
    providerMessage: sanitizeProviderText(first.message, 160),
    details: details.slice(0, 5),
    statusDetail,
    providerOrderId:
      sanitizeProviderText(first.order_id, 64) ??
      sanitizeProviderText(body.order_id, 64) ??
      findProviderId(body, 'ORD'),
    providerPaymentId:
      sanitizeProviderText(first.payment_id, 64) ??
      sanitizeProviderText(firstPayment.id, 64) ??
      sanitizeProviderText(bodyPayment.id, 64) ??
      findProviderId(body, 'PAY'),
  }
}

/** Sufixo legível (e sanitizado) com o motivo real + ids criados pelo provedor. */
function buildDetailSuffix(detail: MercadoPagoErrorDetail): string {
  const parts = [
    detail.statusDetail ? `status_detail=${detail.statusDetail}` : '',
    detail.details.length ? `details=${detail.details.join(' | ').slice(0, 240)}` : '',
    detail.providerOrderId ? `order=${detail.providerOrderId}` : '',
    detail.providerPaymentId ? `payment=${detail.providerPaymentId}` : '',
  ].filter(Boolean)
  return parts.length ? ` ${parts.join(' ')}` : ''
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
  let parsedBody: unknown = null
  if (truncated) {
    try {
      parsedBody = JSON.parse(truncated)
      const parsed = parsedBody as Record<string, unknown>
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
  // PIX-015 — detalhe estruturado (motivo real + ids criados), sempre sanitizado.
  const detail = extractErrorDetail(parsedBody, mpErrorCode)
  const detailSuffix = buildDetailSuffix(detail)
  const sanitizedMp = mpDetail ? ` Mercado Pago ${status}${mpDetail}` : truncated ? `: ${truncated.slice(0, 200)}` : ''
  if (status === 401) {
    throw new MercadoPagoError('MERCADOPAGO_UNAUTHORIZED', `Nao autorizado${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 80) : '')}`, 401, detail)
  }
  if (status === 402) {
    // A Order/pagamento foi criada e a TRANSAÇÃO falhou no provedor: causa própria,
    // com o motivo (status_detail/details) preservado para diagnóstico.
    throw new MercadoPagoError(
      'MERCADOPAGO_TRANSACTION_FAILED',
      `Mercado Pago 402 transacao falhou${detailSuffix || sanitizedMp || (truncated ? ': ' + truncated.slice(0, 120) : '')}`,
      402,
      detail,
    )
  }
  if (status === 404) {
    throw new MercadoPagoError('MERCADOPAGO_NOT_FOUND', `Recurso nao encontrado${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 80) : '')}`, 404, detail)
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
        detail,
      )
    }
    throw new MercadoPagoError('MERCADOPAGO_REQUEST_FAILED', `Conflito ${status}${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 120) : '')}`, 409, detail)
  }
  if (status === 429) {
    throw new MercadoPagoError('MERCADOPAGO_RATE_LIMITED', 'Rate limit Mercado Pago', 429, detail)
  }
  if (status >= 500) {
    throw new MercadoPagoError('MERCADOPAGO_REQUEST_FAILED', `Erro gateway ${status}${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 80) : '')}`, status, detail)
  }
  throw new MercadoPagoError('MERCADOPAGO_REQUEST_FAILED', `Requisicao falhou ${status}${sanitizedMp || (truncated ? ': ' + truncated.slice(0, 80) : '')}`, status, detail)
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
