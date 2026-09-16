// app/lib/evidence.ts
// ============================================
// EVIDENCE PIPELINE
// ============================================
//
// Evidence representa um fato observado enriquecido,
// mas ainda não reconciliado.

import type { Observation } from './observation';
import type { Fingerprint } from './fingerprint';
import { createFingerprint } from './fingerprint';
import { analyzeSchema, type SchemaDescription } from './schema-analyzer';

export interface Evidence {
  observation: Observation;
  fingerprint: Fingerprint;
  schema: SchemaDescription;
  createdAt: string;
}

/**
 * Cria uma Evidence completa a partir de uma Observation.
 * Se o fingerprint não existir, ele é criado aqui.
 * Em seguida o schema de primeiro nível é descrito.
 */
export function createEvidence(observation: Observation): Evidence {
  const fingerprint = observation.fingerprint ?? createFingerprint(observation);
  const schema = analyzeSchema(observation);

  return {
    observation,
    fingerprint,
    schema,
    createdAt: new Date().toISOString(),
  };
}
