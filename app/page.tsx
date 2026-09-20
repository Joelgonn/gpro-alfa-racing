'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { EnterPlatformButton } from '@/app/components/EnterPlatformButton';
import {
  Menu,
  X,
  ArrowRight,
  Target,
  Gauge,
  TrendingUp,
  ShieldCheck,
  Settings2,
  Route,
  FlaskConical,
  Wrench,
  ShoppingBag,
  Handshake,
  CalendarDays,
  Zap,
  BarChart3,
  Layers,
  LockKeyhole,
  Check,
  Trophy,
  Users,
  Download,
  Smartphone,
  UserPlus,
} from 'lucide-react';

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#030712] text-zinc-100 antialiased overflow-x-hidden selection:bg-yellow-500 selection:text-zinc-900">
      {/* Skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      >
        Pular para conteúdo
      </a>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#030712]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#030712]/60">
        <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030712]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 text-[#030712] shadow-[0_0_20px_rgba(250,204,21,0.25)]">
              <Trophy size={18} strokeWidth={2.5} aria-hidden />
            </div>
            <div className="leading-none">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-black tracking-[0.18em] text-white">LOBO</span>
                <span className="text-[11px] font-black tracking-[0.18em] text-yellow-400">ALFA</span>
              </div>
              <div className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400">GPRO • ALFA RACING BRASIL</div>
            </div>
          </Link>

          <nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex">
            <a href="#recursos" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500">Recursos</a>
            <a href="#diferenciais" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500">Diferenciais</a>
            <a href="#fluxo" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500">Como funciona</a>
          </nav>

          <div className="flex items-center gap-2">
            <EnterPlatformButton
              className="hidden sm:inline-flex h-9 items-center justify-center gap-2 rounded-full bg-yellow-400 px-5 text-sm font-bold text-zinc-900 shadow-[0_0_20px_rgba(250,204,21,0.18)] hover:bg-yellow-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030712]"
            >
              Entrar na plataforma
              <ArrowRight size={16} aria-hidden />
            </EnterPlatformButton>
            <EnterPlatformButton
              className="inline-flex sm:hidden h-9 items-center justify-center rounded-full bg-yellow-400 px-4 text-sm font-bold text-zinc-900 hover:bg-yellow-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
              ariaLabel="Entrar na plataforma"
            >
              Entrar
            </EnterPlatformButton>
            <button
              type="button"
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileOpen}
              aria-controls="menu-mobile"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 lg:hidden"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile */}
        <div
          id="menu-mobile"
          className={`${mobileOpen ? 'block' : 'hidden'} lg:hidden border-t border-white/[0.06] bg-[#030712]`}
        >
          <nav className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1" aria-label="Menu mobile">
            <a onClick={() => setMobileOpen(false)} href="#recursos" className="rounded-xl px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500">Recursos</a>
            <a onClick={() => setMobileOpen(false)} href="#diferenciais" className="rounded-xl px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500">Diferenciais</a>
            <a onClick={() => setMobileOpen(false)} href="#fluxo" className="rounded-xl px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500">Como funciona</a>
            <EnterPlatformButton onBeforeNavigate={() => setMobileOpen(false)} className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-yellow-400 px-6 text-sm font-bold text-zinc-900 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500">
              Entrar na plataforma <ArrowRight size={16} aria-hidden />
            </EnterPlatformButton>
          </nav>
        </div>
      </header>

      <main id="conteudo">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* fundo decorativo */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628]/60 via-transparent to-transparent" />
            <div className="absolute -top-32 right-[-10%] h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[80px]" />
            <div className="absolute -bottom-40 left-[-10%] h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[90px]" />
            <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            {/* faixa quadriculada sutil no topo */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-yellow-400 to-blue-600 opacity-60" />
          </div>

          <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8 lg:py-16">
            {/* texto */}
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]" aria-hidden />
                Plataforma para gerentes GPRO • Alfa Racing Brasil
              </div>

              <h1 className="mt-4 text-[28px] font-black leading-[0.95] tracking-[-0.03em] sm:text-[36px] lg:text-[48px]">
                <span className="block text-white">Sua estratégia.</span>
                <span className="block text-white">Seu desempenho.</span>
                <span className="block bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">Seu próximo resultado.</span>
              </h1>

              <p className="mt-4 max-w-[56ch] text-sm leading-relaxed text-zinc-300 sm:text-base">
                Uma plataforma inteligente para organizar decisões, analisar desempenho e evoluir sua jornada no <span className="font-semibold text-zinc-100">GPRO Racing Online</span>. Setup, estratégia, testes e gestão — em um só lugar.
              </p>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-bold tracking-widest text-zinc-300">
                  <Smartphone size={14} aria-hidden /> EXPERIÊNCIA MOBILE
                </div>
                <h3 className="mt-3 text-base font-black tracking-tight text-white">O Alfa Racing também está no Android</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">Tenha acesso à plataforma pelo celular, com experiência otimizada para mobile.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href="https://github.com/Joelgonn/gpro-alfa-racing/releases/download/v1.0.0/app-release.apk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-extrabold text-zinc-900 hover:bg-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Download size={18} aria-hidden />
                    BAIXAR APP ANDROID
                  </a>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black tracking-wider text-zinc-300">v1.0.0</span>
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden /> ANDROID
                  </span>
                </div>
                <p className="mt-3 text-xs text-zinc-500">Instalação manual • Acesso web disponível</p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  <LockKeyhole size={14} className="text-zinc-300" aria-hidden /> Acesso seguro via Supabase
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" aria-hidden /> Dados protegidos por RLS
                </span>
              </div>
            </div>

            {/* arte - imagem principal sem sobreposição */}
            <div className="relative mx-auto w-full max-w-[520px] lg:mx-0 lg:ml-auto">
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-zinc-900 to-[#0b1226] p-2 shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
                <div className="overflow-hidden rounded-[20px] bg-black">
                  <Image
                    src="/splash/splash-gpro.png"
                    alt="Lobo Alfa - GPRO Alfa Racing Brasil"
                    width={1024}
                    height={1024}
                    priority
                    className="h-auto w-full object-cover"
                    sizes="(max-width: 1024px) 100vw, 520px"
                  />
                </div>
              </div>
              <div aria-hidden className="pointer-events-none absolute -inset-3 -z-10 rounded-[32px] bg-gradient-to-r from-emerald-500/10 via-yellow-500/10 to-blue-600/10 blur-xl" />

              {/* faixa independente - Telemetria / Setup / Estratégia */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Destaques do Hero">
                <div className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20">
                    <Gauge size={18} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-none text-white">Telemetria</div>
                    <div className="mt-1 text-xs leading-relaxed text-zinc-400">Leitura técnica da pista</div>
                  </div>
                </div>
                <div className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/20">
                    <BarChart3 size={18} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-none text-white">Setup</div>
                    <div className="mt-1 text-xs leading-relaxed text-zinc-400">Acerto por pista e clima</div>
                  </div>
                </div>
                <div className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/20">
                    <Route size={18} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-none text-white">Estratégia</div>
                    <div className="mt-1 text-xs leading-relaxed text-zinc-400">Plano de prova consciente</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Faixa pilares */}
        <section aria-label="Pilares" className="border-y border-white/[0.06] bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-px bg-white/[0.06] lg:grid-cols-4">
              {[
                { icon: Target, title: 'Estratégia', desc: 'Decisões guiadas por dados, não por palpite.' },
                { icon: Gauge, title: 'Performance', desc: 'Leitura clara de rendimento e consistência.' },
                { icon: TrendingUp, title: 'Evolução', desc: 'Ajustes contínuos, corrida após corrida.' },
                { icon: ShieldCheck, title: 'Controle', desc: 'Organização total da sua jornada no GPRO.' },
              ].map((p) => (
                <div key={p.title} className="bg-[#070b18] px-5 py-6 sm:px-6 sm:py-7">
                  <p.icon size={20} className="text-yellow-400" aria-hidden />
                  <h3 className="mt-3 text-sm font-bold tracking-wide text-white">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold tracking-[0.14em] text-zinc-300">
              <Layers size={14} className="text-yellow-400" aria-hidden /> MÓDULOS REAIS
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Tudo para decidir melhor.</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-base">Recursos conectados aos módulos existentes da plataforma — sem promessas vazias, apenas o que você já usa no dia a dia de gerente.</p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Settings2, title: 'Setup', desc: 'Cálculo de acerto por pista, clima e características do carro.', href: '/dashboard/setup' },
              { icon: Route, title: 'Estratégia', desc: 'Planejamento de combustível, pneus e paradas com base em cenários reais.', href: '/dashboard/strategy' },
              { icon: FlaskConical, title: 'Testes', desc: 'Análise de testes e desempenho para priorizar evolução.', href: '/dashboard/tests' },
              { icon: Wrench, title: 'Desgaste', desc: 'Acompanhamento de desgaste e condição de componentes.', href: '/dashboard/wear' },
              { icon: ShoppingBag, title: 'Mercado', desc: 'Visão organizada do mercado de pilotos e oportunidades.', href: '/dashboard/market' },
              { icon: Handshake, title: 'Patrocinadores', desc: 'Gestão e acompanhamento de patrocínios e receitas.', href: '/dashboard/sponsors' },
              { icon: CalendarDays, title: 'Calendário', desc: 'Temporada, etapas e planejamento integrado.', href: '/dashboard/calendar' },
            ].map((r) => (
              <Link
                key={r.title}
                href="/login"
                aria-label={`${r.title}: ${r.desc} — Entrar para acessar`}
                className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition-colors hover:bg-white/[0.07] hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900 text-yellow-400 shadow-inner group-hover:from-zinc-800 group-hover:to-zinc-800">
                  <r.icon size={18} aria-hidden />
                </div>
                <h3 className="mt-4 text-sm font-bold text-white">{r.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{r.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-zinc-300 group-hover:text-white">
                  Acessar <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-500">* O acesso aos módulos exige autenticação. Faça login para continuar.</p>
        </section>

        {/* Por que Lobo Alfa */}
        <section id="diferenciais" className="border-y border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
              {/* Texto institucional */}
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-300">
                  <Zap size={14} aria-hidden /> Por que Lobo Alfa
                </div>
                <h2 className="mt-3 max-w-[20ch] text-2xl font-black leading-[1.05] tracking-tight text-white sm:text-3xl">Estratégia não é improviso. É preparação.</h2>

                <div className="mt-5 max-w-[62ch] space-y-4 text-sm leading-relaxed text-zinc-300">
                  <p>O Lobo Alfa nasceu para transformar a experiência do GPRO Racing Online em uma jornada mais organizada, estratégica e consciente.</p>
                  <p>Aqui, cada decisão tem um propósito. Setup, estratégia, testes, desgaste, mercado e calendário fazem parte de uma visão integrada, criada para ajudar o manager a compreender melhor sua corrida e evoluir com consistência.</p>
                  <p>Não se trata apenas de acompanhar números. Trata-se de interpretar informações, comparar possibilidades e tomar decisões com mais clareza.</p>
                  <p>O Lobo Alfa representa disciplina para preparar, inteligência para decidir e constância para evoluir. Porque grandes resultados não dependem apenas de velocidade — dependem de estratégia, controle e aprendizado a cada corrida.</p>
                </div>

                {/* frase de destaque */}
                <blockquote className="relative mt-8 overflow-hidden rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-[#0a1226]/60 to-emerald-500/5 px-5 py-5 sm:px-6">
                  <div aria-hidden className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-yellow-400 via-amber-500 to-emerald-500" />
                  <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-yellow-400/10 blur-2xl" />
                  <p className="relative text-sm font-black leading-relaxed tracking-wide text-white sm:text-[15px]">
                    “Leia a corrida. Entenda as decisões. Evolua como manager.”
                  </p>
                  <div className="relative mt-2 h-px w-12 bg-white/10" aria-hidden />
                </blockquote>

                {/* linha telemetria discreta */}
                <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="h-px w-8 bg-white/10" aria-hidden />
                  <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Detalhe inspirado em telemetria • sem poluição visual</span>
                </div>
              </div>

              {/* Pilares */}
              <div className="grid grid-cols-1 gap-4">
                {[
                  { icon: ShieldCheck, title: 'Disciplina', desc: 'Preparar cada corrida com método, organização e atenção aos detalhes.' },
                  { icon: Target, title: 'Estratégia', desc: 'Transformar informações em decisões mais conscientes durante toda a jornada.' },
                  { icon: TrendingUp, title: 'Evolução', desc: 'Aprender com cada teste, cada resultado e cada escolha.' },
                  { icon: Trophy, title: 'Identidade', desc: 'Representar a força, a inteligência e a determinação do Lobo Alfa brasileiro.' },
                ].map((p) => (
                  <div key={p.title} className="flex gap-4 rounded-2xl border border-white/10 bg-[#0a0f1f] px-5 py-5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-yellow-400">
                      <p.icon size={18} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold leading-none text-white">{p.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Fluxo */}
        <section id="fluxo" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Entre, organize, analise e evolua.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">Quatro etapas simples que espelham o uso real da plataforma — do login à sua próxima decisão de box.</p>
          </div>

          <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Fluxo em quatro etapas">
            {[
              { n: '01', title: 'Entrar', desc: 'Acesse com sua conta. Seu acesso segue as regras de autenticação e RLS.' },
              { n: '02', title: 'Organizar', desc: 'Centralize setup, estratégia e calendário em um painel coerente.' },
              { n: '03', title: 'Analisar', desc: 'Cruze desempenho, desgaste e testes para enxergar o próximo ajuste.' },
              { n: '04', title: 'Evoluir', desc: 'Decida com mais segurança e registre sua evolução contínua.' },
            ].map((s) => (
              <li key={s.n} className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <div className="inline-flex h-7 items-center rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2.5 text-xs font-black tracking-widest text-yellow-300">{s.n}</div>
                <h3 className="mt-3 text-base font-bold text-white">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0e1a33] via-[#0a1226] to-black p-6 sm:p-10">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl" />
              <div className="absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
            </div>
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">Pronto para o próximo acerto?</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-300">Entre na plataforma e retome de onde parou — com seus dados, sua estratégia e seu ritmo.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <EnterPlatformButton
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-yellow-400 px-7 text-sm font-extrabold text-zinc-900 shadow-lg hover:bg-yellow-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
                >
                  Entrar na plataforma <ArrowRight size={18} aria-hidden />
                </EnterPlatformButton>
                <Link
                  href="/planos"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-7 text-sm font-semibold text-white hover:bg-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  Ver planos
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-black/40">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-yellow-400">
                  <Trophy size={16} aria-hidden />
                </div>
                <span className="text-sm font-black tracking-wide text-white">LOBO ALFA</span>
                <span className="text-sm font-light tracking-wide text-zinc-400">• Alfa Racing Brasil</span>
              </div>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-500">Plataforma independente para gerentes do GPRO. Motorsport premium, estratégia e evolução — sem vínculo oficial com o jogo.</p>
              <p className="mt-3 text-xs text-zinc-600">© {new Date().getFullYear()} Alfa Racing Brasil. Todos os direitos reservados.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-xs">
              <div>
                <div className="font-semibold tracking-wide text-zinc-300">Oficial</div>
                <a href="https://www.gpro.net" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 text-zinc-400 hover:text-white hover:underline underline-offset-4">gpro.net</a>
              </div>
              <div>
                <div className="font-semibold tracking-wide text-zinc-300">Legal</div>
                <Link href="/login" className="mt-2 inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 text-zinc-400 hover:text-white">Privacidade via login</Link>
              </div>
              <div>
                <div className="font-semibold tracking-wide text-zinc-300">Acesso</div>
                <Link href="/login" className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-semibold text-zinc-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500">
                  Entrar <ArrowRight size={12} aria-hidden />
                </Link>
              </div>
              <div>
                <div className="font-semibold tracking-wide text-zinc-300">Contato</div>
                <a href="mailto:joelgonn@gmail.com" className="mt-2 block text-zinc-400 hover:text-white hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 rounded">joelgonn@gmail.com</a>
                <a href="https://wa.me/5544988080039" target="_blank" rel="noopener noreferrer" className="mt-1 block text-zinc-400 hover:text-white hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 rounded">WhatsApp: (44) 98808-0039</a>
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-white/[0.06] pt-4 text-[11px] tracking-wide text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Conexão • Performance • Evolução
            <span className="ml-auto hidden sm:inline text-zinc-600">Feito para 320px → 1920px • Toque e teclado • Sem scroll horizontal</span>
          </div>
        </div>
      </footer>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
        }
      `}</style>
    </div>
  );
}
