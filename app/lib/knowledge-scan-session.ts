// app/lib/knowledge-scan-session.ts
// ============================================
// KNOWLEDGE SCAN SESSION
// ============================================
//
// Encapsula a construção da KnowledgeSession usada
// pelo DiscoveryEngine sem expor o pipeline interno
// ao Explorer.

import { createCapture, type Capture } from './capture';
import { createObservation } from './observation';
import { createFingerprint } from './fingerprint';
import { createEvidence } from './evidence';
import { createKnowledgeSnapshot } from './knowledge-snapshot';
import {
  addCapture,
  addEvidence,
  addFingerprint,
  addObservation,
  addSchema,
  addSnapshot,
  createKnowledgeSession,
  type KnowledgeSession,
} from './knowledge-session';

export interface KnowledgeScanSession {
  addCapture(capture: Capture): void;
  build(): KnowledgeSession;
}

export function createKnowledgeScanSession(): KnowledgeScanSession {
  const session = createKnowledgeSession();

  return {
    addCapture(capture: Capture) {
      const normalizedCapture = createCapture(capture);
      addCapture(session, normalizedCapture);

      const observation = createObservation(normalizedCapture);
      addObservation(session, observation);

      const fingerprint = createFingerprint(observation);
      addFingerprint(session, fingerprint);

      const evidence = createEvidence({ ...observation, fingerprint });
      addSchema(session, evidence.schema);
      addEvidence(session, evidence);

      const snapshot = createKnowledgeSnapshot(evidence);
      addSnapshot(session, snapshot);
    },

    build() {
      return session;
    },
  };
}
