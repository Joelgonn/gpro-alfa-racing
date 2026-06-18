// app/lib/knowledge-base-api.ts
// ============================================
// HELPER PARA CONSUMIR A API DA KNOWLEDGE BASE
// ============================================
// Todas as funções agora recebem userId explicitamente
// O userId é enviado via header 'user-id'
// ============================================

import { type CatalogoType, type EndpointInfo } from './knowledge-base';

/**
 * Busca todo o catálogo do usuário
 * @param userId - ID do usuário autenticado
 * @returns Catálogo completo
 */
export async function getCatalogo(userId: string): Promise<CatalogoType> {
  const response = await fetch('/api/admin/gpro-kb', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'user-id': userId,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao buscar catálogo');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Erro ao buscar catálogo');
  }

  return data.catalogo || {};
}

/**
 * Salva um endpoint no catálogo
 * @param endpoint - Nome do endpoint
 * @param info - Dados do endpoint
 * @param userId - ID do usuário autenticado
 * @returns EndpointInfo salvo
 */
export async function saveEndpoint(
  endpoint: string,
  info: EndpointInfo,
  userId: string
): Promise<EndpointInfo> {
  const response = await fetch('/api/admin/gpro-kb', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-id': userId,
    },
    body: JSON.stringify({ endpoint, info }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao salvar endpoint');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Erro ao salvar endpoint');
  }

  return data.data;
}

/**
 * Remove um endpoint específico do catálogo
 * @param endpoint - Nome do endpoint
 * @param userId - ID do usuário autenticado
 */
export async function deleteEndpoint(endpoint: string, userId: string): Promise<void> {
  const response = await fetch(`/api/admin/gpro-kb?endpoint=${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'user-id': userId,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao remover endpoint');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Erro ao remover endpoint');
  }
}

/**
 * Remove toda a knowledge base do usuário
 * @param userId - ID do usuário autenticado
 */
export async function deleteCatalogo(userId: string): Promise<void> {
  const response = await fetch('/api/admin/gpro-kb', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'user-id': userId,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao remover catálogo');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Erro ao remover catálogo');
  }
}

/**
 * Salva múltiplos endpoints de uma vez (útil para scan)
 * Usa Promise.allSettled para execução paralela e não bloqueante
 * @param catalogo - Catálogo completo
 * @param userId - ID do usuário autenticado
 * @param onProgress - Callback opcional para progresso
 * @returns Catálogo salvo com resultados
 */
export async function saveCatalogo(
  catalogo: CatalogoType,
  userId: string,
  onProgress?: (salvos: number, total: number, endpoint: string) => void
): Promise<{
  success: CatalogoType;
  failed: { endpoint: string; error: string }[];
  total: number;
  salvos: number;
  falhas: number;
}> {
  const entries = Object.entries(catalogo);
  const total = entries.length;
  let salvos = 0;
  const failed: { endpoint: string; error: string }[] = [];
  const success: CatalogoType = {};

  // Executa todas as requisições em paralelo
  const results = await Promise.allSettled(
    entries.map(async ([endpoint, info]) => {
      const saved = await saveEndpoint(endpoint, info, userId);
      return { endpoint, saved };
    })
  );

  // Processa os resultados
  results.forEach((result, index) => {
    const endpoint = entries[index][0];
    
    if (result.status === 'fulfilled') {
      success[endpoint] = result.value.saved;
      salvos++;
      if (onProgress) {
        onProgress(salvos, total, endpoint);
      }
    } else {
      failed.push({
        endpoint,
        error: result.reason?.message || 'Erro desconhecido'
      });
      if (onProgress) {
        onProgress(salvos, total, endpoint);
      }
    }
  });

  if (failed.length > 0) {
    console.warn(`⚠️ ${failed.length} endpoints falharam ao salvar:`, failed);
  }

  return {
    success,
    failed,
    total,
    salvos,
    falhas: failed.length
  };
}

/**
 * Versão síncrona do saveCatalogo para compatibilidade
 * @param catalogo - Catálogo completo
 * @param userId - ID do usuário autenticado
 * @returns Catálogo salvo
 */
export async function saveCatalogoSimple(
  catalogo: CatalogoType,
  userId: string
): Promise<CatalogoType> {
  const result = await saveCatalogo(catalogo, userId);
  return result.success;
}