// app/lib/knowledge-snapshot.ts
// ============================================
// KNOWLEDGE SNAPSHOT
// ============================================
//
// KnowledgeSnapshot é apenas um Read Model temporário
// utilizado para validar a pipeline.
// Ele NÃO representa conhecimento definitivo.

import type { Evidence } from './evidence';
import type { Fingerprint } from './fingerprint';
import type { Observation } from './observation';
import type { SchemaDescription } from './schema-analyzer';

export interface KnowledgeSnapshot {
  observation: Observation;
  fingerprint: Fingerprint;
  schema: SchemaDescription;
  evidence: Evidence;
  generatedAt: string;
}

/**
 * Monta o Read Model temporário da pipeline.
 * Nenhuma inferência, persistência ou lógica adicional.
 */
export function createKnowledgeSnapshot(evidence: Evidence): KnowledgeSnapshot {
  return {
    observation: evidence.observation,
    fingerprint: evidence.fingerprint,
    schema: evidence.schema,
    evidence,
    generatedAt: new Date().toISOString(),
  };
}
