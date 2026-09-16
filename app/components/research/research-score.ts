export type ResearchLevel = 'Muito Baixo' | 'Baixo' | 'Médio' | 'Alto' | 'Excelente';

export type ResearchScorable = {
  coverage: number;
  sampleType: string;
  distinctValuesCount: number;
  endpoints: string[];
  occurrences: number;
};

export type ResearchScoreResult = {
  researchScore: number;
  researchLevel: ResearchLevel;
  researchReasons: string[];
};

export function computeResearchScore(variable: ResearchScorable): ResearchScoreResult {
  let score = 0;
  const reasons: string[] = [];

  if (variable.coverage >= 90) {
    score += 35;
    reasons.push('Cobertura acima de 90% (+35)');
  } else if (variable.coverage >= 70) {
    score += 25;
    reasons.push('Cobertura entre 70% e 89% (+25)');
  } else if (variable.coverage >= 50) {
    score += 15;
    reasons.push('Cobertura entre 50% e 69% (+15)');
  } else {
    score += 5;
    reasons.push('Cobertura abaixo de 50% (+5)');
  }

  if (variable.sampleType === 'number') {
    score += 25;
    reasons.push('Tipo numérico (+25)');
  } else if (variable.sampleType === 'boolean') {
    score += 10;
    reasons.push('Tipo booleano (+10)');
  } else if (variable.sampleType === 'string') {
    score += 5;
    reasons.push('Tipo string (+5)');
  } else if (variable.sampleType === 'object' || variable.sampleType === 'array') {
    reasons.push('Tipo objeto/array (+0)');
  } else {
    reasons.push(`Tipo ${variable.sampleType} (+0)`);
  }

  if (variable.distinctValuesCount > 20) {
    score += 20;
    reasons.push('Variabilidade acima de 20 valores distintos (+20)');
  } else if (variable.distinctValuesCount > 10) {
    score += 15;
    reasons.push('Variabilidade acima de 10 valores distintos (+15)');
  } else if (variable.distinctValuesCount > 5) {
    score += 10;
    reasons.push('Variabilidade acima de 5 valores distintos (+10)');
  } else if (variable.distinctValuesCount > 1) {
    score += 5;
    reasons.push('Variabilidade acima de 1 valor distinto (+5)');
  } else {
    reasons.push('Variabilidade insuficiente (+0)');
  }

  if (variable.endpoints.length >= 4) {
    score += 15;
    reasons.push('Presente em 4 ou mais endpoints (+15)');
  } else if (variable.endpoints.length === 3) {
    score += 10;
    reasons.push('Presente em 3 endpoints (+10)');
  } else if (variable.endpoints.length === 2) {
    score += 5;
    reasons.push('Presente em 2 endpoints (+5)');
  } else {
    reasons.push('Presente em 1 endpoint (+0)');
  }

  if (variable.occurrences > 300) {
    score += 5;
    reasons.push('Mais de 300 ocorrências (+5)');
  } else if (variable.occurrences > 150) {
    score += 3;
    reasons.push('Mais de 150 ocorrências (+3)');
  } else if (variable.occurrences > 50) {
    score += 2;
    reasons.push('Mais de 50 ocorrências (+2)');
  } else {
    reasons.push('Ocorrências abaixo de 50 (+0)');
  }

  const researchScore = Math.max(0, Math.min(100, score));
  const researchLevel: ResearchLevel =
    researchScore <= 20 ? 'Muito Baixo'
      : researchScore <= 40 ? 'Baixo'
        : researchScore <= 60 ? 'Médio'
          : researchScore <= 80 ? 'Alto'
            : 'Excelente';

  return { researchScore, researchLevel, researchReasons: reasons };
}
