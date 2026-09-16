// app/lib/discovery-service.ts
// ============================================
// DISCOVERY SERVICE
// ============================================
//
// Ponto oficial de orquestração da etapa de Discovery.

import type { KnowledgeSession } from './knowledge-session';
import { createDiscoveryReport } from './discovery-engine';
import { createDiscoveryReadModel, type DiscoveryReadModel } from './discovery-read-model';

export function runDiscovery(session: KnowledgeSession): DiscoveryReadModel {
  const report = createDiscoveryReport(session);
  return createDiscoveryReadModel(report);
}
