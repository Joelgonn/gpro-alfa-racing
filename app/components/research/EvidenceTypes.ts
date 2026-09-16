export type EvidenceStatus = 'Fraca' | 'Moderada' | 'Forte';

export interface Evidence {
  id: string;
  title: string;
  description: string;
  variables: string[];
  observations: number;
  coverage: number;
  confidence: number;
  tracks: number;
  seasons: number;
  endpoints: number;
  status: EvidenceStatus;
  source: string;
}
