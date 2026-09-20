'use server'

import { getAccessState } from '@/app/lib/access/accessService'
import { resolvePostLoginDestinationFromState, safeInternalPath } from '@/app/lib/auth-flow'

/**
 * FASE 0 — Autoridade de acesso no login.
 * Server Action que resolve destino pós-login via estado real (access_grants).
 * Nunca usa user_state.access_plan isolado.
 */
export async function getLoginDestination(nextRaw: unknown): Promise<string> {
  const next = safeInternalPath(nextRaw, null)
  if (next) return next

  try {
    const state = await getAccessState()
    // isAdmin já tratado dentro de hasAccess, mas mantemos isAdmin explícito para V2
    return resolvePostLoginDestinationFromState({
      next: null,
      state: {
        hasAccess: state.hasAccess,
        status: state.status,
        isAdmin: state.isAdmin,
      },
    })
  } catch (e) {
    const status = (e as { status?: number })?.status
    if (status === 401) {
      // Sem sessão — não deveria acontecer logo após signIn, mas trata como login
      return '/login'
    }
    // Erro interno 500 — não mascarar como acesso, propaga para caller decidir
    throw e
  }
}
