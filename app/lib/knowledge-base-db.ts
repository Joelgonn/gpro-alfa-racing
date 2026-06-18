// app/lib/knowledge-base-db.ts
// ============================================
// CAMADA DE PERSISTÊNCIA DA KNOWLEDGE BASE
// ============================================
// ⚠️ ATENÇÃO: Este arquivo é SERVER ONLY
// Não importar em componentes client-side ("use client")
// ============================================

import "server-only";

import { createClient } from '@supabase/supabase-js';
import {
  type EndpointInfo,
  type CatalogoType,
  type KnowledgeBaseRow,
  endpointInfoToDb,
  dbToEndpointInfo
} from './knowledge-base';

// ============================================
// CLIENTE SUPABASE - SERVER ONLY
// ============================================
// Usamos SERVICE_ROLE_KEY apenas em Server Context
// Este arquivo NUNCA deve ser importado em componentes client
// import "server-only" garante que o Next.js impeça importações acidentais
// ============================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// FUNÇÕES DE PERSISTÊNCIA
// ============================================

/**
 * Busca todos os endpoints da knowledge base de um usuário
 * @param userId - ID do usuário
 * @returns Catálogo completo do usuário
 */
export async function getKnowledgeBase(userId: string): Promise<CatalogoType> {
  const { data, error } = await supabase
    .from('api_knowledge_base')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Erro ao buscar knowledge base:', error);
    throw new Error(`Erro ao buscar knowledge base: ${error.message}`);
  }

  const catalogo: CatalogoType = {};
  (data || []).forEach((row: KnowledgeBaseRow) => {
    catalogo[row.endpoint] = dbToEndpointInfo(row);
  });

  return catalogo;
}

/**
 * Busca um endpoint específico do usuário
 * @param userId - ID do usuário
 * @param endpoint - Nome do endpoint
 * @returns Informações do endpoint ou null
 */
export async function loadEndpoint(
  userId: string,
  endpoint: string
): Promise<EndpointInfo | null> {
  const { data, error } = await supabase
    .from('api_knowledge_base')
    .select('*')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Não encontrado
      return null;
    }
    console.error('Erro ao buscar endpoint:', error);
    throw new Error(`Erro ao buscar endpoint: ${error.message}`);
  }

  return data ? dbToEndpointInfo(data as KnowledgeBaseRow) : null;
}

/**
 * Cria ou atualiza um endpoint na knowledge base
 * @param userId - ID do usuário
 * @param endpoint - Nome do endpoint
 * @param info - Dados do endpoint
 * @returns EndpointInfo salvo
 */
export async function upsertEndpoint(
  userId: string,
  endpoint: string,
  info: EndpointInfo
): Promise<EndpointInfo> {
  const dbData = endpointInfoToDb(info);

  const { data, error } = await supabase
    .from('api_knowledge_base')
    .upsert(
      {
        user_id: userId,
        endpoint: endpoint,
        ...dbData
      },
      {
        onConflict: 'user_id, endpoint',
        ignoreDuplicates: false
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar endpoint:', error);
    throw new Error(`Erro ao salvar endpoint: ${error.message}`);
  }

  return dbToEndpointInfo(data as KnowledgeBaseRow);
}

/**
 * Salva múltiplos endpoints de uma vez
 * @param userId - ID do usuário
 * @param catalogo - Catálogo completo
 * @returns Catálogo salvo
 */
export async function saveKnowledgeBase(
  userId: string,
  catalogo: CatalogoType
): Promise<CatalogoType> {
  const entries = Object.entries(catalogo);
  const results: CatalogoType = {};

  for (const [endpoint, info] of entries) {
    try {
      const saved = await upsertEndpoint(userId, endpoint, info);
      results[endpoint] = saved;
    } catch (error) {
      console.error(`Erro ao salvar endpoint ${endpoint}:`, error);
      // Continua com os outros endpoints
    }
  }

  return results;
}

/**
 * Remove um endpoint específico da knowledge base
 * @param userId - ID do usuário
 * @param endpoint - Nome do endpoint
 */
export async function deleteEndpoint(
  userId: string,
  endpoint: string
): Promise<void> {
  const { error } = await supabase
    .from('api_knowledge_base')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  if (error) {
    console.error('Erro ao deletar endpoint:', error);
    throw new Error(`Erro ao deletar endpoint: ${error.message}`);
  }
}

/**
 * Remove toda a knowledge base de um usuário
 * @param userId - ID do usuário
 */
export async function deleteKnowledgeBase(userId: string): Promise<void> {
  const { error } = await supabase
    .from('api_knowledge_base')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Erro ao deletar knowledge base:', error);
    throw new Error(`Erro ao deletar knowledge base: ${error.message}`);
  }
}

/**
 * Busca estatísticas da knowledge base do usuário
 * @param userId - ID do usuário
 * @returns Estatísticas
 */
export async function getKnowledgeBaseStats(userId: string): Promise<{
  totalEndpoints: number;
  totalCampos: number;
  camposPorCategoria: Record<string, number>;
  endpointsPorStatus: Record<string, number>;
  endpointsPorMaturidade: Record<string, number>;
}> {
  const catalogo = await getKnowledgeBase(userId);
  
  const totalEndpoints = Object.keys(catalogo).length;
  const todosCampos = new Set(Object.values(catalogo).flatMap(info => info.campos));
  const totalCampos = todosCampos.size;

  return {
    totalEndpoints,
    totalCampos,
    camposPorCategoria: {},
    endpointsPorStatus: {},
    endpointsPorMaturidade: {}
  };
}