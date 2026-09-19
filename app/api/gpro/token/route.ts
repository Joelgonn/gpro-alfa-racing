import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
// PIX-015 — autorização centralizada (integração GPRO é recurso Premium)
import { guardPremiumApi } from '@/app/lib/access/authorization';
import { getGproToken, setGproToken, hasGproToken } from '@/app/lib/gpro-token';

// GET: retorna apenas se tem token (sem expor valor)
export async function GET() {
  try {
    const denied = await guardPremiumApi();
    if (denied) return denied;
    const user = await requireAuth();
    const hasToken = await hasGproToken(user.id);
    return NextResponse.json({ success: true, hasToken });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ success: false, error: e.message }, { status });
  }
}

// POST: define/atualiza token (criptografado em repouso, nunca retornado)
export async function POST(request: NextRequest) {
  try {
    const denied = await guardPremiumApi();
    if (denied) return denied;
    const user = await requireAuth();
    const body = await request.json();
    const token = String(body.token || body.gpro_token || '').trim();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token é obrigatório' }, { status: 400 });
    }
    // Validação básica: JWT deve ter 2 pontos e começar com eyJ
    if (!token.includes('.') || token.length < 50) {
      return NextResponse.json({ success: false, error: 'Formato de token inválido' }, { status: 400 });
    }
    await setGproToken(user.id, token);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const status = e?.status || 500;
    // Nunca logar token
    console.error('Erro ao salvar gpro_token:', e.message);
    return NextResponse.json({ success: false, error: e.message || 'Erro ao salvar token' }, { status });
  }
}

// DELETE: remove token
export async function DELETE() {
  try {
    const denied = await guardPremiumApi();
    if (denied) return denied;
    const user = await requireAuth();
    await setGproToken(user.id, null);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ success: false, error: e.message }, { status });
  }
}
