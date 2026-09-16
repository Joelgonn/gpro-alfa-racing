export type DriverEnergyObservationRow = {
  id: string;
  season: number | null;
  race: number | null;
  track: string | null;
  temperature: number | null;
  weather: string | null;
  driver: string | null;
  energyInitial: number | null;
  energyFinal: number | null;
  energyLost: number | null;
  energyRecovered: number | null;
  source: string;
  endpoint: string;
  createdAt: string;
  payload: Record<string, unknown>;
  payloadKeys: string[];
};

export type DriverEnergyLabResponse = {
  success: boolean;
  header: {
    observationCount: number;
    raceCount: number;
    trackCount: number;
    latestUpdate: string | null;
  };
  overview: {
    observations: number;
    racesAnalyzed: number;
    pilots: number;
    uniqueTracks: number;
    coverage: number;
    variablesCataloged: number;
    maxResearchScore: number;
  };
  dataset: DriverEnergyObservationRow[];
  trackExplorer: Array<{
    name: string;
    observationCount: number;
    minTemperature: number | null;
    maxTemperature: number | null;
    endpointCount: number;
    raceCount: number;
  }>;
  discovery: {
    averageResearchScore: number;
    variableCount: number;
    excellentVariables: number;
    coverage: number;
  };
  knowledgePanel: {
    discovery: unknown;
    knowledgeSummary: unknown;
    schemaPreview: unknown;
    evidencePreview: unknown;
    auditSummary: unknown;
    variableCatalog: import('@/app/lib/research/research-variable-catalog').ResearchVariableRow[];
  };
  hypotheses: Array<{ title: string; status: string; confidence: number; observations: number; description: string }>;
  roadmap: Array<{ label: string; done: boolean }>;
};
