// app/lib/observation-pipeline.ts
// ============================================
// OBSERVATION PIPELINE
// ============================================
//
// Orquestrador mínimo da nova arquitetura.
// Nesta sprint ele apenas converte Capture em Observation.

import type { Capture } from './capture';
import { addCapture, addEvidence, addFingerprint, addObservation, addSchema, addSnapshot, createKnowledgeSession } from './knowledge-session';
import type { Observation } from './observation';
import { createFingerprint } from './fingerprint';
import { createEvidence } from './evidence';
import { createKnowledgeSnapshot } from './knowledge-snapshot';
import { createObservation } from './observation';

/**
 * Processa uma Capture e retorna uma única Observation.
 * Sem persistência, sem hashes e sem efeitos colaterais.
 */
export function processCapture(capture: Capture): Observation {
  const session = createKnowledgeSession();
  addCapture(session, capture);

  const observation = createObservation(capture);
  addObservation(session, observation);

  const fingerprint = createFingerprint(observation);
  addFingerprint(session, fingerprint);

  const evidence = createEvidence({
    ...observation,
    fingerprint,
  });
  addSchema(session, evidence.schema);
  addEvidence(session, evidence);
  // Evidence criada apenas para validar o pipeline da nova arquitetura.
  void evidence;

  const snapshot = createKnowledgeSnapshot(evidence);
  addSnapshot(session, snapshot);
  // KnowledgeSnapshot é apenas um Read Model temporário utilizado para validar a pipeline.
  void snapshot;

  // KnowledgeSession permanece apenas em memória durante a execução da pipeline.
  void session;

  return {
    ...observation,
    fingerprint,
  };
}
