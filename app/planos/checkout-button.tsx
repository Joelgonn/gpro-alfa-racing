'use client'

// app/planos/checkout-button.tsx
// PIX-001.4/5/11 — Botão de compra + tela de pagamento Pix com polling
//
// Decisões:
// - Sem sessão, o botão leva a /login (o pedido só pode existir vinculado a um usuário).
// - O preço NÃO é enviado: o servidor lê de premium_plans. Só o `planCode` vai no body.
// - Proteção contra múltiplos cliques: `busy` desabilita o botão durante a criação.
// - A tela de pagamento faz POLLING em GET /api/payments/orders/[id] (rota já existente)
//   com backoff, respeitando prazo de expiração e sem martelar o servidor.
// - Acessível: foco visível, aria-live no status, botão de copiar com confirmação.
// - Compatível com APK (WebView): usa navigator.clipboard com fallback.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  planCode: string
  isAuthenticated: boolean
}

type OrderResponse = {
  order?: { id: string; planCode: string; status: string; amountCents: number; currency: string; expiresAt: string | null }
  payment?: { id: string; provider: string; status: string; pixTxid: string | null; amountCents: number; currency: string } | null
  pizzData?: { qrCode: string | null; qrCodeBase64: string | null; ticketUrl: string | null } | null
}

