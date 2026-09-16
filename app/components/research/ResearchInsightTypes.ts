export interface Insight {
  title: string;
  description: string;
  evidenceCount: number;
  variables: string[];
  confidence: number;
  source: string;
}

export interface InsightSection {
  title: string;
  insights: Insight[];
}

export interface LabHighlights {
  lab: string;
  highlights: Insight[];
}
