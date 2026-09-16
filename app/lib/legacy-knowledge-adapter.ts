// app/lib/legacy-knowledge-adapter.ts
// ============================================
// LEGACY KNOWLEDGE ADAPTER
// ============================================
//
// Encapsula a análise e montagem da Knowledge Base
// legada sem acesso a React ou efeitos colaterais.

import type { AnalysisInfo, EndpointInfo, CatalogoType } from './knowledge-base';
import { analyzeSchema } from './schema-analyzer';
import {
  calcularConfianca,
  calcularHashSchema,
  calcularMaturidade,
  compactarExemplo,
  criarHistorico,
} from './knowledge-base';

export interface LegacyKnowledgeResult {
  analysis: AnalysisInfo;
  endpointInfo: EndpointInfo;
}

export function analyzeLegacyEndpoint(
  data: any,
  endpointName: string,
  catalogo: CatalogoType
): LegacyKnowledgeResult | null {
  if (!data) return null;

  const schema = analyzeSchema({
    id: `legacy:${endpointName}`,
    source: 'manager_sync',
    endpoint: endpointName,
    payload: data,
    observedAt: new Date().toISOString(),
  } as any);

  const tipos: Record<string, string> = {};

  function analisarObjeto(obj: any, prefixo: string = '') {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      const sample = obj.find(item => item && typeof item === 'object');
      if (sample) {
        analisarObjeto(sample, prefixo);
      }
      return;
    }

    Object.keys(obj).forEach(key => {
      const valor = obj[key];
      const nomeCompleto = prefixo ? `${prefixo}.${key}` : key;

      if (valor !== null && typeof valor === 'object') {
        if (Array.isArray(valor)) {
          if (valor.length > 0) {
            tipos[nomeCompleto] = `Array[${valor.length}]`;
            const sample = valor.find(item => item && typeof item === 'object');
            if (sample) {
              analisarObjeto(sample, nomeCompleto);
            }
          } else {
            tipos[nomeCompleto] = 'Array(vazio)';
          }
        } else {
          tipos[nomeCompleto] = 'Objeto';
          analisarObjeto(valor, nomeCompleto);
        }
      } else {
        tipos[nomeCompleto] = typeof valor;
      }
    });
  }

  analisarObjeto(data);
  const camposSet = new Set<string>(schema.flatFieldList);

  const hash = calcularHashSchema(tipos);
  const historico = [{ data: new Date().toISOString(), campos: camposSet.size, hash }];
  const confianca = calcularConfianca(historico);
  const maturidade = calcularMaturidade(historico);

  const analysis: AnalysisInfo = {
    endpoint: endpointName,
    totalCampos: camposSet.size,
    objetos: schema.objectCount,
    arrays: schema.arrayCount,
    campos: [...camposSet],
    tipos,
    hash,
    status: '🔍 Pendente',
    maturidade,
    confianca,
  };

  const existing = catalogo[endpointName] || {
    campos: [],
    parametros: [],
    totalCampos: 0,
    ultimoScan: '',
    historico: [],
    status: '🔍 Pendente' as const,
    observacoes: '',
    exemplo: compactarExemplo(data),
  };

  const endpointInfo: EndpointInfo = {
    campos: [...camposSet],
    parametros: existing.parametros || [],
    totalCampos: camposSet.size,
    ultimoScan: new Date().toISOString(),
    tipos,
    historico,
    status: existing.status || '🔍 Pendente',
    maturidade,
    observacoes: existing.observacoes || '',
    utilidade: existing.utilidade,
    exemplo: existing.exemplo || compactarExemplo(data),
    exemploHash: hash,
    confianca,
    scansRealizados: (existing.scansRealizados || 0) + 1,
    ultimoHash: hash,
    hashHistory: [...(existing.hashHistory || []), hash].slice(-10),
  };

  return {
    analysis,
    endpointInfo,
  };
}
