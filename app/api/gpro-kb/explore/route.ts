// app/api/gpro-kb/explore/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { endpoints } from '@/app/lib/gpro-api';
import { requireAdmin, resolveUserId } from '@/app/lib/auth';
import { getGproToken } from '@/app/lib/gpro-token';

// ============================================
// FUNÇÃO PARA CHAMAR API GPRO
// ============================================
async function fetchGproEndpoint(endpoint: string, token: string, params?: Record<string, string>) {
  // VALIDAÇÃO DE ENDPOINT
  if (!endpoints.includes(endpoint)) {
    throw new Error(`Endpoint inválido: ${endpoint}`);
  }

  // ============================================
  // URL CORRETA DA API GPRO (igual ao Explorer funcional)
  // ============================================
  // O Explorer original usa: https://gpro.net/br/backend/api/v2/${endpoint}
  // NÃO use: https://api.gpro.net/gpro/${endpoint} (isso retorna 404)
  // ============================================
  const baseUrl = 'https://gpro.net/br/backend/api/v2';
  const url = new URL(`${baseUrl}/${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  console.log(`📡 Chamando GPRO: ${url.toString()}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      if (errorText) {
        errorMessage = errorText;
      }
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

// ============================================
// ENDPOINT PRINCIPAL
// ============================================
export async function POST(request: NextRequest) {
  try {
    // 1. Autenticação admin obrigatória (Explorer é somente admin)
    const adminUser = await requireAdmin();

    // 2. Ler body UMA ÚNICA VEZ
    let body: any;
    
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido. Envie um JSON válido.' },
        { status: 400 }
      );
    }

    // 3. Extrair dados e validar IDOR
    const requestedUserId = body.userId || body.user_id || null;
    const userId = requestedUserId ? await resolveUserId(requestedUserId) : adminUser.id;
    const endpoint = body.endpoint;
    const params = body.params;

    // Valida que userId corresponde à sessão admin (previne IDOR mesmo para admin)
    if (requestedUserId && requestedUserId !== adminUser.id) {
      return NextResponse.json({ error: 'Acesso negado: ID não corresponde à sessão' }, { status: 403 });
    }

    // 4. Validar endpoint
    if (!endpoint) {
      console.error('❌ endpoint não fornecido');
      return NextResponse.json(
        { error: 'Endpoint não especificado' },
        { status: 400 }
      );
    }

    // 5. Buscar token GPRO do usuário (server-only, descriptografado)
    const token = await getGproToken(userId);

    if (!token) {
      return NextResponse.json(
        { error: 'Token GPRO não encontrado. Configure o token na página de integração.' },
        { status: 404 }
      );
    }

    // 6. Chamar API GPRO com validação
    let data: any;
    try {
      data = await fetchGproEndpoint(endpoint, token, params);
      console.log(`✅ Resposta recebida: ${Object.keys(data).length} campos`);
    } catch (error: any) {
      console.error('❌ Erro na API GPRO:', error.message);
      if (error.message.includes('Endpoint inválido')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // 7. Retornar sucesso
    console.log('✅ KB Explore: Sucesso!');
    return NextResponse.json({
      success: true,
      data: data,
      endpoint: endpoint,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    if (error?.status === 401) return NextResponse.json({ success: false, error: error.message || 'Não autenticado' }, { status: 401 });
    if (error?.status === 403) return NextResponse.json({ success: false, error: error.message || 'Acesso negado' }, { status: 403 });
    console.error('❌ Erro geral na KB Explore:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}