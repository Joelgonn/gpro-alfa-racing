// app/lib/knowledge-session.ts
// ============================================
// KNOWLEDGE SESSION
// ============================================
//
// KnowledgeSession representa apenas o estado da
// execução atual da pipeline.
// Ela NÃO representa banco, conhecimento persistido
// ou Replay.

import type { Capture } from './capture';
import type { Evidence } from './evidence';
import type { Fingerprint } from './fingerprint';
import type { KnowledgeSnapshot } from './knowledge-snapshot';
import type { Observation } from './observation';
import type { SchemaDescription } from './schema-analyzer';

export interface KnowledgeSession {
  captures: Capture[];
  observations: Observation[];
  fingerprints: Fingerprint[];
  schemas: SchemaDescription[];
  evidences: Evidence[];
  snapshots: KnowledgeSnapshot[];
}

export function createKnowledgeSession(): KnowledgeSession {
  return {
    captures: [],
    observations: [],
    fingerprints: [],
    schemas: [],
    evidences: [],
    snapshots: [],
  };
}

export function addCapture(session: KnowledgeSession, capture: Capture) {
  session.captures.push(capture);
}

export function addObservation(session: KnowledgeSession, observation: Observation) {
  session.observations.push(observation);
}

export function addFingerprint(session: KnowledgeSession, fingerprint: Fingerprint) {
  session.fingerprints.push(fingerprint);
}

export function addSchema(session: KnowledgeSession, schema: SchemaDescription) {
  session.schemas.push(schema);
}

export function addEvidence(session: KnowledgeSession, evidence: Evidence) {
  session.evidences.push(evidence);
}

export function addSnapshot(session: KnowledgeSession, snapshot: KnowledgeSnapshot) {
  session.snapshots.push(snapshot);
}
