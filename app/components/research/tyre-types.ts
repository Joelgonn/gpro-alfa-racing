export type TyreObservationRow = {
  id: string;
  season: number | null;
  race: number | null;
  track: string | null;
  temperature: number | null;
  weather: string | null;
  compound: string | null;
  stint: string | null;
  wear: number | null;
  source: string;
  endpoint: string;
  updatedAt: string;
  payloadKeys: string[];
  hasTyreSignal: boolean;
};

export type TyreTrackRow = {
  name: string;
  observationCount: number;
  minTemperature: number | null;
  maxTemperature: number | null;
  compoundCount: number;
  raceCount: number;
};

export type TyreLabResponse = {
  success: boolean;
  header: {
    observationCount: number;
    raceCount: number;
    trackCount: number;
    latestUpdate: string | null;
  };
  overview: {
    racesAnalyzed: number;
    observations: number;
    uniqueTracks: number;
    compoundsFound: number;
    temperaturesObserved: number;
    coverage: number;
  };
  dataset: TyreObservationRow[];
  trackExplorer: TyreTrackRow[];
  knowledgePanel: {
    discovery: {
      summary: { totalEvents: number; infoCount: number; noticeCount: number; warningCount: number };
      events: Array<{ severity: string; title: string; description: string }>;
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
      fieldAudit: Array<{ path: string; count: number; coverage: number; sampleType: string }>;
      tyreSignals: Array<{ path: string; count: number; endpoints: string[] }>;
      endpointsWithSignals: string[];
      endpointsWithoutSignals: string[];
    };
    variableCatalog: import('@/app/lib/research/research-variable-catalog').ResearchVariableRow[];
  };
  hypotheses: Array<{ title: string; status: string; confidence: number; observations: number }>;
  roadmap: Array<{ label: string; done: boolean }>;
};
