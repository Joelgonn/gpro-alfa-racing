// app/api/admin/access-status/route.ts
// ============================================
// ENDPOINT DE DIAGNÓSTICO VIP — SOMENTE ADMIN
// ALFA-011.3 — integração controlada, sem enumeração
// ============================================
// - Aceita somente GET
// - Usa requireAdmin (401 não autenticado, 403 não admin)
// - Não aceita userId arbitrário (?userId, header user-id, body) — sempre consulta o próprio admin autenticado
// - Não retorna service_role, gpro_token, raw_data, financeiro
// - Não cria/incrementa concessões nem eventos, não modifica user_state
// - VIP_CHECK=false continua permitindo allowed=true, mas hasAccess reflete cálculo real
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/auth'
import { getAccessState, VIP_CHECK } from '@/app/lib/access/accessService'

export async function GET(_request: NextRequest) {
  try {
    const adminUser = await requireAdmin()

    // Consulta somente o próprio admin autenticado — sem enumeração
    // getAccessState sem argumento resolve via cookies (auth.getUser)
    // Passar adminUser.id evita ambiguidade mas não permite consulta de terceiros
    const state = await getAccessState(adminUser.id)

    // Resposta mínima — sem objetos Supabase completos, sem metadata sensível
    return NextResponse.json({
      success: true,
      userId: state.userId,
      isAdmin: state.isAdmin,
      status: state.status,
      plan: state.plan,
      hasAccess: state.hasAccess,
      isLifetime: state.isLifetime,
      isExpired: state.isExpired,
      isRevoked: state.isRevoked,
      isPending: state.isPending,
      startsAt: state.startsAt,
      expiresAt: state.expiresAt,
      grantId: state.grantId,
      source: state.source,
      enforcementEnabled: state.enforcementEnabled,
      allowed: state.allowed,
      vipCheck: VIP_CHECK,
    })
  } catch (error: any) {
    const status = error?.status || (error?.message?.includes('Não autenticado') ? 401 : error?.message?.includes('admin') ? 403 : 500)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Erro ao consultar status de acesso',
      },
      { status }
    )
  }
}

// Métodos diferentes de GET são rejeitados (405)
export async function POST() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET.' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET.' }, { status: 405 })
}

export async function PATCH() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET.' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET.' }, { status: 405 })
}
