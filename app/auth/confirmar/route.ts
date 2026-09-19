// app/auth/confirmar/route.ts
// ============================================
// ALFA-015.0 — RETORNO DA CONFIRMAÇÃO DE E-MAIL
// ============================================
// O Supabase Auth (GoTrue) é quem envia o e-mail e valida o token. Esta rota
// apenas troca o token/código por uma SESSÃO no mesmo mecanismo de auth já usado
// pelo /login (@supabase/ssr + cookies). Não existe segundo mecanismo de auth.
//
// Nenhum benefício é concedido aqui: a confirmação de e-mail libera somente o
// login. Premium continua vindo exclusivamente do fluxo de pagamento confirmado.
//
// Formatos aceitos (respeita o template de e-mail configurado no projeto):
//   - ?code=...            (PKCE — padrão do @supabase/ssr com ConfirmationURL)
//   - ?token_hash=&type=   (templates que usam {{ .TokenHash }})
//   - ?error=...           (link expirado/inválido → volta ao login com aviso)
// ============================================

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { accessLogger } from '@/app/lib/access/accessLogger'
import { FREE_LANDING_PATH, safeInternalPath } from '@/app/lib/auth-flow'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LOGIN_PATH = '/login'

function buildRedirect(request: NextRequest, path: string): NextResponse {
  const target = new URL(path, request.nextUrl.origin)
  return NextResponse.redirect(target)
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  const providerError = params.get('error') || params.get('error_code')
  const next = safeInternalPath(params.get('next'), FREE_LANDING_PATH) ?? FREE_LANDING_PATH

  // Link expirado/recusado pelo provedor.
  if (providerError && !code && !tokenHash) {
    accessLogger.warn('free.signup.confirmation_failed', {
      result: 'provider_error',
      reason: String(providerError).slice(0, 40),
    })
    return buildRedirect(request, `${LOGIN_PATH}?confirmacao=falhou&next=${encodeURIComponent(next)}`)
  }

  try {
    const supabase = await createClient()

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        accessLogger.warn('free.signup.confirmation_failed', {
          result: 'exchange_failed',
          reason: String(error.message || 'unknown').slice(0, 80),
        })
        return buildRedirect(request, `${LOGIN_PATH}?confirmacao=falhou&next=${encodeURIComponent(next)}`)
      }
    } else if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: (type === 'email' || type === 'recovery' || type === 'invite' ? type : 'signup') as
          | 'signup'
          | 'email'
          | 'recovery'
          | 'invite',
      })
      if (error) {
        accessLogger.warn('free.signup.confirmation_failed', {
          result: 'verify_otp_failed',
          reason: String(error.message || 'unknown').slice(0, 80),
        })
        return buildRedirect(request, `${LOGIN_PATH}?confirmacao=falhou&next=${encodeURIComponent(next)}`)
      }
    } else {
      // Sem código: nada a confirmar — apenas conduz ao login.
      return buildRedirect(request, `${LOGIN_PATH}?confirmacao=pendente&next=${encodeURIComponent(next)}`)
    }

    // Sessão válida e confirmada. Destino: porta de entrada comercial (/planos).
    accessLogger.info('free.signup.confirmed', { result: 'session_created' })
    return buildRedirect(request, next)
  } catch (e) {
    accessLogger.error('free.signup.confirmation_failed', {
      result: 'exception',
      reason: String((e as Error)?.message || e).slice(0, 80),
    })
    return buildRedirect(request, `${LOGIN_PATH}?confirmacao=falhou&next=${encodeURIComponent(next)}`)
  }
}