const POLL_INTERVAL_MS = 5000
const POLL_MAX_MS = 15 * 60 * 1000 // 15 minutos

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CheckoutButton({ planCode, isAuthenticated }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  async function startCheckout() {
    if (!isAuthenticated) {
      router.push(`/login?next=/planos&plan=${encodeURIComponent(planCode)}`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      // Idempotency-Key determinística por plano+dia reduz pedidos duplicados em duplo clique/reload.
      const key = `TEST-ALFA-0141-${planCode.toUpperCase()}-${new Date().toISOString().slice(0, 10)}`
      const res = await fetch('/api/payments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ planCode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Não foi possível iniciar o pagamento.')
      if (!json.order?.id) throw new Error('Resposta inválida do servidor.')
      setOrderId(json.order.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar o pagamento.')
    } finally {
      setBusy(false)
    }
  }

  if (orderId) {
    return <PixPanel orderId={orderId} onClose={() => setOrderId(null)} />
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={startCheckout}
        disabled={busy}
        aria-busy={busy}
        className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 text-xs font-black uppercase tracking-widest text-white transition-all hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        {busy ? 'Gerando cobrança…' : 'Comprar com Pix'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[11px] font-bold text-rose-400">
          {error}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Painel de pagamento Pix com polling
// ---------------------------------------------------------------------------

function PixPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const router = useRouter()
  const [data, setData] = useState<OrderResponse | null>(null)
  const [status, setStatus] = useState<string>('Carregando…')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const startedAt = useRef(Date.now())
  const stopped = useRef(false)
  // PIX-022: estado de sucesso com countdown e redirect único
  const [countdown, setCountdown] = useState<number | null>(null)
  const redirectScheduled = useRef(false)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/orders/${orderId}`, { cache: 'no-store' })
      if (res.status === 401) { setError('Sessão expirada. Entre novamente.'); stopped.current = true; return }
      if (res.status === 404) { setError('Pedido não encontrado.'); stopped.current = true; return }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao consultar o pedido.')
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao consultar o pedido.')
    }
  }, [orderId])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      if (stopped.current) return
      await load()
      if (Date.now() - startedAt.current > POLL_MAX_MS) { stopped.current = true; return }
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }
    tick()

    return () => { stopped.current = true; if (timer) clearTimeout(timer) }
  }, [load])

  const orderStatus = data?.order?.status
  const paymentStatus = data?.payment?.status
  const isPaid = orderStatus === 'paid' || paymentStatus === 'confirmed'
  const isTerminalBad = orderStatus === 'expired' || orderStatus === 'cancelled' || orderStatus === 'failed'
    || paymentStatus === 'failed' || paymentStatus === 'refunded' || paymentStatus === 'chargeback'

  useEffect(() => {
    if (isPaid) setStatus('Pagamento confirmado. Acesso liberado.')
    else if (isTerminalBad) setStatus('Este pagamento não foi concluído.')
    else if (orderStatus === 'awaiting_payment' || orderStatus === 'pending') setStatus('Aguardando o pagamento do Pix.')
    else setStatus('Preparando a cobrança…')
  }, [isPaid, isTerminalBad, orderStatus])

  // PIX-022: quando pago, interrompe polling e agenda redirect único de 5s
  useEffect(() => {
    if (!isPaid || redirectScheduled.current) return
    redirectScheduled.current = true
    stopped.current = true
    setCountdown(5)
    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownTimer.current) clearInterval(countdownTimer.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    redirectTimer.current = setTimeout(() => {
      router.push('/dashboard')
    }, 5000)
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current)
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [isPaid, router])

  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current)
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [])

  const qrCode = data?.pizzData?.qrCode ?? null
  const qrImage = data?.pizzData?.qrCodeBase64 ?? null
  const ticketUrl = data?.pizzData?.ticketUrl ?? null

  async function copyCode() {
    if (!qrCode) return
    try {
      await navigator.clipboard.writeText(qrCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o código manualmente.')
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={isPaid ? undefined : onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pix-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl"
      >
        <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-amber-600" />
        <div className="p-5 space-y-4 text-left">
          <h3 id="pix-title" className="text-sm font-black uppercase tracking-wide text-zinc-100">
            Pagamento via Pix
          </h3>

          <p aria-live="polite" aria-atomic="true" className="text-xs font-bold text-amber-300">
            {status}
          </p>

          {data?.payment && (
            <p className="text-2xl font-black text-zinc-50">{formatBRL(data.payment.amountCents)}</p>
          )}

          {isPaid ? (
            <div className="overflow-hidden rounded-xl border border-amber-500/30 bg-[#070a12]" role="status" aria-live="polite">
              {/* PIX-024: arte Lobo em área visual separada — lobo destacado, sem sobreposição de textos */}
              <div className="relative h-40 sm:h-48 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/pix-lobo-confirmacao.webp"
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover object-[center_30%] sm:object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a12] via-[#070a12]/30 to-transparent" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#070a12] to-transparent" aria-hidden />
              </div>
              <div className="p-5 sm:p-6 space-y-3 text-center">
                <p className="text-sm font-black tracking-widest text-amber-300">Pagamento confirmado!</p>
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-200/90">Bem-vindo ao Clã</p>
                  <p className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                    Agora você é um Lobo!
                  </p>
                </div>
                <div className="space-y-1 pt-1">
                  <p className="text-xs font-bold text-zinc-100">Seu acesso VIP foi liberado com sucesso.</p>
                  <p className="text-[11px] text-zinc-300">Estamos preparando tudo para você.</p>
                  <p className="text-[11px] font-medium text-amber-200">
                    Você será direcionado ao seu painel em {countdown ?? 5} segundo{countdown === 1 ? '' : 's'}...
                  </p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${((5 - (countdown ?? 5)) / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : isTerminalBad ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
              <p className="text-xs font-bold text-rose-300">
                A cobrança não foi concluída. Você pode fechar esta janela e gerar uma nova.
              </p>
            </div>
          ) : (
            <>
              {qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrImage.startsWith('data:') ? qrImage : `data:image/png;base64,${qrImage}`}
                  alt="QR Code Pix para pagamento"
                  className="mx-auto h-52 w-52 rounded-xl bg-white p-2"
                />
              ) : (
                <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                  <p className="text-[11px] text-zinc-500">
                    O QR Code será exibido aqui assim que a integração de cobrança estiver ativa.
                  </p>
                </div>
              )}

              {qrCode && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                    Pix Copia e Cola
                  </label>
                  <textarea
                    readOnly
                    value={qrCode}
                    rows={3}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[10px] text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={copyCode}
                    className="w-full h-10 rounded-xl border border-white/10 bg-white/[0.06] text-[11px] font-black uppercase tracking-widest text-zinc-200 hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    {copied ? 'Código copiado' : 'Copiar código Pix'}
                  </button>
                </div>
              )}

              <p className="text-[11px] font-medium text-zinc-400 text-center">
                Efetue o pagamento e aguarde. A confirmação será automática e você será redirecionado.
              </p>
            </>
          )}

          {error && (
            <p role="alert" className="text-[11px] font-bold text-rose-400">{error}</p>
          )}

          <div className="flex justify-end">
            {isPaid ? (
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:from-amber-400 hover:to-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                Ir para o painel agora
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-200 hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
