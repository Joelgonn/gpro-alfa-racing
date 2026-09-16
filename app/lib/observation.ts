// app/lib/observation.ts
// ============================================
// OBSERVATION BUILDER
// ============================================
//
// Capture representa transporte.
// Observation representa um fato observado.

import type { Capture } from './capture';
import type { Fingerprint } from './fingerprint';

export interface Observation {
  id: string;
  source: Capture['source'];
  endpoint: string;
  payload: any;
  season?: number;
  race?: number;
  observedAt: string;
  fingerprint?: Fingerprint;
}

/**
 * Converte uma Capture em Observation sem efeitos colaterais.
 * Nenhuma persistência, hash ou inferência é executada aqui.
 */
export function createObservation(capture: Capture): Observation {
  return {
    id: `${capture.source}:${capture.endpoint}:${capture.season ?? 'na'}:${capture.race ?? 'na'}:${Date.now()}`,
    source: capture.source,
    endpoint: capture.endpoint,
    payload: capture.payload,
    season: capture.season,
    race: capture.race,
    observedAt: new Date().toISOString(),
  };
}
