// app/lib/source.ts
// ============================================
// SOURCE MODEL
// ============================================
//
// Source representa apenas a origem de uma captura.
// Nesta sprint ele não participa de estratégia,
// pipeline ou lógica de aquisição.

export type SourceType = 'manager_sync' | 'official_api';

export interface Source {
  id: SourceType;
  name: string;
  version?: string;
  priority?: number;
}

export const KNOWN_SOURCES: Source[] = [
  {
    id: 'manager_sync',
    name: 'Manager Sync',
    priority: 1,
  },
  {
    id: 'official_api',
    name: 'Official API',
    priority: 2,
  },
];

export function getKnownSources(): Source[] {
  return [...KNOWN_SOURCES];
}
