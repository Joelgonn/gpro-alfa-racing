import { computeResearchScore } from '@/app/components/research/research-score';

export type ResearchVariableMaturity = 'Experimental' | 'Observada' | 'Relevante' | 'Consolidada';
export type ResearchVariableStats = { min: number | null; max: number | null; avg: number | null; distinctValuesCount: number; };
export type ResearchVariableCategoricalStats = { distinctValuesCount: number; topValues: Array<{ value: string; count: number }>; };
export type ResearchVariableRow = {
  path: string;
  sampleType: string;
  occurrences: number;
  coverage: number;
  distinctValuesCount: number;
  sampleValues: string[];
  endpoints: string[];
  firstSeen: string;
  lastSeen: string;
  maturity: ResearchVariableMaturity;
  numericStats: ResearchVariableStats | null;
  categoricalStats: ResearchVariableCategoricalStats | null;
  researchScore: number;
  researchLevel: 'Muito Baixo' | 'Baixo' | 'Médio' | 'Alto' | 'Excelente';
  researchReasons: string[];
};

function collectVariableEntries(value: any, prefix = '', out = new Map<string, { type: string; value: unknown }>()) {
  const pathKey = prefix || '<root>';
  out.set(pathKey, { type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value, value });
  if (Array.isArray(value)) for (const item of value) collectVariableEntries(item, prefix, out);
  else if (value && typeof value === 'object') for (const [key, nested] of Object.entries(value)) collectVariableEntries(nested, prefix ? `${prefix}.${key}` : key, out);
  return out;
}

type CatalogInputRow = {
  payload?: any;
  endpoint?: string;
  created_at?: string | null;
  createdAt?: string | null;
  [key: string]: any;
};

function resolveObservationValue(row: CatalogInputRow) {
  if (row.payload && typeof row.payload === 'object') return row.payload;
  const { payload, endpoint, created_at, createdAt, ...rest } = row;
  return rest;
}

export function buildResearchVariableCatalog(rows: CatalogInputRow[]): ResearchVariableRow[] {
  const totalSnapshots = rows.length;
  const aggregates = new Map<string, {
    path: string; occurrences: number; types: Map<string, number>; values: Map<string, number>; endpoints: Set<string>; firstSeen: string | null; lastSeen: string | null; numericValues: number[]; stringValues: Map<string, number>;
  }>();
  for (const row of rows) {
    const rowValue = resolveObservationValue(row);
    const rowVariables = collectVariableEntries(rowValue);
    const rowEndpoint = row.endpoint ?? 'driver-energy';
    for (const [path, entry] of rowVariables.entries()) {
      if (path === '<root>') continue;
      const aggregate = aggregates.get(path) ?? { path, occurrences: 0, types: new Map<string, number>(), values: new Map<string, number>(), endpoints: new Set<string>(), firstSeen: null, lastSeen: null, numericValues: [], stringValues: new Map<string, number>() };
      aggregate.occurrences += 1;
      aggregate.types.set(entry.type, (aggregate.types.get(entry.type) || 0) + 1);
      aggregate.endpoints.add(rowEndpoint);
      const createdAt = row.created_at ?? row.createdAt ?? '';
      if (!aggregate.firstSeen || createdAt < aggregate.firstSeen) aggregate.firstSeen = createdAt;
      if (!aggregate.lastSeen || createdAt > aggregate.lastSeen) aggregate.lastSeen = createdAt;
      const sampleValue = entry.value;
      const serialized = sampleValue === null ? 'null' : typeof sampleValue === 'string' ? sampleValue : typeof sampleValue === 'number' || typeof sampleValue === 'boolean' ? String(sampleValue) : JSON.stringify(sampleValue) ?? '[unserializable]';
      aggregate.values.set(serialized, (aggregate.values.get(serialized) || 0) + 1);
      if (typeof sampleValue === 'number' && Number.isFinite(sampleValue)) aggregate.numericValues.push(sampleValue);
      if (typeof sampleValue === 'string' && sampleValue.trim()) aggregate.stringValues.set(sampleValue, (aggregate.stringValues.get(sampleValue) || 0) + 1);
      aggregates.set(path, aggregate);
    }
  }
  return Array.from(aggregates.values()).map(variable => {
    const sampleType = Array.from(variable.types.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
    const coverage = totalSnapshots ? Math.round((variable.occurrences / totalSnapshots) * 100) : 0;
    const distinctValues = Array.from(variable.values.keys());
    const distinctValuesCount = distinctValues.length;
    const maturity: ResearchVariableMaturity = coverage < 20 ? 'Experimental' : coverage < 60 ? 'Observada' : coverage < 90 ? 'Relevante' : 'Consolidada';
    const numericStats = sampleType === 'number' && variable.numericValues.length > 0 ? { min: Math.min(...variable.numericValues), max: Math.max(...variable.numericValues), avg: variable.numericValues.reduce((s, v) => s + v, 0) / variable.numericValues.length, distinctValuesCount: new Set(variable.numericValues).size } : null;
    const categoricalStats = sampleType === 'string' ? { distinctValuesCount, topValues: Array.from(variable.stringValues.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, 10) } : null;
    const score = computeResearchScore({ coverage, sampleType, distinctValuesCount, endpoints: Array.from(variable.endpoints).sort(), occurrences: variable.occurrences });
    return { path: variable.path, sampleType, occurrences: variable.occurrences, coverage, distinctValuesCount, sampleValues: distinctValues.slice(0, 5), endpoints: Array.from(variable.endpoints).sort(), firstSeen: variable.firstSeen ?? '', lastSeen: variable.lastSeen ?? '', maturity, numericStats, categoricalStats, researchScore: score.researchScore, researchLevel: score.researchLevel, researchReasons: score.researchReasons };
  }).sort((a, b) => b.coverage - a.coverage || b.occurrences - a.occurrences || a.path.localeCompare(b.path));
}
