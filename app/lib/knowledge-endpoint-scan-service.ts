// app/lib/knowledge-endpoint-scan-service.ts
// ============================================
// KNOWLEDGE ENDPOINT SCAN SERVICE
// ============================================
//
// Orquestra o workflow de um único endpoint durante
// o scan completo da Knowledge Platform.

import { exploreGproEndpoint } from './gpro-api';
import { autoCategorizar, type CatalogoType, type CategoriasType, type EndpointInfo } from './knowledge-base';
import { processEndpointScan } from './endpoint-scan-service';
import { persistEndpointKnowledge } from './knowledge-persistence-service';
import { createCapture } from './capture';
import { type KnowledgeSession, addCapture } from './knowledge-session';

export interface KnowledgeEndpointScanResult {
  success: boolean;
  endpoint: string;
  endpointInfo?: EndpointInfo;
  requiresParameter?: boolean;
  parameterName?: string;
  saved: boolean;
  logMessage: string;
  failureReason?: string;
  catalogo: CatalogoType;
  categorias: CategoriasType;
  session: KnowledgeSession;
}

export interface KnowledgeEndpointScanContext {
  userId: string;
  endpoint: string;
  catalogo: CatalogoType;
  categorias: CategoriasType;
  session: KnowledgeSession;
}

export async function runKnowledgeEndpointScan(
  context: KnowledgeEndpointScanContext
): Promise<KnowledgeEndpointScanResult> {
  const { userId, endpoint, catalogo, categorias, session } = context;

  try {
    const data = await exploreGproEndpoint(endpoint, undefined, userId);
    const scanResult = processEndpointScan(endpoint, data, catalogo);
    const capture = createCapture({
      userId,
      endpoint,
      source: 'manager_sync',
      payload: data,
    });
    addCapture(session, capture);

    if (scanResult.requiresParameter) {
      const paramName = scanResult.parameterName!;
      const existing = catalogo[endpoint] || {
        campos: [],
        parametros: [],
        totalCampos: 0,
        ultimoScan: '',
        historico: [],
        status: '🔍 Pendente' as const,
        observacoes: ''
      };

      const endpointInfo = scanResult.endpointInfo || {
        ...existing,
        parametros: [paramName],
      };

      try {
        await persistEndpointKnowledge(endpoint, endpointInfo, userId);
        return {
          success: true,
          endpoint,
          endpointInfo,
          requiresParameter: true,
          parameterName: paramName,
          saved: true,
          logMessage: `⚠️ ${endpoint} - Requer parâmetro: ${paramName} | salvo`,
          catalogo,
          categorias,
          session,
        };
      } catch (error: any) {
        return {
          success: false,
          endpoint,
          endpointInfo,
          requiresParameter: true,
          parameterName: paramName,
          saved: false,
          logMessage: `❌ ${endpoint} - Parâmetro detectado mas falhou ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          failureReason: error instanceof Error ? error.message : 'Erro desconhecido',
          catalogo,
          categorias,
          session,
        };
      }
    }

    if (scanResult.success && scanResult.endpointInfo) {
      const endpointInfo = scanResult.endpointInfo;

      if (!categorias[endpoint]) {
        const categoriaSugerida = autoCategorizar(endpoint);
        if (categoriaSugerida) {
          categorias[endpoint] = categoriaSugerida;
        }
      }

      try {
        await persistEndpointKnowledge(endpoint, endpointInfo, userId);
        return {
          success: true,
          endpoint,
          endpointInfo,
          saved: true,
          logMessage: `✅ ${endpoint} - ${endpointInfo.campos.length} campos | ${endpointInfo.maturidade} | conf: ${endpointInfo.confianca}% (salvo)`,
          catalogo,
          categorias,
          session,
        };
      } catch (error: any) {
        return {
          success: false,
          endpoint,
          endpointInfo,
          saved: false,
          logMessage: `❌ ${endpoint} - Analisado mas falhou ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          failureReason: error instanceof Error ? error.message : 'Erro desconhecido',
          catalogo,
          categorias,
          session,
        };
      }
    }

    return {
      success: false,
      endpoint,
      requiresParameter: false,
      saved: false,
      logMessage: scanResult.logMessage,
      failureReason: scanResult.logMessage,
      catalogo,
      categorias,
      session,
    };
  } catch (error: any) {
    const scanResult = processEndpointScan(endpoint, null, catalogo, error.message || 'Erro desconhecido');

    if (scanResult.requiresParameter && scanResult.endpointInfo) {
      try {
        await persistEndpointKnowledge(endpoint, scanResult.endpointInfo, userId);
        return {
          success: true,
          endpoint,
          endpointInfo: scanResult.endpointInfo,
          requiresParameter: true,
          parameterName: scanResult.parameterName,
          saved: true,
          logMessage: `${scanResult.logMessage} (salvo)`,
          catalogo,
          categorias,
          session,
        };
      } catch (saveError: any) {
        return {
          success: false,
          endpoint,
          endpointInfo: scanResult.endpointInfo,
          requiresParameter: true,
          parameterName: scanResult.parameterName,
          saved: false,
          logMessage: `❌ ${endpoint} - Parâmetro detectado mas falhou ao salvar: ${saveError instanceof Error ? saveError.message : 'Erro desconhecido'}`,
          failureReason: saveError instanceof Error ? saveError.message : 'Erro desconhecido',
          catalogo,
          categorias,
          session,
        };
      }
    }

    return {
      success: false,
      endpoint,
      saved: false,
      logMessage: scanResult.logMessage,
      failureReason: scanResult.logMessage,
      catalogo,
      categorias,
      session,
    };
  }
}
