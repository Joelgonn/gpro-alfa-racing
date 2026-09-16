// app/lib/fingerprint.ts
// ============================================
// FINGERPRINT ENGINE
// ============================================
//
// Este fingerprint é provisório.
// A implementação definitiva será substituída
// em Sprint futura.

import type { Observation } from './observation';

export interface Fingerprint {
  value: string;
  algorithm: string;
}

/**
 * Cria um fingerprint determinístico e estável.
 * Não usa bibliotecas, crypto ou hash SHA.
 */
export function createFingerprint(observation: Observation): Fingerprint {
  const algorithm = 'stable-observation-key-v1';
  const value = [
    observation.source,
    observation.endpoint,
    observation.season ?? 'na',
    observation.race ?? 'na',
  ].join('|');

  return {
    value,
    algorithm,
  };
}
