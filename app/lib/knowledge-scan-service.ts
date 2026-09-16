// app/lib/knowledge-scan-service.ts
// ============================================
// KNOWLEDGE SCAN SERVICE
// ============================================
//
// Ponto oficial de orquestração do scan completo da
// Knowledge Platform.
// Nesta sprint existe apenas o contrato.

import type { CatalogoType, CategoriasType, EndpointInfo } from './knowledge-base';
import type { DiscoveryReadModel } from './discovery-read-model';
import type { KnowledgeSession } from './knowledge-session';

export interface KnowledgeScanProgress {
  current: number;
  total: number;
  currentEndpoint: string;
}

export interface KnowledgeScanLog {
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
}

export interface KnowledgeScanOptions {
  userId: string;
  endpoints: string[];
  catalogo: CatalogoType;
  categorias: CategoriasType;
  cancelRequested?: () => boolean;
}

export interface KnowledgeScanCallbacks {
  onProgress?: (progress: KnowledgeScanProgress) => void;
  onLog?: (log: KnowledgeScanLog) => void;
  onCatalogUpdate?: (endpoint: string, endpointInfo: EndpointInfo) => void;
  onDiscovery?: (discovery: DiscoveryReadModel) => void;
  onSession?: (session: KnowledgeSession) => void;
  onEndpoint?: (endpoint: string, index: number, total: number) => Promise<void> | void;
}

export interface KnowledgeScanResult {
  success: boolean;
  salvosComSucesso: number;
  falhas: number;
  catalogo: CatalogoType;
  discovery?: DiscoveryReadModel;
  session?: KnowledgeSession;
}

/**
 * Contrato oficial do workflow de scan completo.
 * A implementação será introduzida em Sprint futura.
 */
export async function runKnowledgeScan(
  options: KnowledgeScanOptions,
  callbacks: KnowledgeScanCallbacks = {}
): Promise<KnowledgeScanResult> {
  let success = true;
  const total = options.endpoints.length;

  for (let index = 0; index < total; index++) {
    if (options.cancelRequested?.()) {
      success = false;
      break;
    }

    const endpoint = options.endpoints[index];

    callbacks.onProgress?.({
      current: index + 1,
      total,
      currentEndpoint: endpoint,
    });

    await callbacks.onEndpoint?.(endpoint, index, total);
  }

  return {
    success,
    salvosComSucesso: 0,
    falhas: 0,
    catalogo: options.catalogo,
  };
}
