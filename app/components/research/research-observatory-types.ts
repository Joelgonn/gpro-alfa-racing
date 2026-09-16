export type ResearchLabStatus = 'Ativo' | 'Em evolução' | 'Em construção';

export type ResearchLabSummary = {
  id: string;
  name: string;
  status: ResearchLabStatus;
  variableCount: number;
  excellentVariables: number;
  maxResearchScore: number;
  route: string;
};

export type ResearchVariableSummary = {
  labId: string;
  labName: string;
  path: string;
  score: number;
  coverage: number;
  type: string;
  level: string;
  endpoints: string[];
  route: string;
};

export type ResearchObservatoryData = {
  labs: ResearchLabSummary[];
  variables: ResearchVariableSummary[];
  overview: {
    activeLabs: number;
    catalogedVariables: number;
    excellentVariables: number;
    maxResearchScore: number;
  };
};
