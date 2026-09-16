// app/lib/capture.ts
// ============================================
// CAPTURE CONTRACT
// ============================================
//
// Capture representa uma captura bruta.
// Ela ainda NÃO representa uma Observation.
// Ela ainda NÃO representa conhecimento.
// Ela é apenas um contrato comum entre Sources
// e o Snapshot Adapter.

export interface Capture {
  userId: string;
  endpoint: string;
  source: 'manager_sync' | 'official_api';
  payload: any;
  season?: number;
  race?: number;
}

/**
 * Monta um objeto Capture sem aplicar lógica,
 * sem acessar banco e sem chamar APIs externas.
 */
export function createCapture(capture: Capture): Capture {
  return {
    userId: capture.userId,
    endpoint: capture.endpoint,
    source: capture.source,
    payload: capture.payload,
    season: capture.season,
    race: capture.race,
  };
}
