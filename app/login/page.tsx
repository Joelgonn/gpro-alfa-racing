'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaUserAstronaut, FaLock, FaTicketAlt, FaSignInAlt, FaArrowLeft, FaUserPlus } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { signUpWithInviteCode } from '../actions/signup';
import { getLoginDestination } from '../actions/getLoginDestination';
import { safeInternalPath, resolvePostLoginDestination } from '../lib/auth-flow';
// resolvePostLoginDestination mantido para compatibilidade com testes legados (FASE 0 usa getLoginDestination via hasAccess)

export default function LoginPage() {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  // ALFA-015.0 — retorno pedido por quem interrompeu o fluxo (ex.: /login?next=/planos)
  const [nextPath, setNextPath] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Lido no cliente para não exigir Suspense: usado apenas depois do login.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setNextPath(safeInternalPath(params.get('next')));
      const confirmacao = params.get('confirmacao');
      if (confirmacao === 'falhou') {
        setMessage('Não foi possível confirmar seu e-mail: o link pode ter expirado. Entre com sua senha ou crie a conta novamente.');
      } else if (confirmacao === 'pendente') {
        setMessage('Confirme o e-mail enviado para ativar sua conta e depois faça login.');
      }
    } catch {
      /* sem query string: fluxo normal */
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage('Erro: ' + error.message);
        setLoading(false);
        return;
      }

      // FASE 0 — destino via autoridade real (access_grants), sem flash.
      // getAccessState() → hasAccess → /dashboard ou /planos?motivo=expired
      try {
        const destination = await getLoginDestination(nextPath);
        router.push(destination);
        router.refresh();
      } catch {
        // Falha ao consultar estado real — fallback seguro preserva comportamento
        router.push(nextPath ?? '/dashboard/manager');
        router.refresh();
      }
    } catch (err) {
      setMessage('Ocorreu um erro inesperado ao tentar fazer login.');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!inviteCode) {
      setMessage('O código de convite é obrigatório.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('inviteCode', inviteCode);

    try {
      const result = await signUpWithInviteCode(formData);

      if (result.success) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!loginError) {
          router.push('/dashboard/manager');
        } else {
          setMessage('Conta criada! Faça login manualmente.');
          setIsLoginMode(true);
        }
      } else {
        setMessage(result.message || 'Erro ao criar conta.');
      }
    } catch (error) {
      setMessage('Erro de conexão ao tentar cadastrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#030712] text-zinc-100 antialiased overflow-x-hidden selection:bg-yellow-400 selection:text-zinc-900">
      {/* fundo premium */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628]/50 via-transparent to-emerald-950/10" />
        <div className="absolute -top-24 right-[-8%] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-[80px]" />
        <div className="absolute -bottom-32 left-[-10%] h-[520px] w-[520px] rounded-full bg-blue-600/10 blur-[90px]" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500 via-yellow-400 to-blue-600 opacity-60" />
      </div>

      <a href="#form-login" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-yellow-500">
        Pular para formulário
      </a>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:gap-10 lg:px-8 lg:py-10">
        {/* Identidade - desktop lateral */}
        <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-[420px] lg:shrink-0">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold tracking-wide text-zinc-300 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
          >
            <FaArrowLeft aria-hidden className="text-[11px]" /> Voltar ao início
          </button>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white">
              <Image src="/splash/splash-gpro.png" alt="Lobo Alfa" width={40} height={40} className="h-10 w-10 object-cover" priority />
            </div>
            <div className="leading-none">
              <div className="text-xs font-black tracking-[0.18em] text-white">LOBO <span className="text-yellow-400">ALFA</span></div>
              <div className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400">GPRO • ALFA RACING BRASIL</div>
            </div>
          </div>

          <h1 className="mt-6 text-2xl font-black leading-tight tracking-tight text-white sm:text-[28px]">
            A corrida começa na decisão.
          </h1>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-300">
            <p>Velocidade é apenas parte do resultado.</p>
            <p>O verdadeiro diferencial está na preparação, na leitura dos dados e na capacidade de evoluir depois de cada corrida.</p>
            <p>O Lobo Alfa reúne essa mentalidade em uma experiência criada para managers que levam sua evolução a sério.</p>
          </div>

          <blockquote className="relative mt-5 overflow-hidden rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-[#0a0f1f]/60 to-emerald-500/5 px-4 py-3">
            <div aria-hidden className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-yellow-400 to-emerald-500" />
            <p className="text-sm font-bold leading-relaxed text-white">Prepare melhor. Decida com inteligência. Evolua a cada corrida.</p>
          </blockquote>

          <div className="mt-6 grid gap-3">
            <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
              <div>
                <div className="text-sm font-bold text-white">Estratégia</div>
                <div className="text-xs leading-relaxed text-zinc-400">Decisões mais conscientes antes e durante a corrida.</div>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-yellow-400" aria-hidden />
              <div>
                <div className="text-sm font-bold text-white">Performance</div>
                <div className="text-xs leading-relaxed text-zinc-400">Leitura dos dados que ajudam você a entender seu resultado.</div>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" aria-hidden />
              <div>
                <div className="text-sm font-bold text-white">Evolução</div>
                <div className="text-xs leading-relaxed text-zinc-400">Cada teste, cada desgaste e cada corrida fazem parte do aprendizado.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card principal */}
        <div className="mx-auto mt-6 w-full max-w-md lg:mx-0 lg:ml-auto lg:mt-0">
          <div id="form-login" className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0a0f1f] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur sm:p-7">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />

            {/* Abas */}
            <div role="tablist" aria-label="Modo de acesso" className="flex gap-1 rounded-full border border-white/10 bg-black/40 p-1">
              <button
                id="tab-login"
                role="tab"
                type="button"
                aria-selected={isLoginMode}
                aria-controls="panel-login"
                onClick={() => { setIsLoginMode(true); setMessage(''); }}
                className={`flex-1 rounded-full px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 ${isLoginMode ? 'bg-yellow-400 text-zinc-900 shadow' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'}`}
              >
                Login
              </button>
              <button
                id="tab-cadastro"
                role="tab"
                type="button"
                aria-selected={!isLoginMode}
                aria-controls="panel-cadastro"
                onClick={() => { setIsLoginMode(false); setMessage(''); }}
                className={`flex-1 rounded-full px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 ${!isLoginMode ? 'bg-yellow-400 text-zinc-900 shadow' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'}`}
              >
                Cadastro
              </button>
            </div>

            {/* Título da aba */}
            <div className="mt-6">
              {isLoginMode ? (
                <>
                  <h2 className="text-base font-black tracking-tight text-white">Entre no seu paddock.</h2>
                  <p className="mt-1 text-sm font-semibold text-zinc-300">Sua próxima decisão começa aqui.</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">Acesse sua plataforma e continue construindo sua evolução no GPRO.</p>
                </>
              ) : (
                <>
                  <h2 className="text-base font-black tracking-tight text-white">Seu lugar na equipe começa aqui.</h2>
                  <p className="mt-1 text-sm font-semibold text-zinc-300">Você recebeu uma credencial. Agora é hora de entrar para o grid.</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">Valide seu código VIP, crie seu acesso e prepare-se para acompanhar sua jornada no Lobo Alfa.</p>

                  {/* Porta de entrada para novos usuários */}
                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3">
                    <p className="text-xs leading-relaxed text-emerald-200">
                      Não tem código VIP? Crie sua conta para conhecer as formas de acesso à plataforma.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push('/cadastro')}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-xs font-extrabold uppercase tracking-widest text-emerald-200 transition-colors hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Criar minha conta <FaUserPlus aria-hidden />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mensagem */}
            {message && (
              <div
                role="alert"
                aria-live="polite"
                className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${message.toLowerCase().includes('sucesso') || message.includes('criada') ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}
              >
                {message}
              </div>
            )}

            {/* Formulário único com branching */}
            <form onSubmit={isLoginMode ? handleLogin : handleSignUp} className="mt-6 space-y-4" noValidate>
              <div id="panel-login" role="tabpanel" aria-labelledby={isLoginMode ? 'tab-login' : 'tab-cadastro'} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="ml-1 text-xs font-bold uppercase tracking-wider text-zinc-400">E-mail</label>
                  <div className="relative group">
                    <FaUserAstronaut aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-yellow-400 text-base" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="piloto@alfaracing.com"
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-11 pr-4 text-base text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/50 focus:bg-white/[0.04] focus:ring-2 focus:ring-yellow-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="ml-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Senha</label>
                  <div className="relative group">
                    <FaLock aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-yellow-400 text-base" />
                    <input
                      id="password"
                      type="password"
                      required
                      autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-11 pr-4 text-base text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/50 focus:bg-white/[0.04] focus:ring-2 focus:ring-yellow-500/20"
                    />
                  </div>
                </div>

                {/* Código VIP - apenas Cadastro, totalmente visível */}
                <div className={`${isLoginMode ? 'hidden' : 'block'} space-y-1.5`}>
                  <label htmlFor="inviteCode" className="ml-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-yellow-300">
                    <FaTicketAlt aria-hidden /> CÓDIGO DE CREDENCIAMENTO VIP
                  </label>
                  <input
                    id="inviteCode"
                    type="text"
                    required={!isLoginMode}
                    aria-required={!isLoginMode}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="ALFA-VIP-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-12 w-full rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 text-center font-mono text-base uppercase tracking-[0.14em] text-yellow-100 placeholder-yellow-700/50 outline-none transition-colors focus:border-yellow-400 focus:bg-yellow-500/10 focus:ring-2 focus:ring-yellow-500/20"
                  />
                  <p className="px-1 text-xs text-zinc-500">Informe o código VIP exatamente como recebido. Campo obrigatório no cadastro.</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-extrabold uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1f] ${isLoginMode ? 'bg-yellow-400 text-zinc-900 hover:bg-yellow-300' : 'bg-yellow-400 text-zinc-900 hover:bg-yellow-300'}`}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" aria-hidden /> Processando</span>
                ) : (
                  <>
                    {isLoginMode ? 'ACESSAR PADDOCK' : 'VALIDAR CREDENCIAL'} <FaSignInAlt aria-hidden />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
              <span className="h-px flex-1 bg-white/10" aria-hidden />
              <span className="shrink-0">Supabase • RLS • Sessão segura</span>
              <span className="h-px flex-1 bg-white/10" aria-hidden />
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center gap-1 text-center">
            <button
              type="button"
              onClick={() => router.push('/cadastro')}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
            >
              Não tenho conta — criar minha conta <FaUserPlus aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
            >
              <FaArrowLeft aria-hidden /> Voltar para Página Inicial
            </button>
          </div>
        </div>
      </div>

      <style>{`@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;transition-duration:0.01ms!important}}`}</style>
    </div>
  );
}
