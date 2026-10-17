import { NextRequest, NextResponse } from 'next/server';
import { getLatestSnapshot, saveSnapshot } from '@/app/lib/gpro-snapshot';
import { fetchGproJson } from '@/app/lib/gpro-gateway';
import { mapTesting } from '@/app/lib/gpro-testing';
import { resolveUserId } from '@/app/lib/auth';
// PIX-015 — autorização centralizada (leitura GPRO é recurso Premium)
import { guardPremiumApi } from '@/app/lib/access/authorization';
import { getGproToken } from '@/app/lib/gpro-token';

// ============================================
// ALFA-010 - TESTING LEVE
// ============================================
// GET  → lê o último snapshot Testing (0 chamadas GPRO)
// POST → atualização explícita: busca SOMENTE Testing (1 chamada GPRO)
//
// Substitui a antiga sincronização completa disparada no mount da
// página de Testes, que consumia a API inteira apenas para ler
// track/weather/temp.
// ============================================

export async function GET() {
  try {
    const denied = await guardPremiumApi();
    if (denied) return denied;

    const userId = await resolveUserId();

    const snapshot = await getLatestSnapshot(userId, 'Testing');
    const testing = mapTesting(snapshot?.payload ?? null);

    return NextResponse.json({
      success: true,
      testing,
      createdAt: snapshot?.createdAt ?? null,
      season: snapshot?.season ?? null,
      race: snapshot?.race ?? null,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 401) {
      return NextResponse.json({ error: err.message || 'Não autenticado' }, { status: 401 });
    }
    if (err?.status === 403) {
      return NextResponse.json({ error: err.message || 'Acesso negado' }, { status: 403 });
    }
    console.error('Erro ao ler snapshot de Testing:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao ler dados de testes.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await guardPremiumApi();
    if (denied) return denied;

    // Autenticação server-side (não confia em userId do cliente)
    let requestedUserId: string | null = null;
    try {
      const body = await request.clone().json();
      requestedUserId = body.userId || body.user_id || null;
    } catch {
      // body vazio será tratado como sem ID solicitado
    }
    const userId = await resolveUserId(requestedUserId);

    const token = await getGproToken(userId);
    if (!token) {
      return NextResponse.json(
        { error: 'Token GPRO não encontrado. Configure o token na página de integração.' },
        { status: 404 }
      );
    }

    // Única chamada GPRO desta rota.
    const testingPayload = await fetchGproJson('Testing', token);

    // Timestamp EFETIVO da persistência: mesma origem exibida pelo GET.
    let savedAt: string | null = null;
    try {
      await saveSnapshot({
        userId,
        endpoint: 'Testing',
        source: 'manager_sync',
        payload: testingPayload,
      });
      const saved = await getLatestSnapshot(userId, 'Testing');
      savedAt = saved?.createdAt ?? null;
    } catch (e) {
      console.warn('⚠️ Falha ao salvar snapshot Testing:', e instanceof Error ? e.message : e);
    }

    return NextResponse.json({
      success: true,
      testing: mapTesting(testingPayload),
      // Fallback para o instante da resposta apenas se a persistência falhar.
      createdAt: savedAt ?? new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 401) {
      return NextResponse.json({ error: err.message || 'Não autenticado' }, { status: 401 });
    }
    if (err?.status === 403) {
      return NextResponse.json({ error: err.message || 'Acesso negado' }, { status: 403 });
    }
    console.error('Erro ao atualizar Testing:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar dados de testes.' },
      { status: 500 }
    );
  }
}
