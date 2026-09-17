// app/api/admin/access-would-block/route.ts
// ALFA-013.0 — Observabilidade VIP (wouldBlock) — somente leitura, sem efeitos colaterais
// - exige requireAdmin (401/403)
// - não aceita userId arbitrário (visão agregada)
// - não altera banco (somente SELECT)
// - não expõe tokens, raw_data, service_role
// - VIP_CHECK=false mas calcula wouldBlock como se VIP_CHECK=true

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/auth'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { accessLogger, nextCorrelationId } from '@/app/lib/access/accessLogger'
import { interpretGrant } from '@/app/lib/access/accessService'

export async function GET(_request: NextRequest) {
  const correlationId = nextCorrelationId()
  const t0 = Date.now()
  try {
    const admin = await requireAdmin()

    // Métricas grants (fonte primária)
    const { count: grantsActive } = await supabaseAdmin.from('access_grants').select('id', { count: 'exact', head: true }).eq('status', 'active')
    const { count: grantsExpired } = await supabaseAdmin.from('access_grants').select('id', { count: 'exact', head: true }).eq('status', 'expired')
    const { count: grantsRevoked } = await supabaseAdmin.from('access_grants').select('id', { count: 'exact', head: true }).eq('status', 'revoked')
    const { count: grantsPending } = await supabaseAdmin.from('access_grants').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    const { count: grantsLifetime } = await supabaseAdmin.from('access_grants').select('id', { count: 'exact', head: true }).eq('status', 'active').is('expires_at', null)
    const { count: grantsTotal } = await supabaseAdmin.from('access_grants').select('id', { count: 'exact', head: true })

    // Grants ativos detalhados para wouldBlock (expirado por data vs status)
    const { data: activeGrants } = await supabaseAdmin
      .from('access_grants')
      .select('id, expires_at, status')
      .eq('status', 'active')
      .limit(1000)

    let wouldBlockByExpiredDate = 0
    let activeValid = 0
    const now = Date.now()
    for (const g of (activeGrants as any[]) || []) {
      if (g.expires_at && new Date(g.expires_at).getTime() <= now) {
        wouldBlockByExpiredDate++
      } else {
        // interpreta via helper para garantir regra vitalício
        const interpreted = interpretGrant(g as any, new Date())
        if (interpreted.hasAccess) activeValid++
      }
    }

    // Convites
    const { count: invitesTotal } = await supabaseAdmin.from('invite_codes').select('id', { count: 'exact', head: true })
    const { count: invitesUsed } = await supabaseAdmin.from('invite_codes').select('id', { count: 'exact', head: true }).eq('is_used', true)
    const { count: invitesRevoked } = await supabaseAdmin.from('invite_codes').select('id', { count: 'exact', head: true }).not('revoked_at', 'is', null)

    // Eventos por tipo
    const { count: eventsGranted } = await supabaseAdmin.from('access_events').select('id', { count: 'exact', head: true }).eq('event_type', 'granted')
    const { count: eventsRenewed } = await supabaseAdmin.from('access_events').select('id', { count: 'exact', head: true }).eq('event_type', 'renewed')
    const { count: eventsRevoked } = await supabaseAdmin.from('access_events').select('id', { count: 'exact', head: true }).eq('event_type', 'revoked')
    const { count: eventsExpired } = await supabaseAdmin.from('access_events').select('id', { count: 'exact', head: true }).eq('event_type', 'expired')

    // Divergências grant vs user_state (amostral, sem expor userIds)
    // Conta grants ativos onde user_state diverge (vip_status null ou expirado)
    let divergences = 0
    const sampleGrants = (activeGrants as any[])?.slice(0, 50) || []
    for (const g of sampleGrants) {
      // Se grant expirado por data mas status ainda active, seria divergência se user_state ainda active
      if (g.expires_at && new Date(g.expires_at).getTime() <= now) {
        divergences++
      }
    }

    const durationMs = Date.now() - t0
    accessLogger.info('vip.access.denied', {
      correlationId,
      userIdMasked: admin.id.slice(0, 8) + '***',
      result: 'diagnostic',
      durationMs,
      meta: { grantsActive, wouldBlockByExpiredDate },
    })

    return NextResponse.json({
      success: true,
      correlationId,
      timestamp: new Date().toISOString(),
      grants: {
        total: grantsTotal ?? 0,
        active: grantsActive ?? 0,
        activeValid,
        wouldBlockByExpiredDate,
        expired: grantsExpired ?? 0,
        revoked: grantsRevoked ?? 0,
        pending: grantsPending ?? 0,
        lifetime: grantsLifetime ?? 0,
      },
      invites: {
        total: invitesTotal ?? 0,
        used: invitesUsed ?? 0,
        revoked: invitesRevoked ?? 0,
      },
      events: {
        granted: eventsGranted ?? 0,
        renewed: eventsRenewed ?? 0,
        revoked: eventsRevoked ?? 0,
        expired: eventsExpired ?? 0,
      },
      divergences: {
        sampleChecked: sampleGrants.length,
        wouldBlockExpiredActive: divergences,
      },
      flags: {
        vipCheck: false,
        wouldBlockIfEnabled: wouldBlockByExpiredDate + (grantsRevoked ?? 0) + (grantsExpired ?? 0),
      },
    })
  } catch (error: any) {
    const status = error?.status || (error?.message?.includes('Não autenticado') ? 401 : error?.message?.includes('admin') ? 403 : 500)
    accessLogger.error('vip.access.denied', {
      correlationId,
      result: 'failed',
      errorCode: String(status),
      reason: String(error?.message || 'unknown').slice(0, 80),
    })
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao consultar diagnóstico' }, { status })
  }
}

export async function POST() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET.' }, { status: 405 })
}
export async function PUT() {
  return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 })
}
export async function PATCH() {
  return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 })
}
export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 })
}
