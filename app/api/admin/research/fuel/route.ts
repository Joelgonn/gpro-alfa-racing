import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { requireAdmin, resolveUserId } from '@/app/lib/auth';
import { createCapture, type Capture } from '@/app/lib/capture';
import { createKnowledgeScanSession } from '@/app/lib/knowledge-scan-session';
import { runDiscovery } from '@/app/lib/discovery-service';
import { accumulateKnowledge } from '@/app/lib/knowledge-accumulator';
import { computeResearchScore } from '@/app/components/research/research-score';
import { buildResearchVariableCatalog } from '@/app/lib/research/research-variable-catalog';
import type { FuelVariableRow } from '@/app/components/research/fuel-types';

const supabase = supabaseAdmin;

const FUEL_SIGNAL_PATHS = ['fuelConsumption', 'setFuel', 'fuelInvalid', 'q2LapData.setFuel'] as const;
const FUEL_ENDPOINTS = ['Practice', 'Testing', 'Qualify2', 'TrackProfile', 'UpdateCar'] as const;

type SnapshotRow = {
  id: string;
  endpoint: string;
  payload: any;
  season: number | null;
  race: number | null;
  created_at: string;
};

type PathAudit = {
  path: string;
  count: number;
  types: Set<string>;
};

type VariableAggregate = {
  path: string;
  occurrences: number;
  types: Map<string, number>;
  values: Map<string, number>;
  endpoints: Set<string>;
  firstSeen: string | null;
  lastSeen: string | null;
  numericValues: number[];
  stringValues: Map<string, number>;
};

async function getUserId(request: NextRequest): Promise<string> {
  const headerUserId = request.headers.get('user-id');
  const adminUser = await requireAdmin();
  if (headerUserId && headerUserId !== adminUser.id) {
    await resolveUserId(headerUserId);
  }
  return adminUser.id;
}

function getPathValue(value: any, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value as unknown);
}

function pickString(payload: any, paths: string[]): string | null {
  for (const path of paths) {
    const value = getPathValue(payload, path);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(payload: any, paths: string[]): number | null {
  for (const path of paths) {
    const value = getPathValue(payload, path);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function collectPaths(value: any, prefix = '', audit = new Map<string, PathAudit>()) {
  const pathKey = prefix || '<root>';
  const current = audit.get(pathKey) ?? { path: pathKey, count: 0, types: new Set<string>() };
  current.count += 1;
  current.types.add(value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);
  audit.set(pathKey, current);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPaths(item, prefix, audit);
    }
    return audit;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      collectPaths(nested, path, audit);
    }
  }

  return audit;
}

function collectVariableEntries(
  value: any,
  prefix = '',
  out = new Map<string, { type: string; value: unknown }>()
) {
  const pathKey = prefix || '<root>';
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  out.set(pathKey, { type, value });

  if (Array.isArray(value)) {
    for (const item of value) {
      collectVariableEntries(item, prefix, out);
    }
    return out;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      collectVariableEntries(nested, path, out);
    }
  }

  return out;
}

function buildCapture(userId: string, row: SnapshotRow): Capture {
  return createCapture({
    userId,
    endpoint: row.endpoint,
    source: 'manager_sync',
    payload: row.payload,
    season: row.season ?? undefined,
    race: row.race ?? undefined,
  });
}

function extractTrack(row: SnapshotRow): string | null {
  return pickString(row.payload, ['trackName', 'trackId', 'track.trackName', 'track.id']);
}

function extractTemperature(row: SnapshotRow): number | null {
  return pickNumber(row.payload, ['temp', 'temperature', 'weather.q2Temp', 'weather.q1Temp', 'q2LapData.temp', 'q1LapData.temp']);
}

function extractWeather(row: SnapshotRow): string | null {
  return pickString(row.payload, ['weather.q2Weather', 'weather.q1Weather', 'weather.weather', 'weather']);
}

