// app/api/admin/vip-invites/[id]/revoke/route.ts
// ALFA-011.5 — Revogação de convite VIP (somente admin, não apaga registro)

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/auth'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { accessLogger, maskInviteId, nextCorrelationId } from '@/app/lib/access/accessLogger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = nextCorrelationId()
  const t0 = Date.now()
  try {
    const admin = await requireAdmin()
    const { id } = await params

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'id é obrigatório' }, { status: 400 })
    }

    // Buscar convite atual
    const { data: invite, error: fetchError } = await supabaseAdmin
      .from('invite_codes')
      .select('id, code, is_used, used_at, used_by, created_at, expires_at, revoked_at, revoked_by, invite_type')
      .eq('id', id)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json({ success: false, error: 'Convite não encontrado' }, { status: 404 })
    }

    if ((invite as any).revoked_at) {
      return NextResponse.json({ success: false, error: 'Convite já revogado', code: 'ALREADY_REVOKED' }, { status: 409 })
    }

    if ((invite as any).is_used) {
      // Decisão explícita ALFA-011.5: não revogar convite já usado (preserva rastreabilidade)
      return NextResponse.json(
        { success: false, error: 'Convite já utilizado não pode ser revogado', code: 'ALREADY_USED' },
        { status: 409 }
      )
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('invite_codes')
      .update({ revoked_at: new Date().toISOString(), revoked_by: admin.id })
      .eq('id', id)
      .is('revoked_at', null)
      .eq('is_used', false)
      .select('id, code, is_used, used_by, used_at, created_by, created_at, expires_at, revoked_at, revoked_by, invite_type')
      .single()

    if (updateError || !updated) {
      accessLogger.warn('vip.invite.revoked', {
        correlationId,
        inviteIdMasked: maskInviteId(id),
        result: 'failed',
        reason: updateError?.message?.slice(0, 80) || 'not updated',
        durationMs: Date.now() - t0,
      })
      return NextResponse.json({ success: false, error: updateError?.message || 'Falha ao revogar' }, { status: 409 })
    }

    accessLogger.info('vip.invite.revoked', {
      correlationId,
      userIdMasked: admin.id.slice(0, 8) + '***',
      inviteIdMasked: maskInviteId(id),
      result: 'succeeded',
      durationMs: Date.now() - t0,
    })

    return NextResponse.json({
      success: true,
      invite: {
        id: (updated as any).id,
        code: (updated as any).code,
        is_used: (updated as any).is_used,
        used_by: (updated as any).used_by ?? null,
        used_at: (updated as any).used_at ?? null,
        created_at: (updated as any).created_at,
        expires_at: (updated as any).expires_at ?? null,
        revoked_at: (updated as any).revoked_at,
        revoked_by: (updated as any).revoked_by,
        invite_type: (updated as any).invite_type ?? null,
        status: 'revogado',
      },
    })
  } catch (error: any) {
    const status = error?.status || (error?.message?.includes('Não autenticado') ? 401 : error?.message?.includes('admin') ? 403 : 500)
    accessLogger.error('vip.invite.revoked', {
      correlationId,
      result: 'failed',
      errorCode: String(status),
      reason: String(error?.message || 'unknown').slice(0, 80),
      durationMs: Date.now() - t0,
    })
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao revogar convite' }, { status })
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use POST.' }, { status: 405 })
}
