export type FuelObservationRow = {
  id: string;
  season: number | null;
  race: number | null;
  track: string | null;
  temperature: number | null;
  weather: string | null;
  source: string;
  endpoint: string;
  createdAt: string;
  payload: Record<string, unknown>;
  payloadKeys: string[];
  pathCount: number;
};

export type FuelTrackRow = {
  name: string;
  observationCount: number;
  minTemperature: number | null;
  maxTemperature: number | null;
  endpointCount: number;
  raceCount: number;
};

export type FuelFieldAudit = {
  path: string;
  count: number;
  coverage: number;
  sampleType: string;
};

export type FuelSignalSummary = {
  path: string;
  count: number;
  endpoints: string[];
};

export type { ResearchVariableMaturity as FuelVariableMaturity, ResearchVariableStats as FuelVariableStats, ResearchVariableCategoricalStats as FuelVariableCategoricalStats, ResearchVariableRow as FuelVariableRow } from '@/app/lib/research/research-variable-catalog';

export type FuelLabResponse = {
  success: boolean;
  header: {
    observationCount: number;
    raceCount: number;
    trackCount: number;
    latestUpdate: string | null;
  };
  overview: {
    snapshotsAnalyzed: number;
    observations: number;
    uniqueTracks: number;
    fieldsAudited: number;
    coverage: number;
    fuelSignals: number;
  };
  dataset: FuelObservationRow[];
  trackExplorer: FuelTrackRow[];
  knowledgePanel: {
    discovery: {
      summary: { totalEvents: number; infoCount: number; noticeCount: number; warningCount: number };
      events: Array<{ severity: string; title: string; description: string; category?: string; subject?: string; metadata?: Record<string, unknown> }>;
      totals: { endpointCount: number; schemaChanges: number; newEndpoints: number; newFields: number };
    };
    knowledgeSummary: {
      totalCaptures: number;
      totalObservations: number;
      totalFingerprints: number;
      totalSchemas: number;
      totalEvidences: number;
      totalSnapshots: number;
      uniqueEndpoints: string[];
      uniqueFingerprintValues: string[];
    };
    schemaPreview: null | {
      fieldCount: number;
      topLevelKeys: string[];
      payloadType: 'object' | 'array' | 'primitive';
      recursiveFieldCount: number;
      objectCount: number;
      arrayCount: number;
      flatFieldList: string[];
      typeMap: Record<string, string>;
    };
    evidencePreview: unknown;
    auditSummary: {
      totalSnapshots: number;
      uniquePaths: number;
      fieldsIn100Percent: string[];
      fieldAudit: FuelFieldAudit[];
      fuelSignals: FuelSignalSummary[];
      endpointsWithSignals: string[];
      endpointsWithoutSignals: string[];
    };
    variableCatalog: import('@/app/lib/research/research-variable-catalog').ResearchVariableRow[];
  };
  hypotheses: Array<{ title: string; status: string; confidence: number; observations: number; description: string }>;
  roadmap: Array<{ label: string; done: boolean }>;
};