function buildRows(userId: string, rows: SnapshotRow[]) {
  return rows.map(row => {
    const capture = buildCapture(userId, row);
    const track = extractTrack(row);
    const temperature = extractTemperature(row);
    const weather = extractWeather(row);
    const payloadKeys = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? Object.keys(row.payload) : [];
    const pathCount = collectPaths(row.payload).size;

    return {
      id: row.id,
      season: row.season,
      race: row.race,
      track,
      temperature,
      weather,
      source: 'manager_sync',
      endpoint: capture.endpoint,
      createdAt: row.created_at,
      payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
      payloadKeys,
      pathCount,
    };
  });
}

function buildTrackExplorer(rows: ReturnType<typeof buildRows>) {
  const map = new Map<string, {
    name: string;
    observationCount: number;
    temperatures: number[];
    endpoints: Set<string>;
    races: Set<string>;
  }>();

  for (const row of rows) {
    if (!row.track) continue;
    const existing = map.get(row.track) ?? {
      name: row.track,
      observationCount: 0,
      temperatures: [],
      endpoints: new Set<string>(),
      races: new Set<string>(),
    };

    existing.observationCount += 1;
    if (row.temperature !== null && row.temperature !== undefined) {
      existing.temperatures.push(row.temperature);
    }
    existing.endpoints.add(row.endpoint);
    if (row.season !== null && row.race !== null) {
      existing.races.add(`${row.season}-${row.race}`);
    }

    map.set(row.track, existing);
  }

  return Array.from(map.values())
    .map(track => ({
      name: track.name,
      observationCount: track.observationCount,
      minTemperature: track.temperatures.length ? Math.min(...track.temperatures) : null,
      maxTemperature: track.temperatures.length ? Math.max(...track.temperatures) : null,
      endpointCount: track.endpoints.size,
      raceCount: track.races.size,
    }))
    .sort((a, b) => b.observationCount - a.observationCount || a.name.localeCompare(b.name));
}

function buildAuditSummary(rows: SnapshotRow[]) {
  const pathMap = new Map<string, PathAudit>();
  const signalEndpoints = new Map<string, Set<string>>();
  const endpointsWithSignals = new Set<string>();

  for (const row of rows) {
    const paths = collectPaths(row.payload);
    for (const [path, audit] of paths.entries()) {
      const existing = pathMap.get(path) ?? { path, count: 0, types: new Set<string>() };
      existing.count += 1;
      for (const type of audit.types) existing.types.add(type);
      pathMap.set(path, existing);
    }

    const hasFuelSignal = FUEL_SIGNAL_PATHS.some(signalPath => getPathValue(row.payload, signalPath) !== undefined);
    if (hasFuelSignal) {
      endpointsWithSignals.add(row.endpoint);
    }

    for (const signalPath of FUEL_SIGNAL_PATHS) {
      if (getPathValue(row.payload, signalPath) !== undefined) {
        const existing = signalEndpoints.get(signalPath) ?? new Set<string>();
        existing.add(row.endpoint);
        signalEndpoints.set(signalPath, existing);
      }
    }
  }

  const totalSnapshots = rows.length;
  const fieldAudit = Array.from(pathMap.values())
    .filter(field => field.path !== '<root>')
    .map(field => ({
      path: field.path,
      count: field.count,
      coverage: totalSnapshots ? Math.round((field.count / totalSnapshots) * 100) : 0,
      sampleType: Array.from(field.types)[0] ?? 'unknown',
    }))
    .sort((a, b) => b.coverage - a.coverage || b.count - a.count || a.path.localeCompare(b.path));

  const fieldsIn100Percent = fieldAudit.filter(field => field.coverage === 100).map(field => field.path);

  const fuelSignals = FUEL_SIGNAL_PATHS
    .map(path => ({
      path,
      count: rows.filter(row => getPathValue(row.payload, path) !== undefined).length,
      endpoints: Array.from(signalEndpoints.get(path) ?? []).sort(),
    }))
    .filter(signal => signal.count > 0);

  return {
    totalSnapshots,
    uniquePaths: fieldAudit.length,
    fieldsIn100Percent,
    fieldAudit,
    fuelSignals,
    endpointsWithSignals: Array.from(endpointsWithSignals).sort(),
    endpointsWithoutSignals: Array.from(new Set(rows.map(row => row.endpoint))).filter(endpoint => !endpointsWithSignals.has(endpoint)).sort(),
  };
}

