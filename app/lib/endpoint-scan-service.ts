// app/lib/endpoint-scan-service.ts
// ============================================
// ENDPOINT SCAN SERVICE
// ============================================
//
// Serviço puro responsável por processar um endpoint
// durante o scan do Explorer.

import type { AnalysisInfo, CatalogoType, EndpointInfo } from './knowledge-base';
import { analyzeLegacyEndpoint } from './legacy-knowledge-adapter';
import { detectarParametro } from './knowledge-base';

export interface EndpointScanResult {
  success: boolean;
  endpointInfo?: EndpointInfo;
  analysis?: AnalysisInfo;
  requiresParameter: boolean;
  parameterName?: string;
  logMessage: string;
}

export function processEndpointScan(
  endpoint: string,
  data: any,
  catalogo: CatalogoType,
  errorMessage?: string
): EndpointScanResult {
  if (errorMessage) {
    const parameterName = detectarParametro(errorMessage);
    if (parameterName) {
      const existing = catalogo[endpoint] || {
        campos: [],
        parametros: [],
        totalCampos: 0,
        ultimoScan: '',
        historico: [],
        status: '🔍 Pendente' as const,
        observacoes: '',
      };

      const parametrosSet = new Set([...(existing.parametros || []), parameterName]);
      const endpointInfo: EndpointInfo = {
        ...existing,
        parametros: [...parametrosSet],
        ultimoScan: new Date().toISOString(),
        historico: existing.historico || [],
        confianca: existing.confianca,
        maturidade: existing.maturidade,
        scansRealizados: (existing.scansRealizados || 0) + 1,
      };

      return {
        success: true,
        endpointInfo,
        requiresParameter: true,
        parameterName,
        logMessage: `⚠️ ${endpoint} - Requer parâmetro: ${parameterName}`,
      };
    }

    return {
      success: false,
      requiresParameter: false,
      logMessage: `❌ ${endpoint} - ${errorMessage}`,
    };
  }

  if (!data) {
    return {
      success: false,
      requiresParameter: false,
      logMessage: `⚠️ ${endpoint} - Resposta vazia`,
    };
  }

  const result = analyzeLegacyEndpoint(data, endpoint, catalogo);

  if (!result) {
    return {
      success: false,
      requiresParameter: false,
      logMessage: `⚠️ ${endpoint} - Resposta vazia`,
    };
  }

  return {
    success: true,
    endpointInfo: result.endpointInfo,
    analysis: result.analysis,
    requiresParameter: false,
    logMessage: `✅ ${endpoint} - ${result.endpointInfo.campos.length} campos | ${result.endpointInfo.maturidade} | conf: ${result.endpointInfo.confianca}%`,
  };
}
