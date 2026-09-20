import { NextRequest, NextResponse } from 'next/server'
import { expireOverdueGrants } from '@/app/lib/access/accessService'

export const dynamic = 'force-dynamic'

/**
 * FASE 4 — Cron de higiene: normaliza grants vencidos (active + expires_at <= now → expired).
 * Não é requisito de segurança; bloqueio já ocorre por interpretGrant em tempo real.
 */
export async function GET(request: NextRequest) {
  // Proteção simples: se CRON_SECRET estiver configurado, exige header Authorization
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const count = await expireOverdueGrants()
    return NextResponse.json({ success: true, expired: count }, { status: 200 })
  } catch (e) {
    const msg = (e as Error)?.message?.slice(0, 120) || 'Erro'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
