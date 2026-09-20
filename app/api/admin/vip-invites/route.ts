// app/api/admin/vip-invites/route.ts
// ALFA-011.5 — Gerenciador de convites VIP (GET lista, POST cria)
// Somente admin via requireAdmin, usa supabaseAdmin (service_role), não aceita código do cliente

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/auth'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { accessLogger, maskInviteId, nextCorrelationId } from '@/app/lib/access/accessLogger'

type ValidityType = '30_days' | 'lifetime' | 'custom'

function computeStatus(row: any): 'disponivel' | 'utilizado' | 'expirado' | 'revogado' {
  if (row.revoked_at) return 'revogado'
  if (row.is_used) return 'utilizado'
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expirado'
  return 'disponivel'
}

function sanitizeInvite(row: any) {
  return {
    id: row.id,
    code: row.code,
    is_used: row.is_used,
    used_by: row.used_by ?? null,
    used_at: row.used_at ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    expires_at: row.expires_at ?? null,
    revoked_at: row.revoked_at ?? null,
    revoked_by: row.revoked_by ?? null,
    invite_type: row.invite_type ?? null,
    duration_days: row.duration_days ?? null,
    status: computeStatus(row),
  }
}

export async function GET(_request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const { data, error } = await supabaseAdmin
      .from('invite_codes')
      .select('id, code, is_used, used_by, used_at, created_by, created_at, expires_at, revoked_at, revoked_by, invite_type, duration_days, metadata')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)

    const invites = (data || []).map(sanitizeInvite)

    return NextResponse.json({
      success: true,
      invites,
      count: invites.length,
      actor: admin.id,
    })
  } catch (error: any) {
    const status = error?.status || (error?.message?.includes('Não autenticado') ? 401 : error?.message?.includes('admin') ? 403 : 500)
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao listar convites' }, { status })
  }
}

export async function POST(request: NextRequest) {
  const correlationId = nextCorrelationId()
  const t0 = Date.now()
  try {
    const admin = await requireAdmin()
    const body = await request.json().catch(() => ({}))

    const validityType: ValidityType = body.validityType
    const customExpiresAt: string | undefined = body.customExpiresAt
    let durationDays: number | null | undefined = body.durationDays

    if (!['30_days', 'lifetime', 'custom'].includes(validityType)) {
      return NextResponse.json({ success: false, error: 'validityType inválido. Use 30_days, lifetime ou custom.' }, { status: 400 })
    }

    // FASE 1: durationDays tem prioridade sobre invite_type legado
    if (durationDays !== undefined) {
      if (durationDays !== null) {
        if (typeof durationDays !== 'number' || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
          return NextResponse.json({ success: false, error: 'durationDays deve ser null (lifetime) ou inteiro entre 1 e 3650.' }, { status: 400 })
        }
      }
    }

    let expires_at: string | null = null
    let invite_type: string = 'vip_30_days'

    if (validityType === '30_days') {
      const d = new Date()
      d.setDate(d.getDate() + 30)
      expires_at = d.toISOString()
      invite_type = 'vip_30_days'
    } else if (validityType === 'lifetime') {
      expires_at = null
      invite_type = 'vip_lifetime'
    } else if (validityType === 'custom') {
      if (!customExpiresAt || typeof customExpiresAt !== 'string') {
        return NextResponse.json({ success: false, error: 'customExpiresAt é obrigatório para validityType custom (ISO string).' }, { status: 400 })
      }
      const parsed = new Date(customExpiresAt)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ success: false, error: 'customExpiresAt inválida (não é data ISO).' }, { status: 400 })
      }
      if (parsed.getTime() <= Date.now()) {
        return NextResponse.json({ success: false, error: 'customExpiresAt deve estar no futuro.' }, { status: 400 })
      }
      // Limite razoável: no máximo 2 anos no futuro
      const max = new Date()
      max.setFullYear(max.getFullYear() + 2)
      if (parsed.getTime() > max.getTime()) {
        return NextResponse.json({ success: false, error: 'customExpiresAt excede limite de 2 anos.' }, { status: 400 })
      }
      expires_at = parsed.toISOString()
      invite_type = 'vip_custom'
    }

    // Se durationDays não foi enviado, manter compatibilidade (derivar do invite_type)
    if (durationDays === undefined) {
      if (invite_type === 'vip_lifetime') durationDays = null
      else if (invite_type === 'vip_30_days') durationDays = 30
      else if (invite_type === 'vip_custom') durationDays = null // vip_custom legado usa expires_at do convite; sem duration explícita, grant usará fallback
      else durationDays = 30
    }

    // Código gerado no servidor, aleatoriedade criptográfica, único
    const uuid = crypto.randomUUID().replace(/-/g, '').toUpperCase()
    const part1 = uuid.slice(0, 4)
    const part2 = uuid.slice(4, 8)
    const code = `ALFA-${part1}-${part2}`

    // Tentar inserir com retry se colidir (código UNIQUE)
    let inserted: any = null
    let attempts = 0
    while (attempts < 3) {
      const tryCode = attempts === 0 ? code : `ALFA-${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0,4)}-${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0,4)}`
      const { data, error } = await supabaseAdmin
        .from('invite_codes')
        .insert({
          code: tryCode,
          is_used: false,
          created_by: admin.id,
          expires_at,
          invite_type,
          duration_days: durationDays,
          metadata: { validityType, durationDays } as any,
        })
        .select('id, code, is_used, used_by, used_at, created_by, created_at, expires_at, revoked_at, revoked_by, invite_type, duration_days')
        .single()

      if (!error && data) {
        inserted = data
        break
      }
      // 23505 = unique_violation
      if ((error as any)?.code === '23505') {
        attempts++
        continue
      }
      throw new Error(error?.message || 'Erro ao criar convite')
    }

    if (!inserted) throw new Error('Não foi possível gerar código único')

    accessLogger.info('vip.invite.created', {
      correlationId,
      userIdMasked: admin.id.slice(0, 8) + '***',
      inviteIdMasked: maskInviteId((inserted as any).id),
      result: 'succeeded',
      durationMs: Date.now() - t0,
      meta: { validityType, invite_type },
    })

    return NextResponse.json({ success: true, invite: sanitizeInvite(inserted) }, { status: 201 })
  } catch (error: any) {
    const status = error?.status || (error?.message?.includes('Não autenticado') ? 401 : error?.message?.includes('admin') ? 403 : 500)
    accessLogger.error('vip.invite.created', {
      correlationId,
      result: 'failed',
      errorCode: String(status),
      reason: String(error?.message || 'unknown').slice(0, 80),
      durationMs: Date.now() - t0,
    })
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao criar convite' }, { status })
  }
}

// Métodos não permitidos
export async function PUT() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET ou POST.' }, { status: 405 })
}
export async function PATCH() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET ou POST.' }, { status: 405 })
}
export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET ou POST.' }, { status: 405 })
}
