// app/api/gpro-kb/explore/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { endpoints } from '@/app/lib/gpro-api';

// ============================================
// CLIENTE SUPABASE (Service Role - mesmo padrão do sync)
// ============================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    console.log('🔍 KB Explore: Iniciando requisição');

    // 1. Ler body UMA ÚNICA VEZ
    let body: any;
    
    try {
      body = await request.json();
      console.log('🔍 Body lido com sucesso:', Object.keys(body));
    } catch (error) {
      console.error('❌ Erro ao ler body:', error);
      return NextResponse.json(
        { error: 'Corpo da requisição inválido. Envie um JSON válido.' },
        { status: 400 }
      );
    }

    // 2. Extrair todos os dados do body
    const userId = body.userId || body.user_id;
    const endpoint = body.endpoint;
    const params = body.params;

    console.log(`🔍 userId: ${userId}`);
    console.log(`🔍 endpoint: ${endpoint}`);
    console.log(`🔍 params:`, params);

    // 3. Validar userId
    if (!userId) {
      console.error('❌ userId não fornecido');
      return NextResponse.json(
        { error: 'userId é obrigatório. Envie { userId: "..." } no corpo da requisição.' },
        { status: 400 }
      );
    }

    // 4. Validar endpoint
    if (!endpoint) {
      console.error('❌ endpoint não fornecido');
      return NextResponse.json(
        { error: 'Endpoint não especificado' },
        { status: 400 }
      );
    }

    // 5. Buscar token GPRO do usuário
    console.log(`🔍 Buscando token para userId: ${userId}`);
    
    const { data: userState, error: userError } = await supabase
      .from('user_state')
      .select('gpro_token')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('❌ Erro ao buscar user_state:', userError);
      return NextResponse.json(
        { error: 'Erro ao buscar token GPRO. Configure o token na página de integração.' },
        { status: 500 }
      );
    }

    if (!userState?.gpro_token) {
      console.error('❌ Token GPRO não encontrado para userId:', userId);
      return NextResponse.json(
        { error: 'Token GPRO não encontrado. Configure o token na página de integração.' },
        { status: 404 }
      );
    }

    console.log('✅ Token GPRO encontrado');

    const token = userState.gpro_token;

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