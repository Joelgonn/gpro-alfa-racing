// app/lib/knowledge-accumulator.ts
// ============================================
// KNOWLEDGE ACCUMULATOR
// ============================================
//
// Serviço puro para resumir uma KnowledgeSession.
// Nesta sprint ele apenas produz informação agregada.

import type { KnowledgeSession } from './knowledge-session';

export interface KnowledgeSessionSummary {
  totalCaptures: number;
  totalObservations: number;
  totalFingerprints: number;
  totalSchemas: number;
  totalEvidences: number;
  totalSnapshots: number;
  uniqueEndpoints: string[];
  uniqueFingerprintValues: string[];
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

/**
 * Resume uma KnowledgeSession sem estado global,
 * banco, cache ou efeitos colaterais.
 */
export function accumulateKnowledge(session: KnowledgeSession): KnowledgeSessionSummary {
  const uniqueEndpoints = uniqueValues(
    session.observations.map(observation => observation.endpoint)
  );

  const uniqueFingerprintValues = uniqueValues(
    session.fingerprints.map(fingerprint => fingerprint.value)
  );

  return {
    totalCaptures: session.captures.length,
    totalObservations: session.observations.length,
    totalFingerprints: session.fingerprints.length,
    totalSchemas: session.schemas.length,
    totalEvidences: session.evidences.length,
    totalSnapshots: session.snapshots.length,
    uniqueEndpoints,
    uniqueFingerprintValues,
  };
}
