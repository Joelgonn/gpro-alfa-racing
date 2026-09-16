// app/lib/schema-analyzer.ts
// ============================================
// SCHEMA ANALYZER
// ============================================
//
// Este é apenas o primeiro estágio do Schema Analyzer.
// As próximas versões analisarão estruturas internas.

import type { Observation } from './observation';

export interface SchemaDescription {
  fieldCount: number;
  topLevelKeys: string[];
  payloadType: 'object' | 'array' | 'primitive';
  recursiveFieldCount: number;
  objectCount: number;
  arrayCount: number;
  flatFieldList: string[];
  typeMap: Record<string, string>;
}

function getPayloadType(payload: unknown): SchemaDescription['payloadType'] {
  if (Array.isArray(payload)) {
    return 'array';
  }

  if (payload !== null && typeof payload === 'object') {
    return 'object';
  }

  return 'primitive';
}

function analyzeValue(
  value: unknown,
  prefix: string,
  flatFieldList: string[],
  typeMap: Record<string, string>,
  counters: { objectCount: number; arrayCount: number }
) {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    counters.arrayCount += 1;

    const sample = value.find(item => item && typeof item === 'object');
    if (sample) {
      analyzeValue(sample, prefix, flatFieldList, typeMap, counters);
    }
    return;
  }

  if (prefix) {
    counters.objectCount += 1;
  }

  Object.keys(value).forEach(key => {
    const nestedValue = (value as Record<string, unknown>)[key];
    const fieldName = prefix ? `${prefix}.${key}` : key;

    flatFieldList.push(fieldName);

    if (nestedValue !== null && typeof nestedValue === 'object') {
      if (Array.isArray(nestedValue)) {
        counters.arrayCount += 1;
        typeMap[fieldName] = nestedValue.length > 0 ? `Array[${nestedValue.length}]` : 'Array(vazio)';

        const sample = nestedValue.find(item => item && typeof item === 'object');
        if (sample) {
          analyzeValue(sample, fieldName, flatFieldList, typeMap, counters);
        }
      } else {
        typeMap[fieldName] = 'Objeto';
        analyzeValue(nestedValue, fieldName, flatFieldList, typeMap, counters);
      }
    } else {
      typeMap[fieldName] = typeof nestedValue;
    }
  });
}

/**
 * Descreve apenas a estrutura de primeiro nível do payload.
 * Não faz análise profunda, comparação ou inferência.
 */
export function analyzeSchema(observation: Observation): SchemaDescription {
  const payloadType = getPayloadType(observation.payload);
  const topLevelKeys =
    payloadType === 'object'
      ? Object.keys(observation.payload as Record<string, unknown>)
      : [];
  const flatFieldList: string[] = [];
  const typeMap: Record<string, string> = {};
  const counters = { objectCount: 0, arrayCount: 0 };

  if (payloadType === 'object' || payloadType === 'array') {
    analyzeValue(observation.payload, '', flatFieldList, typeMap, counters);
  }

  const fieldCount =
    payloadType === 'array'
      ? (observation.payload as unknown[]).length
      : topLevelKeys.length;

  return {
    fieldCount,
    topLevelKeys,
    payloadType,
    recursiveFieldCount: flatFieldList.length,
    objectCount: counters.objectCount,
    arrayCount: counters.arrayCount,
    flatFieldList,
    typeMap,
  };
}
