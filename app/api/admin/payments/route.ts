// app/api/admin/payments/route.ts
// ALFA-014.1 — Listagem administrativa de pagamentos

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/auth'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20))
    const status = url.searchParams.get('status')
    const orderId = url.searchParams.get('orderId')

    const allowedStatus = ['created','pending','confirmed','failed','refunded','chargeback','awaiting_payment','paid','expired']
    if (status && !allowedStatus.includes(status)) {
      return NextResponse.json({ success: false, error: 'status inválido' }, { status: 400 })
    }
    if (orderId && !/^[0-9a-f-]{36}$/i.test(orderId)) {
      return NextResponse.json({ success: false, error: 'orderId inválido' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('premium_payments')
      .select('id, order_id, provider, provider_payment_id, pix_txid, status, amount_cents, currency, paid_at, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (status) query = query.eq('status', status)
    if (orderId) query = query.eq('order_id', orderId)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)

    const sanitized = (data || []).map((row: any) => ({
      ...row,
      pix_txid: row.pix_txid ? row.pix_txid.slice(0, 8) + '***' : null,
      provider_payment_id: row.provider_payment_id ? row.provider_payment_id.slice(0, 8) + '***' : null,
    }))

    return NextResponse.json({ success: true, payments: sanitized, total: count ?? 0, page, limit })
  } catch (error: any) {
    const status = error?.status || (error?.message?.includes('Não autenticado') ? 401 : error?.message?.includes('admin') ? 403 : 500)
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao listar pagamentos' }, { status })
  }
}

export async function POST() { return NextResponse.json({ success: false, error: 'Método não permitido. Use GET.' }, { status: 405 }) }
export async function PUT() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
export async function PATCH() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
export async function DELETE() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
