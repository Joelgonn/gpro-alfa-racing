'use client'

// app/cadastro/page.tsx
// ============================================
// ALFA-015.0 — /cadastro (porta de entrada GRATUITA)
// ============================================
// Fluxo: /cadastro → Supabase Auth → usuário FREE → /planos → compra PIX.
//
// Regras preservadas nesta página:
// - criar conta NÃO concede Premium/VIP/access_grant (ver app/actions/freeSignup.ts);
// - reutiliza o mesmo padrão visual, tipografia e tema do /login;
// - reutiliza o MESMO mecanismo de autenticação (Supabase Auth), sem criar outro;
// - depois do sucesso o destino é /planos (nunca o painel Premium).
// ============================================

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  FaUserAstronaut,
  FaLock,
  FaEnvelopeOpenText,
  FaUserPlus,
  FaArrowLeft,
  FaCheckCircle,
} from 'react-icons/fa'
import { supabase } from '../lib/supabase'
import { signUpFreeUser } from '../actions/freeSignup'
import {
  FREE_LANDING_PATH,
  confirmPasswordFieldError,
  emailFieldError,
  nameFieldError,
  passwordFieldError,
  type FreeSignupField,
} from '../lib/auth-flow'

const LOGIN_WITH_NEXT = `/login?next=${encodeURIComponent(FREE_LANDING_PATH)}`

const FIELD_IDS: Record<FreeSignupField, string> = {
  name: 'signup-name',
  email: 'signup-email',
  password: 'signup-password',
  confirmPassword: 'signup-confirm',
}

const INPUT_CLASS =
  'h-12 w-full rounded-xl border bg-black/40 pl-11 pr-4 text-base text-white placeholder-zinc-600 outline-none transition-colors focus:bg-white/[0.04] focus:ring-2'

function inputClass(hasError: boolean): string {
  return `${INPUT_CLASS} ${
    hasError
      ? 'border-red-500/50 focus:border-red-400 focus:ring-red-500/20'
      : 'border-white/10 focus:border-yellow-500/50 focus:ring-yellow-500/20'
  }`
}

