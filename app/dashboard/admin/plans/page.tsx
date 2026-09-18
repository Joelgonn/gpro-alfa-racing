'use client'

// app/dashboard/admin/plans/page.tsx
// PIX-001.3 — Edição de preços dos planos VIP (somente admin)
//
// Decisões de UX/segurança:
// - O preço é editado em REAIS (facilita) e convertido para CENTAVOS no envio.
// - Validação local espelha a do servidor; o servidor é a autoridade final.
// - Salva POR PLANO (um botão por linha), reduzindo risco de erro em massa.
// - Não cria nem remove planos: apenas edita os existentes.
// - Feedback inline acessível (aria-live) para sucesso e erro.

import { useEffect, useState, useMemo } from 'react'

type Plan = {
  id: string
  code: string
  name: string
  description: string | null
  duration_days: number | null
  price_cents: number
  currency: string
  is_active: boolean
  updated_at: string
}

type Draft = {
  name: string
  description: string
  priceReais: string
  durationDays: string
  lifetime: boolean
  isActive: boolean
}

const PRICE_MIN_REAIS = 1
const PRICE_MAX_REAIS = 10000

function toDraft(p: Plan): Draft {
  return {
    name: p.name,
    description: p.description ?? '',
    priceReais: (p.price_cents / 100).toFixed(2).replace('.', ','),
    durationDays: p.duration_days === null ? '' : String(p.duration_days),
    lifetime: p.duration_days === null,
    isActive: p.is_active,
  }
}

function parseReaisToCents(raw: string): number | null {
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

function formatCents(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/plans', { method: 'GET', cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar planos')
      const list: Plan[] = json.plans || []
      setPlans(list)
      setDrafts(Object.fromEntries(list.map((p) => [p.code, toDraft(p)])))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar planos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const dirty = useMemo(() => {
    const set = new Set<string>()
    for (const p of plans) {
      const d = drafts[p.code]
      if (!d) continue
      const cents = parseReaisToCents(d.priceReais)
      const original = toDraft(p)
      if (
        d.name !== original.name ||
        d.description !== original.description ||
        d.durationDays !== original.durationDays ||
        d.lifetime !== original.lifetime ||
        d.isActive !== original.isActive ||
        cents !== p.price_cents
      ) set.add(p.code)
    }
    return set
  }, [plans, drafts])

  function updateDraft(code: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }))
  }

  async function save(plan: Plan) {
    const d = drafts[plan.code]
    if (!d) return
    setError(null)
    setMessage(null)

    const cents = parseReaisToCents(d.priceReais)
    if (cents === null || cents < PRICE_MIN_REAIS * 100 || cents > PRICE_MAX_REAIS * 100) {
      setError(`Preço inválido para ${plan.code}. Use um valor entre R$ ${PRICE_MIN_REAIS},00 e R$ ${PRICE_MAX_REAIS.toLocaleString('pt-BR')},00.`)
      return
    }
    if (!d.lifetime) {
      const days = Number(d.durationDays)
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        setError(`Validade inválida para ${plan.code}. Informe entre 1 e 3650 dias, ou marque "Vitalício".`)
        return
      }
    }

    setSavingCode(plan.code)
    try {
      const body: Record<string, unknown> = {
        code: plan.code,
        name: d.name,
        description: d.description,
        priceCents: cents,
        isActive: d.isActive,
        durationDays: d.lifetime ? null : Number(d.durationDays),
      }
      const res = await fetch('/api/admin/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar')
      setMessage(`Plano ${plan.code} atualizado: ${formatCents(json.plan.price_cents)}.`)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSavingCode(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-800">Planos e preços</h1>
        <p className="text-sm text-slate-500 mt-1">
          Edite o preço de venda dos planos VIP. O preço aqui é a <strong>única fonte</strong> usada na cobrança —
          o valor enviado pelo navegador é sempre ignorado.
        </p>
      </header>

      <div aria-live="polite" aria-atomic="true">
        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-sm">{message}</div>
        )}
        {error && (
          <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Planos cadastrados ({plans.length})</h2>
          <button
            type="button"
            onClick={load}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando…</div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">Nenhum plano cadastrado.</p>
            <p className="text-xs text-slate-400 mt-1">
              Os planos são criados por migration (PIX-001.3). Esta tela apenas edita os existentes.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {plans.map((plan) => {
              const d = drafts[plan.code] ?? toDraft(plan)
              const isDirty = dirty.has(plan.code)
              const busy = savingCode === plan.code
              return (
                <div key={plan.code} className="p-4 md:p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">{plan.code}</span>
                    <span className="text-xs text-slate-400">atual: {formatCents(plan.price_cents)}</span>
                    {!plan.is_active && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">inativo</span>
                    )}
                    {isDirty && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700">alterado</span>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-slate-600">Nome</span>
                      <input
                        type="text"
                        value={d.name}
                        maxLength={120}
                        onChange={(e) => updateDraft(plan.code, { name: e.target.value })}
                        className="border border-slate-200 rounded-lg px-3 py-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-slate-600">Preço (R$)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={d.priceReais}
                        onChange={(e) => updateDraft(plan.code, { priceReais: e.target.value })}
                        aria-describedby={`preco-ajuda-${plan.code}`}
                        className="border border-slate-200 rounded-lg px-3 py-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      />
                      <span id={`preco-ajuda-${plan.code}`} className="text-[11px] text-slate-400">
                        Aceita vírgula. Convertido para centavos inteiros no servidor.
                      </span>
                    </label>

                    <label className="flex flex-col gap-1 text-sm md:col-span-2">
                      <span className="font-medium text-slate-600">Descrição</span>
                      <textarea
                        value={d.description}
                        maxLength={500}
                        rows={2}
                        onChange={(e) => updateDraft(plan.code, { description: e.target.value })}
                        className="border border-slate-200 rounded-lg px-3 py-2 bg-white resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      />
                    </label>

                    <div className="flex flex-col gap-2 text-sm">
                      <span className="font-medium text-slate-600">Validade</span>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={d.lifetime}
                            onChange={(e) => updateDraft(plan.code, { lifetime: e.target.checked, durationDays: e.target.checked ? '' : (d.durationDays || '30') })}
                            className="rounded border-slate-300"
                          />
                          <span className="text-slate-600">Vitalício</span>
                        </label>
                        {!d.lifetime && (
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={3650}
                              value={d.durationDays}
                              onChange={(e) => updateDraft(plan.code, { durationDays: e.target.value })}
                              className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            />
                            <span className="text-slate-600">dias</span>
                          </label>
                        )}
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm self-end">
                      <input
                        type="checkbox"
                        checked={d.isActive}
                        onChange={(e) => updateDraft(plan.code, { isActive: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <span className="text-slate-600">Disponível para venda</span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => updateDraft(plan.code, toDraft(plan))}
                      disabled={!isDirty || busy}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => save(plan)}
                      disabled={!isDirty || busy}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      {busy ? 'Salvando…' : 'Salvar preço'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Alterar o preço <strong>não</strong> afeta pedidos já criados: cada pedido guarda o valor capturado no momento da criação.
      </p>
    </div>
  )
}
