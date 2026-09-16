// app/api/admin/gpro-kb/route.ts
// ============================================
// API ROUTE DA KNOWLEDGE BASE
// ============================================
// ESTRATÉGIA DE AUTENTICAÇÃO: userId via header
// ============================================
// Segue o mesmo padrão do explore/route.ts e sync/route.ts
// O frontend envia o userId no header 'user-id'
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getKnowledgeBase,
  upsertEndpoint,
  deleteKnowledgeBase,
  deleteEndpoint
} from '@/app/lib/knowledge-base-db';
import { endpoints } from '@/app/lib/gpro-api';

// ============================================
// HELPERS DE AUTENTICAÇÃO — SOMENTE ADMIN
// ============================================
import { requireAdmin, resolveUserId } from '@/app/lib/auth';

async function getAuthenticatedUserId(request: NextRequest): Promise<string> {
  // Validação server-side: header user-id só é aceito se coincidir com sessão; exige admin
  const headerUserId = request.headers.get('user-id');
  const adminUser = await requireAdmin();
  if (headerUserId && headerUserId !== adminUser.id) {
    // Tenta resolver para gerar erro 403 padronizado (IDOR)
    await resolveUserId(headerUserId);
  }
  return adminUser.id;
}

// ============================================
// GET - Buscar catálogo do usuário
// ============================================

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 GET /api/admin/gpro-kb - Iniciando');
    const userId = await getAuthenticatedUserId(request);
    
    console.log(`🔍 Buscando catálogo para userId: ${userId}`);
    const catalogo = await getKnowledgeBase(userId);
    console.log(`🔍 Catálogo obtido: ${Object.keys(catalogo).length} endpoints`);

    return NextResponse.json({
      success: true,
      catalogo,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const status = error?.status || (error.message === 'Usuário não autenticado' || error.message?.includes('Não autenticado') ? 401 : error.message?.includes('admin') ? 403 : 500);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Erro ao buscar knowledge base' 
      },
      { status }
    );
  }
}

// ============================================
// POST - Criar/atualizar um endpoint
// ============================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    const body = await request.json();

    const { endpoint, info } = body;

    console.log(`🔍 Salvando endpoint: ${endpoint} para userId: ${userId}`);

    // Validações
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Endpoint é obrigatório' },
        { status: 400 }
      );
    }

    if (!endpoints.includes(endpoint)) {
      return NextResponse.json(
        { success: false, error: `Endpoint inválido: ${endpoint}` },
        { status: 400 }
      );
    }

    if (!info) {
      return NextResponse.json(
        { success: false, error: 'Info é obrigatório' },
        { status: 400 }
      );
    }

    // Validação do payload
    if (!info.campos || !Array.isArray(info.campos)) {
      return NextResponse.json(
        { success: false, error: 'Estrutura inválida: campos deve ser um array' },
        { status: 400 }
      );
    }

    if (info.tipos && typeof info.tipos !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Estrutura inválida: tipos deve ser um objeto' },
        { status: 400 }
      );
    }

    if (info.parametros && !Array.isArray(info.parametros)) {
      return NextResponse.json(
        { success: false, error: 'Estrutura inválida: parametros deve ser um array' },
        { status: 400 }
      );
    }

    const saved = await upsertEndpoint(userId, endpoint, info);
    console.log(`✅ Endpoint ${endpoint} salvo com sucesso`);

    return NextResponse.json({
      success: true,
      data: saved,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const status = error?.status || (error.message?.includes('Não autenticado') ? 401 : error.message?.includes('admin') ? 403 : 500);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Erro ao salvar endpoint' 
      },
      { status }
    );
  }
}

// ============================================
// DELETE - Remover knowledge base ou endpoint
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint');

    if (endpoint) {
      console.log(`🔍 Removendo endpoint: ${endpoint} para userId: ${userId}`);
      await deleteEndpoint(userId, endpoint);
      return NextResponse.json({
        success: true,
        message: `Endpoint ${endpoint} removido com sucesso`,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`🔍 Removendo toda knowledge base para userId: ${userId}`);
      await deleteKnowledgeBase(userId);
      return NextResponse.json({
        success: true,
        message: 'Knowledge base removida com sucesso',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    const status = error?.status || (error.message?.includes('Não autenticado') ? 401 : error.message?.includes('admin') ? 403 : 500);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Erro ao remover knowledge base' 
      },
      { status }
    );
  }
}