export default function CadastroPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FreeSignupField, string>>>({})
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'error' | 'info'>('error')
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Usuário já autenticado não precisa do formulário: segue direto para /planos.
  useEffect(() => {
    let active = true
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active && data?.user) {
          router.replace(FREE_LANDING_PATH)
        }
      })
      .catch(() => {
        /* sessão ausente/erro: mantém o formulário */
      })
    return () => {
      active = false
    }
  }, [router])

  function collectErrors(): Partial<Record<FreeSignupField, string>> {
    const errors: Partial<Record<FreeSignupField, string>> = {}
    const nameError = nameFieldError(name)
    const emailError = emailFieldError(email)
    const passwordError = passwordFieldError(password)
    const confirmError = confirmPasswordFieldError(password, confirmPassword)
    if (nameError) errors.name = nameError
    if (emailError) errors.email = emailError
    if (passwordError) errors.password = passwordError
    if (confirmError) errors.confirmPassword = confirmError
    return errors
  }

  /** Revalida um campo depois da primeira tentativa (feedback imediato, sem travar digitação). */
  function revalidateField(field: FreeSignupField) {
    if (!submitted) return
    const errors = collectErrors()
    setFieldErrors((prev) => ({ ...prev, [field]: errors[field] }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setMessage('')
    setMessageTone('error')

    const errors = collectErrors()
    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      const firstField = (Object.keys(FIELD_IDS) as FreeSignupField[]).find((field) => errors[field])
      if (firstField) document.getElementById(FIELD_IDS[firstField])?.focus()
      return
    }

    setSubmitting(true)

    try {
      // Somente os quatro campos do formulário são enviados. Nada de role/premium/plano.
      const formData = new FormData()
      formData.append('name', name)
      formData.append('email', email)
      formData.append('password', password)
      formData.append('confirmPassword', confirmPassword)

      const result = await signUpFreeUser(formData)

      if (!result.ok) {
        const nextErrors: Partial<Record<FreeSignupField, string>> = {}
        for (const field of result.fields) nextErrors[field] = result.message
        setFieldErrors(nextErrors)
        setMessage(result.message)
        setMessageTone('error')
        const firstField = result.fields[0]
        if (firstField) document.getElementById(FIELD_IDS[firstField])?.focus()
        return
      }

      // Sucesso com sessão válida → porta de entrada comercial.
      if (result.authenticated) {
        setMessage(result.message)
        setMessageTone('info')
        router.push(result.redirectTo || FREE_LANDING_PATH)
        router.refresh()
        return
      }

      // Sucesso com confirmação de e-mail pendente (fluxo do Supabase Auth preservado).
      setConfirmationEmail(result.email || email)
      setMessage(result.message)
      setMessageTone('info')
    } catch {
      setMessage('Não foi possível concluir o cadastro agora. Tente novamente em instantes.')
      setMessageTone('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#030712] text-zinc-100 antialiased overflow-x-hidden selection:bg-yellow-400 selection:text-zinc-900">
      {/* fundo premium (mesmo padrão do /login) */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628]/50 via-transparent to-emerald-950/10" />
        <div className="absolute -top-24 right-[-8%] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-[80px]" />
        <div className="absolute -bottom-32 left-[-10%] h-[520px] w-[520px] rounded-full bg-blue-600/10 blur-[90px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500 via-yellow-400 to-blue-600 opacity-60" />
      </div>

      <a
        href="#form-cadastro"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      >
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
              <div className="text-xs font-black tracking-[0.18em] text-white">
                LOBO <span className="text-yellow-400">ALFA</span>
              </div>
              <div className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400">GPRO • ALFA RACING BRASIL</div>
            </div>
          </div>

          <h1 className="mt-6 text-2xl font-black leading-tight tracking-tight text-white sm:text-[28px]">
            Crie sua conta gratuita.
          </h1>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-300">
            <p>O cadastro é gratuito e leva menos de um minuto.</p>
            <p>
              Você entra na plataforma, conhece os recursos e decide com calma se quer liberar o acesso Premium —
              que é opcional e feito por Pix.
            </p>
          </div>

          <blockquote className="relative mt-5 overflow-hidden rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-[#0a0f1f]/60 to-emerald-500/5 px-4 py-3">
            <div aria-hidden className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-yellow-400 to-emerald-500" />
            <p className="text-sm font-bold leading-relaxed text-white">
              Conta gratuita não libera recursos Premium. O acesso VIP só é ativado após a confirmação do pagamento.
            </p>
          </blockquote>

          <div className="mt-6 grid gap-3">
            <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
              <div>
                <div className="text-sm font-bold text-white">Conta gratuita</div>
                <div className="text-xs leading-relaxed text-zinc-400">Acesso imediato à plataforma e à página de planos.</div>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-yellow-400" aria-hidden />
              <div>
                <div className="text-sm font-bold text-white">Sem cobrança automática</div>
                <div className="text-xs leading-relaxed text-zinc-400">Nenhum cartão é pedido no cadastro. Nada é cobrado.</div>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" aria-hidden />
              <div>
                <div className="text-sm font-bold text-white">Premium quando quiser</div>
                <div className="text-xs leading-relaxed text-zinc-400">Escolha um plano e pague por Pix, com liberação automática.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card principal */}
        <div className="mx-auto mt-6 w-full max-w-md lg:mx-0 lg:ml-auto lg:mt-0">
          <div
            id="form-cadastro"
            className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0a0f1f] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur sm:p-7"
          >
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />

            {confirmationEmail ? (
              /* -------- Estado: e-mail de confirmação enviado -------- */
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                  <FaEnvelopeOpenText aria-hidden className="text-xl text-emerald-300" />
                </div>
                <h2 className="mt-4 text-base font-black tracking-tight text-white">Confirme seu e-mail</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Enviamos um link de confirmação para <span className="font-bold text-white">{confirmationEmail}</span>.
                  Abra o e-mail e confirme para ativar o acesso.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                  Depois de confirmar, entre na plataforma: você será direcionado aos planos.
                </p>

                <Link
                  href={LOGIN_WITH_NEXT}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-yellow-400 text-sm font-extrabold uppercase tracking-widest text-zinc-900 shadow-lg transition-all hover:bg-yellow-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
                >
                  Já confirmei, entrar <FaCheckCircle aria-hidden />
                </Link>
                <Link
                  href="/"
                  className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
                >
                  <FaArrowLeft aria-hidden /> Voltar para Página Inicial
                </Link>
              </div>
            ) : (
              /* -------- Estado: formulário -------- */
              <>
                <h2 className="text-base font-black tracking-tight text-white">Criar conta grátis</h2>
                <p className="mt-1 text-sm font-semibold text-zinc-300">Sem cartão, sem cobrança, sem compromisso.</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Preencha seus dados para acessar a plataforma. O acesso Premium é opcional e liberado só após o pagamento.
                </p>

                {message && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${
                      messageTone === 'info'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : 'border-red-500/20 bg-red-500/10 text-red-300'
                    }`}
                  >
                    {message}
                  </div>
                )}

                <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                  {/* Nome */}
                  <div className="space-y-1.5">
                    <label htmlFor={FIELD_IDS.name} className="ml-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Nome
                    </label>
                    <div className="relative group">
                      <FaUserAstronaut
                        aria-hidden
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-zinc-500 group-focus-within:text-yellow-400"
                      />
                      <input
                        id={FIELD_IDS.name}
                        name="name"
                        type="text"
                        required
                        autoComplete="name"
                        maxLength={80}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value)
                          revalidateField('name')
                        }}
                        placeholder="Seu nome"
                        aria-invalid={Boolean(fieldErrors.name)}
                        aria-describedby={fieldErrors.name ? `${FIELD_IDS.name}-error` : undefined}
                        className={inputClass(Boolean(fieldErrors.name))}
                      />
                    </div>
                    {fieldErrors.name && (
                      <p id={`${FIELD_IDS.name}-error`} className="px-1 text-xs font-medium text-red-300">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>

                  {/* E-mail */}
                  <div className="space-y-1.5">
                    <label htmlFor={FIELD_IDS.email} className="ml-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
                      E-mail
                    </label>
                    <div className="relative group">
                      <FaEnvelopeOpenText
                        aria-hidden
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-zinc-500 group-focus-within:text-yellow-400"
                      />
                      <input
                        id={FIELD_IDS.email}
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          revalidateField('email')
                        }}
                        placeholder="piloto@alfaracing.com"
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? `${FIELD_IDS.email}-error` : undefined}
                        className={inputClass(Boolean(fieldErrors.email))}
                      />
                    </div>
                    {fieldErrors.email && (
                      <p id={`${FIELD_IDS.email}-error`} className="px-1 text-xs font-medium text-red-300">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Senha */}
                  <div className="space-y-1.5">
                    <label htmlFor={FIELD_IDS.password} className="ml-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Senha
                    </label>
                    <div className="relative group">
                      <FaLock
                        aria-hidden
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-zinc-500 group-focus-within:text-yellow-400"
                      />
                      <input
                        id={FIELD_IDS.password}
                        name="password"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          revalidateField('password')
                          revalidateField('confirmPassword')
                        }}
                        placeholder="••••••••"
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-describedby={
                          fieldErrors.password ? `${FIELD_IDS.password}-error` : `${FIELD_IDS.password}-hint`
                        }
                        className={inputClass(Boolean(fieldErrors.password))}
                      />
                    </div>
                    {fieldErrors.password ? (
                      <p id={`${FIELD_IDS.password}-error`} className="px-1 text-xs font-medium text-red-300">
                        {fieldErrors.password}
                      </p>
                    ) : (
                      <p id={`${FIELD_IDS.password}-hint`} className="px-1 text-xs text-zinc-500">
                        Mínimo de 8 caracteres, com pelo menos uma letra e um número.
                      </p>
                    )}
                  </div>

                  {/* Confirmação de senha */}
                  <div className="space-y-1.5">
                    <label htmlFor={FIELD_IDS.confirmPassword} className="ml-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Confirmar senha
                    </label>
                    <div className="relative group">
                      <FaLock
                        aria-hidden
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-zinc-500 group-focus-within:text-yellow-400"
                      />
                      <input
                        id={FIELD_IDS.confirmPassword}
                        name="confirmPassword"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value)
                          revalidateField('confirmPassword')
                        }}
                        placeholder="••••••••"
                        aria-invalid={Boolean(fieldErrors.confirmPassword)}
                        aria-describedby={fieldErrors.confirmPassword ? `${FIELD_IDS.confirmPassword}-error` : undefined}
                        className={inputClass(Boolean(fieldErrors.confirmPassword))}
                      />
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p id={`${FIELD_IDS.confirmPassword}-error`} className="px-1 text-xs font-medium text-red-300">
                        {fieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    aria-busy={submitting}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-yellow-400 text-sm font-extrabold uppercase tracking-widest text-zinc-900 shadow-lg transition-all hover:bg-yellow-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1f]"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" aria-hidden />
                        Criando conta
                      </span>
                    ) : (
                      <>
                        Criar conta grátis <FaUserPlus aria-hidden />
                      </>
                    )}
                  </button>

                  <p className="px-1 text-[11px] leading-relaxed text-zinc-500">
                    Ao criar a conta você concorda em usar a plataforma de forma pessoal e responsável. Seus dados de acesso
                    ficam protegidos pelo Supabase Auth.
                  </p>
                </form>

                <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="h-px flex-1 bg-white/10" aria-hidden />
                  <span className="shrink-0">Supabase • RLS • Sessão segura</span>
                  <span className="h-px flex-1 bg-white/10" aria-hidden />
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-col items-center gap-1">
            <Link
              href={LOGIN_WITH_NEXT}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
            >
              Já tenho uma conta
            </Link>
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
  )
}
