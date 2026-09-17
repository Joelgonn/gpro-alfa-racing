// app/api/admin/payment-events/route.ts
// ALFA-014.1 — Listagem administrativa de eventos de pagamento (payload_json omitido por padrão)

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/auth'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20))
    const provider = url.searchParams.get('provider')
    const event_type = url.searchParams.get('event_type')

    let query = supabaseAdmin
      .from('payment_events')
      .select('id, order_id, payment_id, provider, event_type, event_id, payload_hash, received_at, processed_at, processing_status, error_message', { count: 'exact' })
      .order('received_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (provider) query = query.eq('provider', provider)
    if (event_type) query = query.eq('event_type', event_type)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)

    // payload_json omitido por padrão (nunca retornar ao frontend sem necessidade)
    // Se precisar, usar ?includePayload=true mas ainda mascarado (não implementado nesta sprint)
    return NextResponse.json({ success: true, events: data || [], total: count ?? 0, page, limit })
  } catch (error: any) {
    const status = error?.status || (error?.message?.includes('Não autenticado') ? 401 : error?.message?.includes('admin') ? 403 : 500)
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao listar eventos' }, { status })
  }
}

export async function POST() { return NextResponse.json({ success: false, error: 'Método não permitido. Use GET.' }, { status: 405 }) }
export async function PUT() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
export async function PATCH() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
export async function DELETE() { return NextResponse.json({ success: false, error: 'Método não permitido.' }, { status: 405 }) }
