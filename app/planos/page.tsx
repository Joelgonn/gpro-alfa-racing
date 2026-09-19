// app/planos/page.tsx
// PIX-001.4 — Página pública de planos VIP
//
// Decisões:
// - Server Component: os planos são lidos no SERVIDOR (service_role) e apenas campos
//   seguros vão ao HTML. Nenhuma credencial e nenhum dado interno chegam ao cliente.
// - Somente planos ATIVOS são exibidos (is_active = true).
// - Quando PIX_ENABLED=false, o botão fica desabilitado com explicação — o fluxo de
//   compra não é iniciado, evitando criar pedidos em ambiente sem integração pronta.
// - A compra exige sessão: sem login, o CTA leva a /login preservando o retorno.
// - Acessível pelo APK (WebView) e pelo navegador: nenhuma API de browser exótica.

import Link from 'next/link'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { getAuthenticatedUser } from '@/app/lib/auth'
import { CheckoutButton } from './checkout-button'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PlanRow = {
  code: string
  name: string
  description: string | null
  duration_days: number | null
  price_cents: number
  currency: string
}

function formatBRL(cents: number, currency: string) {
  try {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: currency || 'BRL' })
  } catch {
    return `R$ ${(cents / 100).toFixed(2)}`
  }
}

function durationLabel(days: number | null) {
  if (days === null) return 'Acesso vitalício'
  if (days === 30) return 'Acesso por 30 dias'
  if (days % 365 === 0) {
    const years = days / 365
    return `Acesso por ${years} ${years === 1 ? 'ano' : 'anos'}`
  }
  return `Acesso por ${days} dias`
}

export default async function PlanosPage() {
  // A flag de integração controla o CTA. Lida só no servidor.
  const pixEnabled = process.env.PIX_ENABLED === 'true'

  const user = await getAuthenticatedUser()

  const { data, error } = await supabaseAdmin
    .from('premium_plans')
    .select('code, name, description, duration_days, price_cents, currency')
    .eq('is_active', true)
    .order('price_cents', { ascending: true })

  const plans: PlanRow[] = error ? [] : ((data as PlanRow[]) || [])

  return (
    <main className="min-h-screen bg-[#030712] text-zinc-100 font-sans selection:bg-yellow-500/20">
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16 space-y-10">
        <header className="text-center space-y-3">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-400">Lobo Alfa</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Planos VIP</h1>
          <p className="text-sm text-zinc-400 max-w-2xl mx-auto">
            Escolha um plano para liberar os recursos premium. O pagamento é feito por <strong>Pix</strong>,
            com confirmação automática assim que o pagamento é identificado.
          </p>
        </header>

        {plans.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center" role="status">
            <p className="text-sm font-bold text-zinc-300">Nenhum plano disponível no momento.</p>
            <p className="mt-2 text-xs text-zinc-500">
              Os planos são publicados pela administração. Volte em instantes ou fale com a equipe.
            </p>
          </div>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <li
                key={plan.code}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-lg transition-colors hover:border-amber-400/40"
              >
                <h2 className="text-lg font-black text-zinc-100">{plan.name}</h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-amber-400">
                  {durationLabel(plan.duration_days)}
                </p>

                <p className="mt-4 text-3xl font-black tracking-tight text-zinc-50">
                  {formatBRL(plan.price_cents, plan.currency)}
                </p>

                {plan.description && (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{plan.description}</p>
                )}

                <div className="mt-6 flex flex-1 items-end">
                  {pixEnabled ? (
                    <CheckoutButton planCode={plan.code} isAuthenticated={Boolean(user)} />
                  ) : (
                    <div className="w-full">
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="w-full h-11 rounded-xl bg-white/[0.06] border border-white/10 px-6 text-xs font-black uppercase tracking-widest text-zinc-500 cursor-not-allowed"
                      >
                        Pagamento indisponível
                      </button>
                      <p className="mt-2 text-[11px] text-zinc-500">
                        A cobrança por Pix ainda está em preparação. Este botão será liberado assim que a
                        integração estiver validada.
                      </p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Como funciona o pagamento</h2>
          <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-400">
            <li>Você escolhe o plano e geramos um QR Code Pix com o valor exato.</li>
            <li>Pague pelo aplicativo do seu banco, lendo o QR Code ou usando o Pix Copia e Cola.</li>
            <li>A confirmação é automática. O acesso é liberado na sua conta após a identificação do pagamento.</li>
            <li>O QR Code tem prazo de validade. Se expirar, é só gerar um novo.</li>
          </ol>
          <p className="pt-2 text-[11px] text-zinc-500">
            O valor cobrado é sempre o valor cadastrado pela administração — nunca o informado pelo navegador.
          </p>
        </section>

        <div className="flex flex-col items-center gap-2 text-center">
          <Link
            href={user ? '/dashboard' : `/login?next=${encodeURIComponent('/planos')}`}
            className="text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300"
          >
            {user ? 'Ir para o painel' : 'Entrar'}
          </Link>
          {/* ALFA-015.0 — porta de entrada gratuita (o cadastro não concede Premium) */}
          {!user && (
            <Link
              href="/cadastro"
              className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-200"
            >
              Não tem conta? Criar conta grátis
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
