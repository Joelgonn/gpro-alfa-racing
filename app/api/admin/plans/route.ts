// app/api/admin/plans/route.ts
// PIX-001.3 — Gerenciador administrativo de planos premium (preços)
//
// Regras:
// - SOMENTE admin (requireAdmin → 401 não autenticado / 403 não admin)
// - GET: lista todos os planos (inclusive inativos) — visão administrativa
// - PATCH: atualiza preço / nome / descrição / validade / ativo de UM plano por `code`
// - O preço NUNCA é aceito como float: sempre centavos inteiros
// - Nenhum plano pode ser REMOVIDO (produto pode ter pedidos vinculados por FK RESTRICT)
// - Toda alteração é registrada via accessLogger (sem dados sensíveis)
// - Não altera pedidos, pagamentos, grants, convites ou RLS

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/auth'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { accessLogger, nextCorrelationId } from '@/app/lib/access/accessLogger'

type Body = {
  code?: unknown
  priceCents?: unknown
  name?: unknown
  description?: unknown
  durationDays?: unknown
  isActive?: unknown
}

// Limites defensivos: preço entre R$ 1,00 e R$ 10.000,00; validade entre 1 dia e 10 anos
const PRICE_MIN_CENTS = 100
const PRICE_MAX_CENTS = 1_000_000
const DURATION_MIN_DAYS = 1
const DURATION_MAX_DAYS = 3650
const NAME_MAX = 120
const DESC_MAX = 500

export async function GET(_request: NextRequest) {
  try {
    await requireAdmin()

    const { data, error } = await supabaseAdmin
      .from('premium_plans')
      .select('id, code, name, description, duration_days, price_cents, currency, is_active, created_at, updated_at')
      .order('price_cents', { ascending: true })

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, plans: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: unknown) {
    const e = error as { status?: number; message?: string }
    const status = e?.status || (e?.message?.includes('Não autenticado') ? 401 : e?.message?.includes('admin') ? 403 : 500)
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao listar planos' }, { status })
  }
}

export async function PATCH(request: NextRequest) {
  const correlationId = nextCorrelationId()
  const t0 = Date.now()
  try {
    const admin = await requireAdmin()

    let body: Body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
    }

    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!code) {
      return NextResponse.json({ success: false, error: 'code é obrigatório' }, { status: 400 })
    }

    // Monta apenas os campos efetivamente enviados (PATCH parcial)
    const patch: Record<string, unknown> = {}

    if (body.priceCents !== undefined) {
      if (typeof body.priceCents !== 'number' || !Number.isInteger(body.priceCents)) {
        return NextResponse.json({ success: false, error: 'priceCents deve ser inteiro em centavos' }, { status: 400 })
      }
      if (body.priceCents < PRICE_MIN_CENTS || body.priceCents > PRICE_MAX_CENTS) {
        return NextResponse.json(
          { success: false, error: `priceCents deve estar entre ${PRICE_MIN_CENTS} e ${PRICE_MAX_CENTS}` },
          { status: 400 }
        )
      }
      patch.price_cents = body.priceCents
    }

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > NAME_MAX) {
        return NextResponse.json({ success: false, error: `name deve ter entre 1 e ${NAME_MAX} caracteres` }, { status: 400 })
      }
      patch.name = body.name.trim()
    }

    if (body.description !== undefined) {
      if (body.description === null || body.description === '') {
        patch.description = null
      } else if (typeof body.description !== 'string' || body.description.length > DESC_MAX) {
        return NextResponse.json({ success: false, error: `description deve ter até ${DESC_MAX} caracteres` }, { status: 400 })
      } else {
        patch.description = body.description.trim()
      }
    }

    if (body.durationDays !== undefined) {
      if (body.durationDays === null) {
        patch.duration_days = null // vitalício
      } else if (
        typeof body.durationDays !== 'number' ||
        !Number.isInteger(body.durationDays) ||
        body.durationDays < DURATION_MIN_DAYS ||
        body.durationDays > DURATION_MAX_DAYS
      ) {
        return NextResponse.json(
          { success: false, error: `durationDays deve ser null (vitalício) ou inteiro entre ${DURATION_MIN_DAYS} e ${DURATION_MAX_DAYS}` },
          { status: 400 }
        )
      } else {
        patch.duration_days = body.durationDays
      }
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        return NextResponse.json({ success: false, error: 'isActive deve ser booleano' }, { status: 400 })
      }
      patch.is_active = body.isActive
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    // Confirma que o plano existe (evita criar por engano) e aplica
    const { data: existing, error: selErr } = await supabaseAdmin
      .from('premium_plans')
      .select('id, code, price_cents, is_active')
      .eq('code', code)
      .maybeSingle()

    if (selErr) throw new Error(selErr.message)
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 })
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('premium_plans')
      .update(patch)
      .eq('code', code)
      .select('id, code, name, description, duration_days, price_cents, currency, is_active, updated_at')
      .single()

    if (updErr || !updated) throw new Error(updErr?.message || 'Falha ao atualizar plano')

    accessLogger.info('pix.plan.updated', {
      correlationId,
      userIdMasked: admin.id.slice(0, 8) + '***',
      result: 'succeeded',
      durationMs: Date.now() - t0,
      // apenas NOMES de campos e o código do plano — nunca valores financeiros em log
      meta: { code, fields: Object.keys(patch).join(','), priceChanged: 'price_cents' in patch },
    })

    return NextResponse.json({ success: true, plan: updated }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: unknown) {
    const e = error as { status?: number; message?: string }
    const status = e?.status || (e?.message?.includes('Não autenticado') ? 401 : e?.message?.includes('admin') ? 403 : 500)
    accessLogger.error('pix.plan.updated', {
      correlationId,
      result: 'failed',
      errorCode: String(status),
      reason: String(e?.message || 'unknown').slice(0, 80),
      durationMs: Date.now() - t0,
    })
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao atualizar plano' }, { status })
  }
}

// POST/DELETE/PUT não são permitidos: produtos não são criados nem removidos por API
export async function POST() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET ou PATCH.' }, { status: 405 })
}
export async function PUT() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET ou PATCH.' }, { status: 405 })
}
export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Método não permitido. Use GET ou PATCH.' }, { status: 405 })
}
