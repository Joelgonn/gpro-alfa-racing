// app/lib/knowledge-persistence-service.ts
// ============================================
// KNOWLEDGE PERSISTENCE SERVICE
// ============================================
//
// Serviço exclusivo de persistência do catálogo
// legado. Nesta versão ele apenas encapsula a
// sequência existente de persistência.

import type { EndpointInfo } from './knowledge-base';
import { saveEndpoint } from './knowledge-base-api';

/**
 * Persiste um endpoint do catálogo legado e retorna
 * o EndpointInfo persistido.
 */
export async function persistEndpointKnowledge(
  endpoint: string,
  endpointInfo: EndpointInfo,
  userId: string
): Promise<EndpointInfo> {
  await saveEndpoint(endpoint, endpointInfo, userId);
  return endpointInfo;
}