function buildVariableCatalog(rows: SnapshotRow[]): FuelVariableRow[] {
  const totalSnapshots = rows.length;
  const aggregates = new Map<string, VariableAggregate>();

  for (const row of rows) {
    const rowVariables = collectVariableEntries(row.payload);
    for (const [path, entry] of rowVariables.entries()) {
      if (path === '<root>') continue;

      const aggregate = aggregates.get(path) ?? {
        path,
        occurrences: 0,
        types: new Map<string, number>(),
        values: new Map<string, number>(),
        endpoints: new Set<string>(),
        firstSeen: null,
        lastSeen: null,
        numericValues: [],
        stringValues: new Map<string, number>(),
      };

      aggregate.occurrences += 1;
      aggregate.types.set(entry.type, (aggregate.types.get(entry.type) || 0) + 1);
      aggregate.endpoints.add(row.endpoint);
      if (!aggregate.firstSeen || row.created_at < aggregate.firstSeen) aggregate.firstSeen = row.created_at;
      if (!aggregate.lastSeen || row.created_at > aggregate.lastSeen) aggregate.lastSeen = row.created_at;

      const sampleValue = entry.value;
      const serialized = sampleValue === null ? 'null' : typeof sampleValue === 'string' ? sampleValue : typeof sampleValue === 'number' || typeof sampleValue === 'boolean' ? String(sampleValue) : JSON.stringify(sampleValue);
      aggregate.values.set(serialized, (aggregate.values.get(serialized) || 0) + 1);
      if (typeof sampleValue === 'number' && Number.isFinite(sampleValue)) {
        aggregate.numericValues.push(sampleValue);
      }
      if (typeof sampleValue === 'string' && sampleValue.trim()) {
        aggregate.stringValues.set(sampleValue, (aggregate.stringValues.get(sampleValue) || 0) + 1);
      }

      aggregates.set(path, aggregate);
    }
  }

  return Array.from(aggregates.values())
    .map(variable => {
      const sampleType = Array.from(variable.types.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
      const coverage = totalSnapshots ? Math.round((variable.occurrences / totalSnapshots) * 100) : 0;
      const distinctValues = Array.from(variable.values.keys());
      const distinctValuesCount = distinctValues.length;
      const sampleValues = distinctValues.slice(0, 5);
      const maturity: FuelVariableRow['maturity'] =
        coverage < 20 ? 'Experimental'
          : coverage < 60 ? 'Observada'
            : coverage < 90 ? 'Relevante'
              : 'Consolidada';
      const numericStats =
        sampleType === 'number' && variable.numericValues.length > 0
          ? {
              min: Math.min(...variable.numericValues),
              max: Math.max(...variable.numericValues),
              avg: variable.numericValues.reduce((sum, value) => sum + value, 0) / variable.numericValues.length,
              distinctValuesCount: new Set(variable.numericValues).size,
            }
          : null;
      const categoricalStats =
        sampleType === 'string'
          ? {
              distinctValuesCount,
              topValues: Array.from(variable.stringValues.entries())
                .map(([value, count]) => ({ value, count }))
                .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
                .slice(0, 10),
            }
          : null;
      const score = computeResearchScore({
        coverage,
        sampleType,
        distinctValuesCount,
        endpoints: Array.from(variable.endpoints).sort(),
        occurrences: variable.occurrences,
      });

      return {
        path: variable.path,
        sampleType,
        occurrences: variable.occurrences,
        coverage,
        distinctValuesCount,
        sampleValues,
        endpoints: Array.from(variable.endpoints).sort(),
        firstSeen: variable.firstSeen ?? '',
        lastSeen: variable.lastSeen ?? '',
        maturity,
        numericStats,
        categoricalStats,
        researchScore: score.researchScore,
        researchLevel: score.researchLevel,
        researchReasons: score.researchReasons,
      };
    })
    .sort((a, b) => b.coverage - a.coverage || b.occurrences - a.occurrences || a.path.localeCompare(b.path));
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    const { data: snapshots, error } = await supabase
      .from('gpro_import_snapshots')
      .select('id, endpoint, payload, season, race, created_at')
      .eq('user_id', userId)
      .in('endpoint', FUEL_ENDPOINTS)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const typedSnapshots = (snapshots || []) as SnapshotRow[];
    const observations = buildRows(userId, typedSnapshots);
    const rowsWithSignals = observations.filter(row =>
      Boolean(
        row.track ||
        row.temperature !== null ||
        row.weather ||
        FUEL_SIGNAL_PATHS.some(signalPath => getPathValue(row.payload, signalPath) !== undefined)
      )
    );

    const session = createKnowledgeScanSession();
    for (const snapshot of typedSnapshots) {
      session.addCapture(buildCapture(userId, snapshot));
    }

    const knowledgeSession = session.build();
    const discovery = runDiscovery(knowledgeSession);
    const knowledgeSummary = accumulateKnowledge(knowledgeSession);
    const auditSummary = buildAuditSummary(typedSnapshots);
    const variableCatalog = buildResearchVariableCatalog(typedSnapshots);

    const uniqueRaces = Array.from(new Set(observations.filter(row => row.season !== null && row.race !== null).map(row => `${row.season}-${row.race}`)));
    const uniqueTracks = Array.from(new Set(observations.map(row => row.track).filter(Boolean) as string[]));
    const uniqueEndpoints = Array.from(new Set(observations.map(row => row.endpoint)));
    const latestUpdate = observations.length ? observations[observations.length - 1].createdAt : null;

    const coverage = observations.length
      ? Math.round((rowsWithSignals.length / observations.length) * 100)
      : 0;

    const hypotheses = [
      {
        title: 'O endpoint Testing pode conter informações suficientes para estimar consumo.',
        description: 'Hipótese inicial cadastrada sem transformar sinais em conclusão.',
        observations: auditSummary.fuelSignals.reduce((sum, signal) => sum + signal.count, 0),
        status: auditSummary.fuelSignals.length > 0 ? 'Pendente' : 'Sem dados',
        confidence: auditSummary.fuelSignals.length > 0 ? 35 : 0,
      },
    ];

    return NextResponse.json({
      success: true,
      header: {
        observationCount: observations.length,
        raceCount: uniqueRaces.length,
        trackCount: uniqueTracks.length,
        latestUpdate,
      },
      overview: {
        snapshotsAnalyzed: observations.length,
        observations: observations.length,
        uniqueTracks: uniqueTracks.length,
        fieldsAudited: auditSummary.uniquePaths,
        coverage,
        fuelSignals: auditSummary.fuelSignals.reduce((sum, signal) => sum + signal.count, 0),
      },
      dataset: observations,
      trackExplorer: buildTrackExplorer(observations),
      knowledgePanel: {
        discovery,
        knowledgeSummary,
        schemaPreview: knowledgeSession.schemas[0] ?? null,
        evidencePreview: knowledgeSession.evidences[0] ?? null,
        auditSummary,
        variableCatalog,
      },
      hypotheses,
      roadmap: [
        { label: 'Modelo matemático', done: false },
        { label: 'Correlação', done: false },
        { label: 'Predição', done: false },
        { label: 'Comparação entre compostos', done: false },
        { label: 'Simulação', done: false },
      ],
      uniqueEndpoints,
    });
  } catch (error: any) {
    if (error?.status === 401) return NextResponse.json({ success: false, error: error.message || 'Não autenticado' }, { status: 401 });
    if (error?.status === 403) return NextResponse.json({ success: false, error: error.message || 'Acesso negado' }, { status: 403 });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar Fuel Lab' },
      { status: 500 }
    );
  }
}
